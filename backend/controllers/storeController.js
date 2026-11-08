const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const { H4_GYM_IDS } = require('../config/constants');
const { dedupeMembers } = require('../utils/memberIdentity');

const resolveStoreMember = async (req) => {
  const linkedMember = req.user.memberId
    ? await prisma.member.findUnique({ where: { id: req.user.memberId } })
    : null;
  let member = linkedMember;
  if (req.user.email || req.user.phone) {
    const identityFilters = [];
    if (req.user.email) identityFilters.push({ email: { equals: req.user.email.trim(), mode: 'insensitive' } });
    if (req.user.phone) identityFilters.push({ phone: req.user.phone });
    const matches = await prisma.member.findMany({
      where: { OR: identityFilters },
      orderBy: { updatedAt: 'desc' },
    });
    const uniqueMatches = dedupeMembers(matches);
    const normalizedEmail = String(req.user.email || '').trim().toLowerCase();
    const emailMatch = normalizedEmail
      ? uniqueMatches.find(candidate => String(candidate.email || '').trim().toLowerCase() === normalizedEmail)
      : null;
    const normalizedPhone = String(req.user.phone || '').replace(/\D/g, '');
    const phoneMatch = normalizedPhone
      ? uniqueMatches.find(candidate => String(candidate.phone || '').replace(/\D/g, '') === normalizedPhone)
      : null;
    member = emailMatch || phoneMatch || linkedMember;
    const userId = req.user._id || req.user.id;
    if (member && userId && member.id !== req.user.memberId) await prisma.user.update({ where: { id: userId }, data: { memberId: member.id } }).catch(() => {});
  }
  return member;
};

const adminDivision = (req, requested = 'fitpass') => {
  if (req.user.role === 'h4_admin') return 'h4';
  if (req.user.role === 'fitpass_admin') return 'fitpass';
  if (req.user.role === 'admin') return H4_GYM_IDS.includes(String(req.user.gymId)) ? 'h4' : 'fitpass';
  return requested === 'h4' ? 'h4' : 'fitpass';
};

const getProducts = catchAsync(async (req, res) => {
  const division = adminDivision(req, req.query.division === 'h4' ? 'h4' : 'fitpass');
  const isAdmin = ['admin', 'h4_admin', 'fitpass_admin', 'superadmin'].includes(req.user.role);
  const products = await prisma.storeProduct.findMany({
    where: { division, ...(isAdmin ? {} : { isActive: true }) },
    orderBy: { createdAt: 'desc' },
  });
  res.json(products);
});

const getMyOrders = catchAsync(async (req, res) => {
  const member = await resolveStoreMember(req);
  if (!member) return res.status(404).json({ message: 'Member account is not linked to a FitPass profile.' });
  const orders = await prisma.storeOrder.findMany({
    where: { memberId: member.id, division: 'fitpass' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orders);
});

const getCoinSettings = catchAsync(async (req, res) => {
  const division = adminDivision(req, req.query.division === 'h4' ? 'h4' : 'fitpass');
  const settings = await prisma.coinSettings.upsert({ where: { division }, create: { division }, update: {} });
  res.json(settings);
});

const saveCoinSettings = catchAsync(async (req, res) => {
  const division = adminDivision(req, req.body.division === 'h4' ? 'h4' : 'fitpass');
  const coinsPerSession = Number(req.body.coinsPerSession);
  if (!Number.isInteger(coinsPerSession) || coinsPerSession < 1 || coinsPerSession > 1000) return res.status(400).json({ message: 'Coins per session must be between 1 and 1000.' });
  const settings = await prisma.coinSettings.upsert({ where: { division }, create: { division, coinsPerSession }, update: { coinsPerSession } });
  res.json(settings);
});

const saveProduct = catchAsync(async (req, res) => {
  // The route parameter is the canonical edit ID. Multipart form fields can be
  // duplicated by clients/proxies, which turns Prisma's unique ID into an array.
  const id = req.params.id || req.body.id;
  const { name, description = '', priceCoins, imageUrl = '', division = 'fitpass', isActive = true, stock } = req.body;
  const safeDivision = adminDivision(req, division);
  if (!name?.trim() || (safeDivision !== 'h4' && (!Number.isInteger(Number(priceCoins)) || Number(priceCoins) < 1))) {
    return res.status(400).json({ message: 'Product name and a positive whole coin price are required.' });
  }
  if (stock !== '' && stock != null && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) return res.status(400).json({ message: 'Stock must be a non-negative whole number.' });
  const duplicate = await prisma.storeProduct.findFirst({
    where: { division: safeDivision, name: { equals: name.trim(), mode: 'insensitive' }, ...(id ? { id: { not: id } } : {}) },
  });
  if (duplicate) return res.status(409).json({ message: 'A product with this name already exists in this shop. Edit the existing product instead.' });
  const data = { name: name.trim(), description, priceCoins: safeDivision === 'h4' ? 0 : Number(priceCoins), imageUrl: req.file?.path || imageUrl, division: safeDivision, isActive: isActive === true || isActive === 'true', stock: stock === '' || stock == null ? null : Number(stock) };
  if (id) {
    const existing = await prisma.storeProduct.findUnique({ where: { id } });
    if (!existing || existing.division !== safeDivision) return res.status(404).json({ message: 'Product not found.' });
  }
  const product = id
    ? await prisma.storeProduct.update({ where: { id }, data })
    : await prisma.storeProduct.create({ data });
  res.json(product);
});

const deleteProduct = catchAsync(async (req, res) => {
  const existing = await prisma.storeProduct.findUnique({ where: { id: req.params.id } });
  const division = adminDivision(req, existing?.division);
  if (!existing || existing.division !== division) return res.status(404).json({ message: 'Product not found.' });
  await prisma.storeProduct.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json({ success: true });
});

const permanentlyDeleteProduct = catchAsync(async (req, res) => {
  const existing = await prisma.storeProduct.findUnique({ where: { id: req.params.id } });
  const division = adminDivision(req, existing?.division);
  if (!existing || existing.division !== division) return res.status(404).json({ message: 'Product not found.' });
  // Orders keep their productName snapshot and productId as historical text, so
  // removing the catalog entry does not erase purchase history.
  await prisma.storeProduct.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

const purchaseProduct = catchAsync(async (req, res) => {
  const member = await resolveStoreMember(req);
  if (!member) return res.status(404).json({ message: 'Member account not found.' });
  const product = await prisma.storeProduct.findUnique({ where: { id: req.params.id } });
  const division = req.user.gymName?.toUpperCase() === 'H4' || H4_GYM_IDS.includes(String(member.gymId || req.user.gymId)) ? 'h4' : 'fitpass';
  if (division === 'h4') return res.status(403).json({ message: 'H4 merchandise is for display only. Please purchase in person at an H4 gym.' });
  if (!product || !product.isActive || product.division !== division) return res.status(404).json({ message: 'Product is unavailable.' });
  const coinField = division === 'h4' ? 'h4Coins' : 'fitpassCoins';
  const legacyRate = await prisma.coinSettings.findUnique({ where: { division } }).catch(() => null);
  if (!member.coinsMigrated) {
    await prisma.member.updateMany({ where: { id: member.id, coinsMigrated: false }, data: { [coinField]: (member[coinField] || 0) + (member.sessionsRemaining || 0) * (legacyRate?.coinsPerSession || 10), coinsMigrated: true } });
  } else if (division === 'fitpass' && member.fitpassCoins == null) {
    // Match the legacy balance exposed by session status and the admin roster.
    await prisma.member.update({ where: { id: member.id }, data: { fitpassCoins: (member.sessionsRemaining || 0) * (legacyRate?.coinsPerSession || 10), coinsMigrated: true } });
  }
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.storeProduct.findUnique({ where: { id: product.id } });
    if (!current?.isActive || current.division !== division) throw Object.assign(new Error('Product is unavailable.'), { statusCode: 404 });
    if (current.stock != null) {
      const stock = await tx.storeProduct.updateMany({ where: { id: current.id, isActive: true, stock: { gte: 1 } }, data: { stock: { decrement: 1 } } });
      if (!stock.count) throw Object.assign(new Error('This product is out of stock.'), { statusCode: 409 });
    }
    const changed = await tx.member.updateMany({ where: { id: member.id, [coinField]: { gte: current.priceCoins } }, data: { [coinField]: { decrement: current.priceCoins } } });
    if (!changed.count) throw Object.assign(new Error('Not enough coins for this product.'), { statusCode: 402 });
    const order = await tx.storeOrder.create({ data: { memberId: member.id, productId: current.id, productName: current.name, division, coinsSpent: current.priceCoins, status: 'RECEIVED' } });
    const updated = await tx.member.findUnique({ where: { id: member.id } });
    return { order, balance: updated[coinField] };
  });
  res.json({ success: true, ...result });
});

module.exports = { getProducts, getMyOrders, saveProduct, deleteProduct, permanentlyDeleteProduct, purchaseProduct, getCoinSettings, saveCoinSettings };
