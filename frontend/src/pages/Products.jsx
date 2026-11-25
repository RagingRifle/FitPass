import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import API from '../services/api';
import { useToast } from '../components/ui/Toast';
import { AuthContext } from '../context/AuthContext';
import { ImagePlus } from 'lucide-react';

const empty = { name: '', description: '', priceCoins: 12, priceINR: '', imageUrl: '', division: 'fitpass', isActive: true, stock: '' };

export default function Products() {
  const { activeDivision } = useContext(AuthContext);
  const user = JSON.parse(sessionStorage.getItem('user') || 'null');
  const isFitPassAdmin = user?.role === 'fitpass_admin';
  const isH4Admin = user?.role === 'h4_admin';
  const isH4GymAdmin = user?.role === 'admin' && (String(user?.gymName || '').toUpperCase() === 'H4' || ['05a08fdf-7427-48a5-8b25-e18d5a5668cd', '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d'].includes(String(user?.gymId?._id || user?.gymId || '')));
  const fixedDivision = isFitPassAdmin ? 'fitpass' : (isH4Admin || isH4GymAdmin) ? 'h4' : null;
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [imagePreview, setImagePreview] = useState('');
  const imageInput = useRef(null);
  const [division, setDivision] = useState(fixedDivision || activeDivision || 'fitpass');
  const [form, setForm] = useState(empty);
  const [image, setImage] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [coinsPerSession, setCoinsPerSession] = useState(10);
  const [savingRate, setSavingRate] = useState(false);
  const [loadError, setLoadError] = useState('');

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

  useEffect(() => {
    load();
    API.get(`/store/coin-settings?division=${division}`).then(({ data }) => setCoinsPerSession(data.coinsPerSession)).catch(() => {});
  }, [division, load]);

  useEffect(() => {
    if (!fixedDivision && activeDivision && activeDivision !== division) {
      setDivision(activeDivision);
      setForm({ ...empty, division: activeDivision });
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
      const payload = { ...form, division, priceCoins: division === 'h4' ? 0 : Number(form.priceCoins), priceINR: division === 'h4' ? Number(form.priceINR) : null };
      const body = new FormData();
      Object.entries(payload).forEach(([key, value]) => body.append(key, String(value ?? '')));
      if (image) body.append('image', image);
      await API({
        method: editing ? 'put' : 'post',
        url: editing ? `/store/products/${editing}` : '/store/products',
        data: image ? body : payload,
        // Let the browser/Axios add the multipart boundary when uploading a file.
      });
      setForm({ ...empty, division }); setImage(null); setEditing(null);
      if (imageInput.current) imageInput.current.value = '';
      await load(); toast.success('Product saved.');
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save product.'); }
    finally { setBusy(false); }
  };

  const edit = (product) => {
    setEditing(product.id);
    setForm({ ...product, stock: product.stock ?? '' });
    setImage(null);
    if (imageInput.current) imageInput.current.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelEdit = () => {
    setEditing(null);
    setImage(null);
    setForm({ ...empty, division });
    if (imageInput.current) imageInput.current.value = '';
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

  return <main className="products-page">
    <header className="products-header">
      <div><p className="products-eyebrow">STORE MANAGEMENT</p><h1>{division === 'h4' ? 'H4 Merchandise' : 'FitPass Product Catalog'}</h1><p>{division === 'h4' ? 'Show H4 members available merchandise. Purchases happen in person at an H4 gym.' : 'Create products, set FitCoin prices, and publish them to the FitPass app and member shop.'}</p></div>
    </header>

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
        {division !== 'h4' && field('priceCoins', 'Price (FitCoins)', 'number')}
        {division === 'h4' && field('priceINR', 'Cost (INR)', 'number')}
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
        <div className="products-card-body"><div className="products-card-heading"><h3>{p.name}</h3><span className={p.isActive ? 'products-status is-available' : 'products-status'}>{p.isActive ? 'Available' : 'Hidden'}</span></div><div className="products-price">{division === 'h4' ? `₹${Number(p.priceINR || 0).toLocaleString('en-IN')}` : `${p.priceCoins} FitCoins`}</div><p className="products-description-copy">{p.description || 'No description provided.'}</p>{p.stock != null && <small className="products-stock">{p.stock} in stock</small>}<div className="products-card-actions"><button type="button" className="products-secondary-button" onClick={() => edit(p)}>Edit</button><button type="button" className="products-secondary-button" onClick={() => remove(p.id)}>Hide</button><button type="button" className="products-secondary-button" onClick={() => permanentlyRemove(p)}>Delete</button></div></div>
      </article>)}</div>}
    </section>
  </main>;
}
