import { useEffect, useState } from 'react';
import API from '../services/api';
import { useToast } from '../components/ui/Toast';

const empty = { name: '', description: '', priceCoins: 12, imageUrl: '', division: 'fitpass', isActive: true, stock: '' };

export default function Products() {
  const user = JSON.parse(sessionStorage.getItem('user') || 'null');
  const isFitPassAdmin = user?.role === 'fitpass_admin';
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [division, setDivision] = useState('fitpass');
  const [form, setForm] = useState(empty);
  const [image, setImage] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [coinsPerSession, setCoinsPerSession] = useState(10);
  const [savingRate, setSavingRate] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    try {
      const { data } = await API.get(`/store/products?division=${division}`);
      setProducts(Array.isArray(data) ? data : []);
      setLoadError('');
    } catch {
      setLoadError('Could not load products. Check that the store API and database schema are up to date.');
    }
  };

  useEffect(() => {
    load();
    API.get(`/store/coin-settings?division=${division}`).then(({ data }) => setCoinsPerSession(data.coinsPerSession)).catch(() => {});
  }, [division]);

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
      const body = new FormData();
      Object.entries({ ...form, division, priceCoins: division === 'h4' ? 0 : form.priceCoins }).forEach(([key, value]) => body.append(key, value));
      if (image) body.append('image', image);
      await API({ method: editing ? 'put' : 'post', url: editing ? `/store/products/${editing}` : '/store/products', data: body, headers: { 'Content-Type': 'multipart/form-data' } });
      setForm({ ...empty, division }); setImage(null); setEditing(null); await load(); toast.success('Product saved.');
    } catch (error) { toast.error(error.response?.data?.message || 'Could not save product.'); }
    finally { setBusy(false); }
  };

  const edit = (product) => { setEditing(product.id); setForm({ ...product, stock: product.stock ?? '' }); setImage(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cancelEdit = () => { setEditing(null); setImage(null); setForm({ ...empty, division }); };
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
  const field = (key, label, type = 'text') => <label className="products-field">{label}<input required={key === 'name' || key === 'priceCoins'} type={type} min={type === 'number' ? 0 : undefined} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>;

  return <main className="products-page">
    <header className="products-header">
      <div><p className="products-eyebrow">STORE MANAGEMENT</p><h1>{isFitPassAdmin ? 'FitPass Product Catalog' : division === 'h4' ? 'H4 Merchandise' : 'Products & FitCoins'}</h1><p>{isFitPassAdmin ? 'Create products, set FitCoin prices, and publish them to the FitPass app and member shop.' : division === 'h4' ? 'Show H4 members available merchandise. Purchases happen in person at an H4 gym.' : 'Manage FitPass products and FitCoin prices.'}</p></div>
      {!isFitPassAdmin && <div className="products-tabs">{['fitpass', 'h4'].map(d => <button key={d} type="button" onClick={() => { setDivision(d); setForm({ ...empty, division: d }); setEditing(null); }} className={division === d ? 'is-active' : ''}>{d === 'h4' ? 'H4' : 'FitPass'} shop</button>)}</div>}
    </header>

    {loadError && <div className="products-load-error" role="alert">{loadError}</div>}

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
        {field('stock', 'Stock (optional)', 'number')}
        <label className="products-field">{editing ? 'Replace product image' : 'Product image'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImage(e.target.files?.[0] || null)} />{editing && form.imageUrl && !image && <img src={form.imageUrl} alt={`${form.name} current product`} style={{ display: 'block', width: 120, height: 90, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}{image && <small>{image.name}</small>}</label>
        <label className="products-field products-description">Description<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></label>
        <div className="products-form-footer"><label className="products-checkbox"><input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Available in shop</label><button className="products-primary-button" disabled={busy}>{busy ? 'Saving…' : editing ? 'Update product' : 'Add product'}</button></div>
      </form>
    </section>

    <section className="products-catalog-section">
      <div className="products-section-heading"><div><h2>Shop products</h2><p>{products.length} product{products.length === 1 ? '' : 's'} in this catalog</p></div></div>
      {products.length === 0 && !loadError ? <div className="products-empty">No products yet. Add the first product above.</div> : <div className="products-grid">{products.map(p => <article key={p.id} className="products-card">
        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : <div className="products-image-placeholder">No product image</div>}
        <div className="products-card-body"><div className="products-card-heading"><h3>{p.name}</h3><span className={p.isActive ? 'products-status is-available' : 'products-status'}>{p.isActive ? 'Available' : 'Hidden'}</span></div><div className="products-price">{division === 'h4' ? 'Available at H4' : `${p.priceCoins} FitCoins`}</div><p className="products-description-copy">{p.description || 'No description provided.'}</p>{p.stock != null && <small className="products-stock">{p.stock} in stock</small>}<div className="products-card-actions"><button type="button" className="products-secondary-button" onClick={() => edit(p)}>Edit</button><button type="button" className="products-secondary-button" onClick={() => remove(p.id)}>Hide</button><button type="button" className="products-secondary-button" onClick={() => permanentlyRemove(p)}>Delete</button></div></div>
      </article>)}</div>}
    </section>
  </main>;
}
