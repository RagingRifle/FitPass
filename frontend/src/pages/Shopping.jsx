import { useEffect, useState, useContext } from 'react';
import API from '../services/api';
import { useToast } from '../components/ui/Toast';
import { AuthContext } from '../context/AuthContext';

const H4_GYMS = ['05a08fdf-7427-48a5-8b25-e18d5a5668cd', '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d'];

export default function Shopping() {
  const { user } = useContext(AuthContext);
  const toast = useToast();
  const gymId = user?.gymId?._id || user?.gymId?.id || user?.gymId;
  const isH4 = (user?.gymName || user?.gymId?.name || '').toUpperCase() === 'H4' || H4_GYMS.includes(gymId);
  const division = isH4 ? 'h4' : 'fitpass';
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState('');
  const load = async () => { const { data } = await API.get(`/store/products?division=${division}`); setProducts(data); };
  useEffect(() => { load().catch(() => toast.error('Could not load the shop.')); }, [division]);
  const buy = async (product) => {
    setBusy(product.id);
    try { const { data } = await API.post(`/store/products/${product.id}/purchase`); toast.success(`Order placed. ${data.balance} coins remaining.`); await load(); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not place your order.'); }
    finally { setBusy(''); }
  };
  return <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
    <h1>{isH4 ? 'H4 Merchandise' : 'FitPass Shop'}</h1>
    <p style={{ color: '#666' }}>{isH4 ? 'Browse H4 merchandise. Ask at the front desk to purchase.' : 'Use your FitCoins for member products.'}</p>
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 18, marginTop: 24 }}>{products.map(p => <article key={p.id} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 18px #0000000c' }}>
      {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: 190, objectFit: 'cover' }} /> : <div style={{ height: 190, background: '#f4f1e8', display: 'grid', placeItems: 'center', color: '#888' }}>Product image</div>}
      <div style={{ padding: 18 }}><h3 style={{ margin: 0 }}>{p.name}</h3><p style={{ color: '#777', minHeight: 40 }}>{p.description}</p>{isH4 ? <b>Ask at H4 to purchase</b> : <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b>{p.priceCoins} FitCoins</b><button disabled={busy === p.id} onClick={() => buy(p)} style={{ padding: '10px 15px', border: 0, borderRadius: 9, background: '#ffe340', fontWeight: 750, cursor: 'pointer' }}>{busy === p.id ? 'Ordering…' : 'Buy'}</button></div>}</div>
    </article>)}</section>
    {products.length === 0 && <p>The catalog is being updated. Check back soon.</p>}
  </main>;
}
