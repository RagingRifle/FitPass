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
  if (['h4_admin', 'h4_branch_admin'].includes(req.user.role)) return 'h4';
  if (req.user.role === 'fitpass_admin') return 'fitpass';
  if (req.user.role === 'admin') return H4_GYM_IDS.includes(String(req.user.gymId)) ? 'h4' : 'fitpass';
  return requested === 'h4' ? 'h4' : 'fitpass';
};

const getProducts = catchAsync(async (req, res) => {
  const division = adminDivision(req, req.query.division === 'h4' ? 'h4' : 'fitpass');
  const isAdmin = ['admin', 'h4_admin', 'h4_branch_admin', 'fitpass_admin', 'superadmin'].includes(req.user.role);
  const products = await prisma.storeProduct.findMany({
    where: { division, ...(isAdmin ? {} : { isActive: true }) },
    orderBy: { createdAt: 'desc' },
    ...(!isAdmin ? { select: {
      id: true,
      name: true,
      description: true,
      priceCoins: true,
      priceINR: true,
      imageUrl: true,
      division: true,
      isActive: true,
      stock: true,
      createdAt: true,
      updatedAt: true,
    } } : {}),
  });
  res.json(products);
});

const getMyOrders = catchAsync(async (req, res) => {
  const member = await resolveStoreMember(req);
  if (!member) return res.status(404).json({ message: 'Member account is not linked to a FitPass profile.' });
  const orders = await prisma.storeOrder.findMany({
    where: { memberId: member.id, division: 'fitpass' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      productId: true,
      productName: true,
      division: true,
      coinsSpent: true,
      quantity: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
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
  const { name, description = '', priceCoins, costCoins, marginCoins, priceINR, costINR, marginINR, imageUrl = '', division = 'fitpass', isActive = true, stock } = req.body;
  const safeDivision = adminDivision(req, division);
  if (!name?.trim()) {
    return res.status(400).json({ message: 'Product name is required.' });
  }
  if (stock !== '' && stock != null && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) return res.status(400).json({ message: 'Stock must be a non-negative whole number.' });
  const duplicate = await prisma.storeProduct.findFirst({
    where: { division: safeDivision, name: { equals: name.trim(), mode: 'insensitive' }, ...(id ? { id: { not: id } } : {}) },
  });
  if (duplicate) return res.status(409).json({ message: 'A product with this name already exists in this shop. Edit the existing product instead.' });
  let h4Pricing = null;
  let fitpassPricing = null;
  if (safeDivision === 'h4') {
    const hasCost = costINR !== '' && costINR != null;
    const hasSellingPrice = priceINR !== '' && priceINR != null;
    const hasMargin = marginINR !== '' && marginINR != null;
    const values = {
      costINR: hasCost ? Number(costINR) : null,
      priceINR: hasSellingPrice ? Number(priceINR) : null,
      marginINR: hasMargin ? Number(marginINR) : null,
    };
    const supplied = Object.keys(values).filter(key => values[key] != null);
    if (supplied.length < 2 || supplied.some(key => !Number.isFinite(values[key]))) {
      return res.status(400).json({ message: 'Enter any two of cost price, selling price, and margin amount.' });
    }
    if (['costINR', 'priceINR'].some(key => values[key] != null && values[key] < 0)) {
      return res.status(400).json({ message: 'Cost price and selling price cannot be negative.' });
    }
    const roundCurrency = value => Math.round((value + Number.EPSILON) * 100) / 100;
    if (values.costINR == null) values.costINR = roundCurrency(values.priceINR - values.marginINR);
    if (values.priceINR == null) values.priceINR = roundCurrency(values.costINR + values.marginINR);
    if (values.marginINR == null) values.marginINR = roundCurrency(values.priceINR - values.costINR);
    if (values.costINR < 0 || Math.abs(values.priceINR - values.costINR - values.marginINR) > 0.01) {
      return res.status(400).json({ message: 'Cost price, selling price, and margin amount must add up correctly.' });
    }
    h4Pricing = values;
  } else {
    const hasCost = costCoins !== '' && costCoins != null;
    const hasSellingPrice = priceCoins !== '' && priceCoins != null;
    const hasMargin = marginCoins !== '' && marginCoins != null;
    const values = {
      costCoins: hasCost ? Number(costCoins) : null,
      priceCoins: hasSellingPrice ? Number(priceCoins) : null,
      marginCoins: hasMargin ? Number(marginCoins) : null,
    };
    const supplied = Object.keys(values).filter(key => values[key] != null);
    if (supplied.length < 2 || supplied.some(key => !Number.isInteger(values[key]))) {
      return res.status(400).json({ message: 'Enter any two whole-coin values for cost price, selling price, and margin amount.' });
    }
    if (['costCoins', 'priceCoins'].some(key => values[key] != null && values[key] < 0)) {
      return res.status(400).json({ message: 'Cost price and selling price cannot be negative.' });
    }
    if (values.costCoins == null) values.costCoins = values.priceCoins - values.marginCoins;
    if (values.priceCoins == null) values.priceCoins = values.costCoins + values.marginCoins;
    if (values.marginCoins == null) values.marginCoins = values.priceCoins - values.costCoins;
    if (values.costCoins < 0 || values.priceCoins < 1 || values.priceCoins > 100000 || values.costCoins > 100000 || Math.abs(values.priceCoins - values.costCoins - values.marginCoins) > 0) {
      return res.status(400).json({ message: 'Enter a positive FitCoin selling price and valid cost/margin values that add up.' });
    }
    fitpassPricing = values;
  }
  const data = { name: name.trim(), description, priceCoins: safeDivision === 'h4' ? 0 : fitpassPricing.priceCoins, costCoins: safeDivision === 'h4' ? null : fitpassPricing.costCoins, marginCoins: safeDivision === 'h4' ? null : fitpassPricing.marginCoins, priceINR: safeDivision === 'h4' ? h4Pricing.priceINR : null, costINR: safeDivision === 'h4' ? h4Pricing.costINR : null, marginINR: safeDivision === 'h4' ? h4Pricing.marginINR : null, imageUrl: req.file?.path || imageUrl, division: safeDivision, isActive: isActive === true || isActive === 'true', stock: stock === '' || stock == null ? null : Number(stock) };
  if (id) {
    const existing = await prisma.storeProduct.findUnique({ where: { id } });
    if (!existing || existing.division !== safeDivision) return res.status(404).json({ message: 'Product not found.' });
  }
  const product = id
    ? await prisma.storeProduct.update({ where: { id }, data })
    : await prisma.storeProduct.create({ data });

  if (!id && safeDivision === 'h4' && data.isActive) {
    try {
      const h4Gym = await prisma.gym.findFirst({
        where: { OR: [{ id: { in: H4_GYM_IDS } }, { name: { contains: 'h4', mode: 'insensitive' } }] },
        select: { id: true },
      });
      if (h4Gym?.id) {
        const settings = await prisma.gymSettings.findUnique({
          where: { gymId: h4Gym.id },
          select: { notifyNewProductToMembers: true },
        });
        const shouldNotify = settings?.notifyNewProductToMembers ?? true;
        if (shouldNotify) {
          const memberUsers = await prisma.user.findMany({
            where: { gymId: h4Gym.id, role: 'member', isActive: true, status: 'Active' },
            select: { id: true },
          });
          if (memberUsers.length > 0) {
            await prisma.notification.createMany({
              data: memberUsers.map(u => ({
                recipientId: u.id,
                gymId: h4Gym.id,
                type: 'new_product',
                message: `New in H4 Shop: ${product.name}${product.priceINR != null ? ` (₹${Number(product.priceINR).toLocaleString('en-IN')})` : ''}. Check it out in the app!`,
              })),
            });
          }
        }
      }
    } catch (notifyErr) {
      console.error('New product member notification failed:', notifyErr?.message || notifyErr);
    }
  }

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

const getStorePurchases = catchAsync(async (req, res) => {
  const requestedDivision = req.query.division === 'h4' ? 'h4' : 'fitpass';
  const division = adminDivision(req, requestedDivision);
  if (division === 'fitpass' && !['superadmin', 'fitpass_admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'FitPass purchase reports are available to FitPass administrators only.' });
  }
  const where = { division };
  if (division === 'h4' && req.user.role === 'admin') {
    const memberScope = { gymId: String(req.user.gymId || '') };
    if (req.user.branchId) memberScope.branchId = String(req.user.branchId);
    const scopedMembers = await prisma.member.findMany({ where: memberScope, select: { id: true } });
    where.memberId = { in: scopedMembers.map(member => member.id) };
  }
  if (req.query.productId) where.productId = String(req.query.productId);
  if (req.query.dateFrom || req.query.dateTo) {
    const createdAt = {};
    const timezoneOffset = Number(req.query.timezoneOffset || 0);
    if (!Number.isFinite(timezoneOffset) || Math.abs(timezoneOffset) > 840) {
      return res.status(400).json({ message: 'Timezone offset must be between -840 and 840 minutes.' });
    }
    const parseDate = (value, label) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw Object.assign(new Error(`${label} must be a valid date.`), { statusCode: 400 });
      }
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw Object.assign(new Error(`${label} must be a valid date.`), { statusCode: 400 });
      }
      return new Date(date.getTime() + timezoneOffset * 60_000);
    };
    if (req.query.dateFrom) createdAt.gte = parseDate(String(req.query.dateFrom), 'Start date');
    if (req.query.dateTo) {
      const endDate = parseDate(String(req.query.dateTo), 'End date');
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      createdAt.lt = endDate;
    }
    if (createdAt.gte && createdAt.lt && createdAt.gte >= createdAt.lt) {
      return res.status(400).json({ message: 'Start date must be on or before end date.' });
    }
    where.createdAt = createdAt;
  }
  const orders = await prisma.storeOrder.findMany({ where, orderBy: { createdAt: 'desc' } });
  const members = orders.length
    ? await prisma.member.findMany({
      where: { id: { in: [...new Set(orders.map(order => order.memberId))] } },
      select: { id: true, name: true, phone: true, email: true },
    })
    : [];
  const memberById = new Map(members.map(member => [member.id, member]));
  res.json(orders.map(order => ({ ...order, member: memberById.get(order.memberId) || null })));
});

const registerH4Purchase = catchAsync(async (req, res) => {
  const division = adminDivision(req, 'h4');
  if (division !== 'h4') return res.status(403).json({ message: 'Only H4 merchandise purchases can be registered here.' });
  const { memberId, productId, paymentMethod = 'Cash' } = req.body;
  const quantity = Number(req.body.quantity);
  if (!memberId || !productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
    return res.status(400).json({ message: 'Choose a member and product, and enter a quantity between 1 and 1000.' });
  }
  if (!['Cash', 'UPI', 'Card', 'Other'].includes(paymentMethod)) {
    return res.status(400).json({ message: 'Choose a valid payment method.' });
  }
  const member = await prisma.member.findUnique({ where: { id: String(memberId) } });
  if (!member) return res.status(404).json({ message: 'Member not found.' });
  const memberGymId = String(member.gymId || '');
  const userGymId = String(req.user.gymId || '');
  const belongsToH4 = H4_GYM_IDS.includes(memberGymId)
    || (req.user.role !== 'superadmin' && userGymId && memberGymId === userGymId);
  if (!belongsToH4 || (req.user.branchId && String(member.branchId || '') !== String(req.user.branchId))) {
    return res.status(404).json({ message: 'Member not found in your H4 branch.' });
  }
  const product = await prisma.storeProduct.findUnique({ where: { id: String(productId) } });
  if (!product || !product.isActive || product.division !== 'h4') {
    return res.status(404).json({ message: 'Product is unavailable.' });
  }
  const result = await prisma.$transaction(async tx => {
    const current = await tx.storeProduct.findUnique({ where: { id: product.id } });
    if (!current?.isActive || current.division !== 'h4') {
      throw Object.assign(new Error('Product is unavailable.'), { statusCode: 404 });
    }
    if (!Number.isFinite(Number(current.costINR)) || Number(current.costINR) < 0) {
      throw Object.assign(new Error('Add a valid cost price to this product before registering a purchase.'), { statusCode: 409 });
    }
    if (current.stock != null) {
      const stock = await tx.storeProduct.updateMany({
        where: { id: current.id, isActive: true, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (!stock.count) throw Object.assign(new Error('Not enough stock for this purchase.'), { statusCode: 409 });
    }
    return tx.storeOrder.create({
      data: {
        memberId: member.id,
        productId: current.id,
        productName: current.name,
        division: 'h4',
        coinsSpent: 0,
        amountINR: Math.round((Number(current.priceINR || 0) * quantity + Number.EPSILON) * 100) / 100,
        costINR: Math.round((Number(current.costINR) * quantity + Number.EPSILON) * 100) / 100,
        quantity,
        paymentMethod,
        status: 'RECEIVED',
      },
    });
  });
  res.status(201).json({ ...result, member: { id: member.id, name: member.name, phone: member.phone } });
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
    const order = await tx.storeOrder.create({ data: { memberId: member.id, productId: current.id, productName: current.name, division, coinsSpent: current.priceCoins, costCoins: current.costCoins, status: 'RECEIVED' } });
    const updated = await tx.member.findUnique({ where: { id: member.id } });
    return { order, balance: updated[coinField] };
  });
  res.json({
    success: true,
    order: {
      id: result.order.id,
      memberId: result.order.memberId,
      productId: result.order.productId,
      productName: result.order.productName,
      division: result.order.division,
      coinsSpent: result.order.coinsSpent,
      status: result.order.status,
      createdAt: result.order.createdAt,
    },
    balance: result.balance,
  });
});

module.exports = { getProducts, getMyOrders, saveProduct, deleteProduct, permanentlyDeleteProduct, getStorePurchases, registerH4Purchase, purchaseProduct, getCoinSettings, saveCoinSettings };
