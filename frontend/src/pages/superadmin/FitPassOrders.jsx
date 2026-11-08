import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, RefreshCw, ShoppingBag } from 'lucide-react';
import API from '../../services/api';

const STEPS = ['RECEIVED', 'SHIPPED', 'DELIVERED'];
const label = status => ({ RECEIVED: 'Order received', SHIPPED: 'Shipped', DELIVERED: 'Delivered' }[status] || status);

export default function FitPassOrders() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/superadmin/fitpass/orders');
      setOrders(Array.isArray(data) ? data : []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load FitPass orders.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const visibleOrders = useMemo(() => orders.filter(order => {
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [order.productName, order.member?.name, order.member?.email, order.member?.phone, order.id].some(value => String(value || '').toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  }), [orders, statusFilter, search]);

  const updateStatus = async (order, status) => {
    setBusyId(order.id);
    setError('');
    try {
      const { data } = await API.patch(`/superadmin/fitpass/orders/${order.id}`, { status });
      setOrders(current => current.map(item => item.id === order.id ? { ...item, ...data } : item));
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update the order status.');
    } finally { setBusyId(''); }
  };

  const receivedCount = orders.filter(order => order.status === 'RECEIVED').length;
  const shippedCount = orders.filter(order => order.status === 'SHIPPED').length;
  const deliveredCount = orders.filter(order => order.status === 'DELIVERED').length;

  return <main style={{ minHeight: '100vh', padding: '30px clamp(18px, 3vw, 42px)', background: '#f7f5ef', color: '#24211b' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
      <div><span style={{ color: '#8d6b00', fontSize: 12, fontWeight: 800, letterSpacing: '.12em' }}>FITPASS STORE</span><h1 style={{ margin: '8px 0', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 850 }}>Product orders</h1><p style={{ margin: 0, color: '#716b60' }}>Review purchases and keep members up to date as orders move.</p></div>
      <button type="button" onClick={load} disabled={loading} style={buttonStyle}><RefreshCw size={16} /> Refresh orders</button>
    </header>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 22 }}>
      {[[ShoppingBag, orders.length, 'Total orders'], [PackageCheck, receivedCount, 'Needs processing'], [PackageCheck, shippedCount, 'In transit'], [PackageCheck, deliveredCount, 'Delivered']].map(([Icon, value, title]) => <article key={title} style={statStyle}><Icon size={18} color="#9a7412" /><strong style={{ fontSize: 25 }}>{value}</strong><span style={{ color: '#716b60', fontSize: 12 }}>{title}</span></article>)}
    </section>

    {error && <div role="alert" style={{ marginBottom: 16, padding: 13, borderRadius: 12, background: '#fff1ed', color: '#9e321f' }}>{error}</div>}

    <section style={{ background: '#fff', border: '1px solid #e4dccb', borderRadius: 16, overflow: 'hidden', boxShadow: '0 8px 22px rgba(49,40,20,.04)' }}>
      <div style={{ display: 'flex', gap: 12, padding: 16, flexWrap: 'wrap', borderBottom: '1px solid #eee8dc' }}>
        <input aria-label="Search orders" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search member or product" style={inputStyle} />
        <select aria-label="Filter by status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={inputStyle}><option value="ALL">All statuses</option>{STEPS.map(status => <option key={status} value={status}>{label(status)}</option>)}</select>
      </div>
      {loading ? <div style={{ padding: 30, color: '#716b60' }}>Loading orders…</div> : visibleOrders.length === 0 ? <div style={{ padding: 38, textAlign: 'center' }}><ShoppingBag size={28} color="#a79e8d" /><h2 style={{ margin: '10px 0 4px', fontSize: 18 }}>No orders to show</h2><p style={{ margin: 0, color: '#716b60' }}>New FitPass purchases will appear here.</p></div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
        <thead><tr>{['Product / order', 'Member', 'FitCoins', 'Placed', 'Status'].map(title => <th key={title} style={thStyle}>{title}</th>)}</tr></thead>
        <tbody>{visibleOrders.map(order => <tr key={order.id}>
          <td style={tdStyle}><strong>{order.productName}</strong><small style={{ display: 'block', color: '#8a8376', marginTop: 4 }}>#{order.id.slice(0, 8).toUpperCase()}</small></td>
          <td style={tdStyle}><strong>{order.member?.name || 'Member'}</strong><small style={{ display: 'block', color: '#8a8376', marginTop: 4 }}>{order.member?.email || order.member?.phone || 'Contact unavailable'}</small></td>
          <td style={tdStyle}><strong>{order.coinsSpent}</strong></td>
          <td style={tdStyle}>{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
          <td style={tdStyle}><select aria-label={`Update status for ${order.productName}`} disabled={busyId === order.id} value={order.status} onChange={event => updateStatus(order, event.target.value)} style={{ ...inputStyle, minWidth: 155, padding: '8px 10px' }}>{STEPS.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </main>;
}

const buttonStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #e4dccb', background: '#fff', borderRadius: 10, padding: '11px 14px', fontWeight: 750, cursor: 'pointer' };
const statStyle = { background: '#fff', border: '1px solid #e4dccb', borderRadius: 14, padding: 15, display: 'grid', gap: 6, boxShadow: '0 4px 12px rgba(49,40,20,.03)' };
const inputStyle = { border: '1px solid #dfd6c5', borderRadius: 9, background: '#fff', padding: '10px 12px', minWidth: 180, color: '#24211b' };
const thStyle = { padding: '13px 15px', textAlign: 'left', color: '#777064', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', background: '#fbfaf7', borderBottom: '1px solid #eee8dc' };
const tdStyle = { padding: '14px 15px', borderBottom: '1px solid #f0ece4', fontSize: 13, verticalAlign: 'middle' };
