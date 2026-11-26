import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import API from '../services/api';
import { useToast } from '../components/ui/Toast';
import { AuthContext } from '../context/AuthContext';
import { ImagePlus } from 'lucide-react';
import { getMembers } from '../services/apiService';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';

const empty = { name: '', description: '', priceCoins: 12, costCoins: '', marginCoins: '', priceINR: '', costINR: '', marginINR: '', imageUrl: '', division: 'fitpass', isActive: true, stock: '' };
const roundCurrency = value => Math.round((value + Number.EPSILON) * 100) / 100;
const parsePrice = value => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const hasSavedAmount = value => value !== null && value !== undefined && Number.isFinite(Number(value));
const deriveH4Pricing = (form, pricingMode) => {
  const cost = parsePrice(form.costINR);
  const selling = parsePrice(form.priceINR);
  const margin = parsePrice(form.marginINR);
  if (pricingMode === 'margin' && cost != null && selling != null) {
    return { costINR: cost, priceINR: selling, marginINR: roundCurrency(selling - cost) };
  }
  if (pricingMode === 'selling' && cost != null && margin != null) {
    return { costINR: cost, priceINR: roundCurrency(cost + margin), marginINR: margin };
  }
  if (pricingMode === 'cost' && selling != null && margin != null) {
    return { costINR: roundCurrency(selling - margin), priceINR: selling, marginINR: margin };
  }
  return null;
};
const deriveFitPassPricing = (form, pricingMode) => {
  const cost = parsePrice(form.costCoins);
  const selling = parsePrice(form.priceCoins);
  const margin = parsePrice(form.marginCoins);
  if (pricingMode === 'margin' && cost != null && selling != null) {
    return { costCoins: cost, priceCoins: selling, marginCoins: selling - cost };
  }
  if (pricingMode === 'selling' && cost != null && margin != null) {
    return { costCoins: cost, priceCoins: cost + margin, marginCoins: margin };
  }
  if (pricingMode === 'cost' && selling != null && margin != null) {
    return { costCoins: selling - margin, priceCoins: selling, marginCoins: margin };
  }
  return null;
};

export default function Products() {
  const { activeDivision } = useContext(AuthContext);
  const user = JSON.parse(sessionStorage.getItem('user') || 'null');
  const isFitPassAdmin = user?.role === 'fitpass_admin';
  const isH4Admin = ['h4_admin', 'h4_branch_admin'].includes(user?.role);
  const isH4GymAdmin = user?.role === 'admin' && (String(user?.gymName || '').toUpperCase() === 'H4' || ['05a08fdf-7427-48a5-8b25-e18d5a5668cd', '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d'].includes(String(user?.gymId?._id || user?.gymId || '')));
  const fixedDivision = isFitPassAdmin ? 'fitpass' : (isH4Admin || isH4GymAdmin) ? 'h4' : null;
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [imagePreview, setImagePreview] = useState('');
  const imageInput = useRef(null);
  const [division, setDivision] = useState(fixedDivision || activeDivision || 'fitpass');
  const [form, setForm] = useState(empty);
  const [pricingMode, setPricingMode] = useState('selling');
  const [image, setImage] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [coinsPerSession, setCoinsPerSession] = useState(10);
  const [savingRate, setSavingRate] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const purchaseRequestRef = useRef(0);
  const [purchaseDateFrom, setPurchaseDateFrom] = useState('');
  const [purchaseDateTo, setPurchaseDateTo] = useState('');
  const [purchaseProductFilter, setPurchaseProductFilter] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberOptions, setMemberOptions] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearchError, setMemberSearchError] = useState('');
  const [purchaseForm, setPurchaseForm] = useState({ productId: '', quantity: '1', paymentMethod: 'Cash' });
  const [savingPurchase, setSavingPurchase] = useState(false);

  useEffect(() => {
    if (!image) {
      setImagePreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(image);
    setImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [image]);

  const load = useCallback(async () => {
    try {
      const { data } = await API.get(`/store/products?division=${division}`);
      setProducts(Array.isArray(data) ? data : []);
      setLoadError('');
    } catch (error) {
      const message = error.response?.data?.message;
      setLoadError(message ? `Could not load products: ${message}` : 'Could not load products. Check your connection and try again.');
    }
  }, [division]);

  const loadPurchases = useCallback(async () => {
    const requestId = ++purchaseRequestRef.current;
    setPurchaseLoading(true);
    try {
      const { data } = await API.get('/store/purchases', {
        params: {
          division,
          timezoneOffset: new Date().getTimezoneOffset(),
          ...(purchaseDateFrom ? { dateFrom: purchaseDateFrom } : {}),
          ...(purchaseDateTo ? { dateTo: purchaseDateTo } : {}),
          ...(purchaseProductFilter ? { productId: purchaseProductFilter } : {}),
        },
      });
      if (requestId === purchaseRequestRef.current) {
        setPurchaseOrders(Array.isArray(data) ? data : []);
        setPurchaseError('');
      }
    } catch (error) {
      if (requestId === purchaseRequestRef.current) {
        setPurchaseOrders([]);
        setPurchaseError(error.response?.data?.message || 'Could not load purchase records.');
      }
    } finally {
      if (requestId === purchaseRequestRef.current) setPurchaseLoading(false);
    }
  }, [division, purchaseDateFrom, purchaseDateTo, purchaseProductFilter]);

  useEffect(() => {
    load();
    API.get(`/store/coin-settings?division=${division}`).then(({ data }) => setCoinsPerSession(data.coinsPerSession)).catch(() => {});
  }, [division, load]);

  useEffect(() => {
    if (activeTab === 'reports') loadPurchases();
  }, [activeTab, division, loadPurchases]);

  useEffect(() => {
    const term = memberSearch.trim();
    if (division !== 'h4' || term.length < 2) {
      setMemberOptions([]);
      setMemberSearchError('');
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const result = await getMembers('', 1, term, 10);
        if (active) {
          setMemberOptions(result.members || []);
          setMemberSearchError('');
        }
      } catch (error) {
        if (active) {
          setMemberOptions([]);
          setMemberSearchError(error.response?.data?.message || 'Could not search members.');
        }
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [division, memberSearch]);

  useEffect(() => {
    if (!fixedDivision && activeDivision && activeDivision !== division) {
      setDivision(activeDivision);
      setActiveTab('products');
      setForm({ ...empty, division: activeDivision });
      setPricingMode('selling');
      setImage(null);
      setEditing(null);
      if (imageInput.current) imageInput.current.value = '';
    }
  }, [activeDivision, fixedDivision, division]);

  const saveRate = async () => {
    setSavingRate(true);
    try {
      await API.put('/store/coin-settings', { division, coinsPerSession: Number(coinsPerSession) });
      toast.success(`Conversion rate saved: ${coinsPerSession} coins per check-in.`);
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save conversion rate.'); }
    finally { setSavingRate(false); }
  };

  const save = async (event) => {
    event.preventDefault(); setBusy(true);
    try {
      const h4Pricing = division === 'h4' ? deriveH4Pricing(form, pricingMode) : null;
      const fitpassPricing = division === 'h4' ? null : deriveFitPassPricing(form, pricingMode);
      if (division === 'h4' && !h4Pricing || division !== 'h4' && !fitpassPricing) {
        toast.error('Enter both pricing values to calculate the third.');
        setBusy(false);
        return;
      }
      const payload = {
        ...form,
        ...h4Pricing,
        ...fitpassPricing,
        division,
        priceCoins: division === 'h4' ? 0 : fitpassPricing.priceCoins,
        priceINR: division === 'h4' ? h4Pricing.priceINR : null,
      };
      const body = new FormData();
      Object.entries(payload).forEach(([key, value]) => body.append(key, String(value ?? '')));
      if (image) body.append('image', image);
      await API({
        method: editing ? 'put' : 'post',
        url: editing ? `/store/products/${editing}` : '/store/products',
        data: image ? body : payload,
        // Let the browser/Axios add the multipart boundary when uploading a file.
      });
      setForm({ ...empty, division }); setPricingMode('selling'); setImage(null); setEditing(null);
      if (imageInput.current) imageInput.current.value = '';
      await load(); toast.success('Product saved.');
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save product.'); }
    finally { setBusy(false); }
  };

  const edit = (product) => {
    setEditing(product.id);
    setForm({ ...product, costINR: product.costINR ?? '', marginINR: product.marginINR ?? '', costCoins: product.costCoins ?? '', marginCoins: product.marginCoins ?? '', stock: product.stock ?? '' });
    setPricingMode('margin');
    setImage(null);
    if (imageInput.current) imageInput.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelEdit = () => {
    setEditing(null);
    setImage(null);
    setForm({ ...empty, division });
    setPricingMode('selling');
    if (imageInput.current) imageInput.current.value = '';
  };
  const registerPurchase = async (event) => {
    event.preventDefault();
    setSavingPurchase(true);
    setPurchaseError('');
    try {
      await API.post('/store/purchases', {
        division,
        memberId: selectedMemberId,
        productId: purchaseForm.productId,
        quantity: Number(purchaseForm.quantity),
        paymentMethod: purchaseForm.paymentMethod,
      });
      setPurchaseForm({ productId: '', quantity: '1', paymentMethod: 'Cash' });
      setMemberSearch('');
      setSelectedMemberId('');
      setMemberOptions([]);
      await Promise.all([load(), loadPurchases()]);
      toast.success('Purchase registered.');
    } catch (error) {
      const message = error.response?.data?.message || 'Could not register purchase.';
      setPurchaseError(message);
      toast.error(message);
    } finally {
      setSavingPurchase(false);
    }
  };
  const remove = async (id) => { try { await API.delete(`/store/products/${id}`); await load(); toast.success('Product hidden from the shop.'); } catch { toast.error('Could not update product.'); } };
  const permanentlyRemove = async (product) => {
    if (!window.confirm(`Permanently delete “${product.name}”? This removes it from the catalog. Existing order history is kept.`)) return;
    try {
      await API.delete(`/store/products/${product.id}/permanent`);
      if (editing === product.id) cancelEdit();
      await load();
      toast.success('Product permanently deleted.');
    } catch (error) { toast.error(error.response?.data?.message || 'Could not delete product.'); }
  };
  const field = (key, label, type = 'text') => <label className="products-field">{label}<input required={key === 'name' || key === 'priceCoins' || (key === 'priceINR' && division === 'h4')} type={type} min={type === 'number' ? 0 : undefined} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>;

  const reportSalesValue = order => division === 'h4' ? order.amountINR : order.coinsSpent;
  const reportCostValue = order => division === 'h4' ? order.costINR : order.costCoins;
  const formatReportAmount = value => `${division === 'h4' ? '₹' : ''}${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${division === 'h4' ? '' : ' FitCoins'}`;
  const purchaseRevenue = purchaseOrders.reduce((total, order) => total + (hasSavedAmount(reportSalesValue(order)) ? Number(reportSalesValue(order)) : 0), 0);
  const purchaseUnits = purchaseOrders.reduce((total, order) => total + Number(order.quantity || 1), 0);
  const trackedPurchases = purchaseOrders.filter(order => hasSavedAmount(reportSalesValue(order)) && hasSavedAmount(reportCostValue(order)));
  const purchaseProfit = trackedPurchases.reduce((total, order) => total + Number(reportSalesValue(order)) - Number(reportCostValue(order)), 0);
  const untrackedPurchaseCount = purchaseOrders.length - trackedPurchases.length;
  const dailyPurchaseMetrics = Array.from(purchaseOrders.reduce((days, order) => {
    const date = new Date(order.createdAt);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const metrics = days.get(day) || { date: day, netSales: 0, netProfit: null, untracked: 0 };
    if (hasSavedAmount(reportSalesValue(order))) metrics.netSales += Number(reportSalesValue(order));
    if (hasSavedAmount(reportSalesValue(order)) && hasSavedAmount(reportCostValue(order))) {
      metrics.netProfit = (metrics.netProfit || 0) + Number(reportSalesValue(order)) - Number(reportCostValue(order));
    }
    else metrics.untracked += 1;
    days.set(day, metrics);
    return days;
  }, new Map()).values()).sort((a, b) => a.date.localeCompare(b.date));
  const productProfitMetrics = Array.from(purchaseOrders.reduce((productsById, order) => {
    const row = productsById.get(order.productId) || { product: order.productName, netProfit: null, units: 0, untracked: 0 };
    row.units += Number(order.quantity || 1);
    if (hasSavedAmount(reportSalesValue(order)) && hasSavedAmount(reportCostValue(order))) {
      row.netProfit = (row.netProfit || 0) + Number(reportSalesValue(order)) - Number(reportCostValue(order));
    } else {
      row.untracked += 1;
    }
    productsById.set(order.productId, row);
    return productsById;
  }, new Map()).values()).sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0));
  const derivedPricing = division === 'h4' ? deriveH4Pricing(form, pricingMode) : deriveFitPassPricing(form, pricingMode);
  const pricingFields = division === 'h4'
    ? { cost: 'costINR', selling: 'priceINR', margin: 'marginINR', suffix: '₹' }
    : { cost: 'costCoins', selling: 'priceCoins', margin: 'marginCoins', suffix: 'FitCoins' };
  const canViewReports = division === 'h4' || ['superadmin', 'fitpass_admin'].includes(user?.role);
  const purchaseReportProducts = Array.from(new Map([
    ...products.map(product => [product.id, { id: product.id, name: product.name }]),
    ...purchaseOrders.map(order => [order.productId, { id: order.productId, name: order.productName }]),
  ]).values());

  return <main className="products-page">
    <header className="products-header">
      <div><p className="products-eyebrow">STORE MANAGEMENT</p><h1>{division === 'h4' ? 'H4 Merchandise' : 'FitPass Product Catalog'}</h1><p>{division === 'h4' ? 'Manage merchandise, record counter sales, and review purchase activity.' : 'Create products, set FitCoin prices, and publish them to the FitPass app and member shop.'}</p></div>
    </header>

    <nav className="products-tabs" aria-label="Product management sections">
      <button type="button" className={activeTab === 'products' ? 'is-active' : ''} aria-current={activeTab === 'products' ? 'page' : undefined} onClick={() => setActiveTab('products')}>Products</button>
      {division === 'h4' && <button type="button" className={activeTab === 'register' ? 'is-active' : ''} aria-current={activeTab === 'register' ? 'page' : undefined} onClick={() => setActiveTab('register')}>Register purchase</button>}
      {canViewReports && <button type="button" className={activeTab === 'reports' ? 'is-active' : ''} aria-current={activeTab === 'reports' ? 'page' : undefined} onClick={() => setActiveTab('reports')}>Purchase reports</button>}
    </nav>

    {activeTab === 'products' && <>
    {loadError && <div className="products-load-error" role="alert"><span>{loadError}</span><button type="button" className="products-retry-button" onClick={load}>Try again</button></div>}

    {division !== 'h4' && <section className="products-rate-panel">
      <div><h2>Check-in conversion rate</h2><p>FitCoins charged for each partner gym check-in.</p></div>
      <label className="products-field">FitCoins per check-in<input type="number" min="1" max="1000" value={coinsPerSession} onChange={e => setCoinsPerSession(e.target.value)} /></label>
      <button type="button" className="products-primary-button" onClick={saveRate} disabled={savingRate}>{savingRate ? 'Saving…' : 'Save rate'}</button>
    </section>}

    <section className="products-section">
      <div className="products-section-heading"><div><h2>{editing ? 'Edit product' : division === 'h4' ? 'Add merchandise' : 'Add a product'}</h2><p>{division === 'h4' ? 'Add items for members to browse; checkout is handled at the gym.' : 'Set the shop price, availability, and optional product photo.'}</p></div>{editing && <button type="button" className="products-secondary-button" onClick={cancelEdit}>Cancel edit</button>}</div>
      <form className="products-form" onSubmit={save}>
        {field('name', 'Product name')}
        <>
          <label className="products-field products-pricing-mode">Calculate
            <select value={pricingMode} onChange={event => setPricingMode(event.target.value)}>
              <option value="selling">Selling price from cost + margin</option>
              <option value="margin">Margin from cost + selling price</option>
              <option value="cost">Cost price from selling price + margin</option>
            </select>
          </label>
          <label className="products-field">Cost price ({pricingFields.suffix})
            <input type="number" min="0" step={division === 'h4' ? '0.01' : '1'} value={pricingMode === 'cost' ? (derivedPricing?.[pricingFields.cost] ?? '') : form[pricingFields.cost]} readOnly={pricingMode === 'cost'} required={pricingMode !== 'cost'} onChange={event => setForm({ ...form, [pricingFields.cost]: event.target.value })} />
          </label>
          <label className="products-field">Selling price ({pricingFields.suffix})
            <input type="number" min="0" step={division === 'h4' ? '0.01' : '1'} value={pricingMode === 'selling' ? (derivedPricing?.[pricingFields.selling] ?? '') : form[pricingFields.selling]} readOnly={pricingMode === 'selling'} required={pricingMode !== 'selling'} onChange={event => setForm({ ...form, [pricingFields.selling]: event.target.value })} />
          </label>
          <label className="products-field">Margin amount ({pricingFields.suffix})
            <input type="number" step={division === 'h4' ? '0.01' : '1'} value={pricingMode === 'margin' ? (derivedPricing?.[pricingFields.margin] ?? '') : form[pricingFields.margin]} readOnly={pricingMode === 'margin'} required={pricingMode !== 'margin'} onChange={event => setForm({ ...form, [pricingFields.margin]: event.target.value })} />
          </label>
          <p className="products-pricing-help">Enter any two values. Margin is the difference between selling and cost price; negative margin means a loss.</p>
        </>
        {field('stock', 'Stock (optional)', 'number')}
        <div className="products-field products-image-field">
          <span>{editing ? 'Replace product image' : 'Product image'}</span>
          <label className="products-image-picker">
            {imagePreview || form.imageUrl
              ? <img src={imagePreview || form.imageUrl} alt="" className="products-image-picker-preview" />
              : <ImagePlus size={21} aria-hidden="true" className="products-image-picker-icon" />}
            <span className="products-image-picker-copy">
              <strong title={image?.name || (form.imageUrl ? 'Current image' : 'Choose an image')}>{image?.name || (form.imageUrl ? 'Current image' : 'Choose an image')}</strong>
              <small>JPG, PNG or WebP · optional</small>
            </span>
            <span className="products-image-picker-button">Browse</span>
            <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose product image" onChange={e => setImage(e.target.files?.[0] || null)} />
          </label>
        </div>
        <label className="products-field products-description">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></label>
        <div className="products-form-footer"><label className="products-checkbox"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Available in shop</label><button className="products-primary-button" disabled={busy}>{busy ? 'Saving…' : editing ? 'Update product' : 'Add product'}</button></div>
      </form>
    </section>

    <section className="products-catalog-section">
      <div className="products-section-heading"><div><h2>Shop products</h2><p>{products.length} product{products.length === 1 ? '' : 's'} in this catalog</p></div></div>
      {products.length === 0 && !loadError ? <div className="products-empty">No products yet. Add the first product above.</div> : <div className="products-grid">{products.map(p => <article key={p.id} className="products-card">
        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <div className="products-image-placeholder">No product image</div>}
        <div className="products-card-body"><div className="products-card-heading"><h3>{p.name}</h3><span className={p.isActive ? 'products-status is-available' : 'products-status'}>{p.isActive ? 'Available' : 'Hidden'}</span></div><div className="products-price">{division === 'h4' ? `Sell ₹${Number(p.priceINR || 0).toLocaleString('en-IN')}` : `${p.priceCoins} FitCoins`}</div><p className="products-margin-summary">{(division === 'h4' ? p.costINR : p.costCoins) == null ? 'Cost not set · profit is not tracked' : `Cost ${division === 'h4' ? `₹${Number(p.costINR).toLocaleString('en-IN')}` : `${Number(p.costCoins).toLocaleString('en-IN')} FitCoins`} · Margin ${division === 'h4' ? `₹${Number(p.marginINR || 0).toLocaleString('en-IN')}` : `${Number(p.marginCoins || 0).toLocaleString('en-IN')} FitCoins`}`}</p><p className="products-description-copy">{p.description || 'No description provided.'}</p><small className="products-stock" aria-hidden={p.stock == null ? 'true' : undefined}>{p.stock != null ? `${p.stock} in stock` : ''}</small><div className="products-card-actions"><button type="button" className="products-secondary-button" onClick={() => edit(p)}>Edit</button><button type="button" className="products-secondary-button" onClick={() => remove(p.id)}>Hide</button><button type="button" className="products-secondary-button" onClick={() => permanentlyRemove(p)}>Delete</button></div></div>
      </article>)}</div>}
    </section>
    </>}

    {division === 'h4' && activeTab === 'register' && <section className="products-section">
      <div className="products-section-heading"><div><h2>Register an in-person purchase</h2><p>Record the member, merchandise, quantity, and payment method. Stock is adjusted automatically.</p></div></div>
      {purchaseError && <div className="products-load-error" role="alert">{purchaseError}</div>}
      <form className="products-form purchase-register-form" onSubmit={registerPurchase}>
        <label className="products-field">Find member
          <input value={memberSearch} onChange={event => { setMemberSearch(event.target.value); setSelectedMemberId(''); }} placeholder="Search name, phone, or member ID" minLength={2} required />
        </label>
        <label className="products-field">Select member
          <select value={selectedMemberId} onChange={event => setSelectedMemberId(event.target.value)} required>
            <option value="">{memberSearch.trim().length < 2 ? 'Search for a member first' : 'Choose a member'}</option>
            {memberOptions.map(member => <option key={member._id || member.id} value={member._id || member.id}>{member.name} · {member.phone}</option>)}
          </select>
        </label>
        <label className="products-field">Product
          <select value={purchaseForm.productId} onChange={event => setPurchaseForm({ ...purchaseForm, productId: event.target.value })} required>
            <option value="">Choose merchandise</option>
            {products.filter(product => product.isActive).map(product => <option key={product.id} value={product.id} disabled={!hasSavedAmount(product.costINR)}>{product.name} · ₹{Number(product.priceINR || 0).toLocaleString('en-IN')}{hasSavedAmount(product.costINR) ? '' : ' · set cost first'}</option>)}
          </select>
        </label>
        <label className="products-field">Quantity
          <input type="number" min="1" step="1" max="1000" value={purchaseForm.quantity} onChange={event => setPurchaseForm({ ...purchaseForm, quantity: event.target.value })} required />
        </label>
        <label className="products-field">Payment method
          <select value={purchaseForm.paymentMethod} onChange={event => setPurchaseForm({ ...purchaseForm, paymentMethod: event.target.value })}>
            <option>Cash</option><option>UPI</option><option>Card</option><option>Other</option>
          </select>
        </label>
        {memberSearchError && <p className="purchase-inline-error" role="alert">{memberSearchError}</p>}
        <div className="products-form-footer"><span className="purchase-form-note">Sales are saved with today’s date and included in Purchase reports.</span><button className="products-primary-button" disabled={savingPurchase || !selectedMemberId}>{savingPurchase ? 'Saving…' : 'Register purchase'}</button></div>
      </form>
    </section>}

    {canViewReports && activeTab === 'reports' && <section className="products-section">
      <div className="products-section-heading"><div><h2>{division === 'h4' ? 'Merchandise purchase report' : 'FitPass product sales report'}</h2><p>Filter {division === 'h4' ? 'H4 purchases' : 'FitPass coin purchases'} by date and product.</p></div><button type="button" className="products-secondary-button" onClick={loadPurchases} disabled={purchaseLoading}>{purchaseLoading ? 'Refreshing…' : 'Refresh report'}</button></div>
      <div className="purchase-report-filters">
        <label className="products-field">From date<input type="date" value={purchaseDateFrom} max={purchaseDateTo || undefined} onChange={event => setPurchaseDateFrom(event.target.value)} /></label>
        <label className="products-field">To date<input type="date" value={purchaseDateTo} min={purchaseDateFrom || undefined} onChange={event => setPurchaseDateTo(event.target.value)} /></label>
        <label className="products-field">Product
          <select value={purchaseProductFilter} onChange={event => setPurchaseProductFilter(event.target.value)}>
            <option value="">All products</option>
            {purchaseReportProducts.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
        <button type="button" className="products-secondary-button" onClick={() => { setPurchaseDateFrom(''); setPurchaseDateTo(''); setPurchaseProductFilter(''); }}>Reset filters</button>
      </div>
      {purchaseError && <div className="products-load-error" role="alert">{purchaseError}</div>}
      <div className="purchase-report-summary">
        <article><span>Purchases</span><strong>{purchaseOrders.length}</strong></article>
        <article><span>Units sold</span><strong>{purchaseUnits}</strong></article>
        <article><span>Net sales{division === 'h4' ? '' : ' (FitCoins)'}</span><strong>{formatReportAmount(purchaseRevenue)}</strong></article>
        <article><span>Net profit{division === 'h4' ? '' : ' (FitCoins)'}</span><strong>{formatReportAmount(purchaseProfit)}</strong></article>
      </div>
      {untrackedPurchaseCount > 0 && <p className="purchase-untracked-note" role="status">{untrackedPurchaseCount} purchase{untrackedPurchaseCount === 1 ? '' : 's'} do not have a saved cost price, so they are excluded from net profit.</p>}
      {purchaseLoading ? <div className="products-empty">Loading purchase records…</div> : purchaseOrders.length === 0 ? <div className="products-empty">No purchases match these filters.</div> : <div>
        <div className="purchase-report-charts">
          <article className="purchase-chart-card">
            <h3>Net sales and profit by date</h3>
            <div className="purchase-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyPurchaseMetrics} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: '#716b60', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#716b60', fontSize: 11 }} />
                  <Tooltip formatter={value => formatReportAmount(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="netSales" name="Net sales" stroke="#9a7412" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="netProfit" name="Net profit" stroke="#16805d" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
          <article className="purchase-chart-card">
            <h3>Net profit by product</h3>
            <div className="purchase-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productProfitMetrics} margin={{ top: 8, right: 12, left: 4, bottom: 26 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="product" tick={{ fill: '#716b60', fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={48} />
                  <YAxis tick={{ fill: '#716b60', fontSize: 11 }} />
                  <Tooltip formatter={value => formatReportAmount(value)} />
                  <Bar dataKey="netProfit" name="Net profit" fill="#16805d" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>
      </div>}
      {!purchaseLoading && purchaseOrders.length > 0 && <div className="purchase-report-table-wrap">
        <table className="purchase-report-table">
          <thead><tr><th>Purchased</th><th>Product</th><th>Member</th><th>Quantity</th><th>Net sales{division === 'h4' ? '' : ' (FitCoins)'}</th><th>Net profit{division === 'h4' ? '' : ' (FitCoins)'}</th><th>{division === 'h4' ? 'Payment' : 'Order status'}</th></tr></thead>
          <tbody>{purchaseOrders.map(order => <tr key={order.id}>
            <td>{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
            <td>{order.productName}</td>
            <td><strong>{order.member?.name || 'Member unavailable'}</strong><small>{order.member?.phone || ''}</small></td>
            <td>{order.quantity || 1}</td>
            <td>{hasSavedAmount(reportSalesValue(order)) ? formatReportAmount(reportSalesValue(order)) : 'Not tracked'}</td>
            <td>{hasSavedAmount(reportSalesValue(order)) && hasSavedAmount(reportCostValue(order)) ? formatReportAmount(Number(reportSalesValue(order)) - Number(reportCostValue(order))) : 'Not tracked'}</td>
            <td>{division === 'h4' ? order.paymentMethod || '—' : order.status || '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>}
  </main>;
}
