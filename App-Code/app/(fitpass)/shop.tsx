import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { useSessionStatus } from '@/features/fitpass/api/fitpass.api';

type Product = { id: string; name: string; description?: string; imageUrl?: string; priceCoins: number; stock?: number | null };
type Order = { id: string; productName: string; coinsSpent: number; status: 'RECEIVED' | 'SHIPPED' | 'DELIVERED'; createdAt: string; updatedAt: string };
const ORDER_STEPS = [
  { key: 'RECEIVED', label: 'Received' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
] as const;

export default function FitPassShop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [view, setView] = useState<'shop' | 'orders'>('shop');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const { data: session, isLoading: sessionLoading, isError: sessionError, refetch: refetchSession } = useSessionStatus();

  const loadCatalog = useCallback(async () => {
    const { data } = await API_CLIENT.get('/store/products?division=fitpass');
    setProducts(Array.isArray(data) ? data : []);
  }, []);
  const loadOrders = useCallback(async () => {
    const { data } = await API_CLIENT.get('/store/orders');
    setOrders(Array.isArray(data) ? data : []);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([loadCatalog(), loadOrders()])
      .catch((requestError: any) => setError(requestError?.response?.data?.message || 'The shop could not load. Try again.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadCatalog, loadOrders]));

  useEffect(() => {
    if (view !== 'orders') return;
    const interval = setInterval(() => { loadOrders().catch(() => {}); }, 30_000);
    return () => clearInterval(interval);
  }, [view, loadOrders]);

  const buy = async (item: Product) => {
    setBusy(item.id);
    setError('');
    try {
      const { data } = await API_CLIENT.post(`/store/products/${item.id}/purchase`);
      await Promise.all([
        loadCatalog(),
        loadOrders(),
        queryClient.invalidateQueries({ queryKey: ['fitpass', 'sessionStatus'] }),
      ]);
      setView('orders');
      Alert.alert('Order received', `${item.name} is ordered. ${data.balance} FitCoins remain. You can follow its status in My orders.`);
    } catch (requestError: any) {
      const message = requestError?.response?.data?.message || 'The order could not be placed. Try again.';
      setError(message);
      Alert.alert('Order not placed', message);
    } finally {
      setBusy('');
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>FITPASS GOODS</Text>
          <Text style={styles.title}>The member shop</Text>
          <Text style={styles.subtitle}>Use FitCoins for gear and essentials. Orders are tracked here.</Text>
          <View style={styles.balanceCard}>
            <View style={styles.coinDisc}><Text style={styles.coinMark}>F</Text></View>
            <View style={styles.balanceCopy}><Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text><Text style={styles.balanceValue}>{sessionLoading ? '…' : sessionError ? '—' : session?.fitpassCoins ?? 0}<Text style={styles.balanceUnit}> FitCoins</Text></Text>{sessionError ? <Pressable onPress={() => refetchSession()}><Text style={styles.shopLink}>Tap to reload balance</Text></Pressable> : null}</View>
          </View>
        </View>

        <View style={styles.segment} accessibilityRole="tablist">
          <Pressable onPress={() => setView('shop')} style={[styles.segmentButton, view === 'shop' && styles.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: view === 'shop' }}><Text style={[styles.segmentText, view === 'shop' && styles.segmentTextActive]}>Shop</Text></Pressable>
          <Pressable onPress={() => { setView('orders'); loadOrders().catch(() => {}); }} style={[styles.segmentButton, view === 'orders' && styles.segmentActive]} accessibilityRole="tab" accessibilityState={{ selected: view === 'orders' }}><Text style={[styles.segmentText, view === 'orders' && styles.segmentTextActive]}>My orders{orders.length ? ` · ${orders.length}` : ''}</Text></Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} /> : view === 'shop' ? (
          <View style={styles.list}>
            {products.map(item => <View key={item.id} style={styles.productCard}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.productImage} /> : <View style={[styles.productImage, styles.imagePlaceholder]}><Text style={styles.muted}>FITPASS GOODS</Text></View>}
              <View style={styles.productBody}>
                <View style={styles.productHeading}><Text style={styles.productName}>{item.name}</Text><Text style={styles.price}>{item.priceCoins}<Text style={styles.priceUnit}> FC</Text></Text></View>
                {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
                {item.stock === 0 ? <Text style={styles.muted}>Out of stock</Text> : null}
                <Pressable style={[styles.buyButton, (busy === item.id || item.stock === 0) && styles.buttonDisabled]} disabled={!!busy || item.stock === 0} onPress={() => buy(item)} accessibilityRole="button" accessibilityLabel={`Buy ${item.name} for ${item.priceCoins} FitCoins`}>
                  {busy === item.id ? <ActivityIndicator color="#211b09" /> : <Text style={styles.buyText}>{item.stock === 0 ? 'Out of stock' : `Place order · ${item.priceCoins} FitCoins`}</Text>}
                </Pressable>
              </View>
            </View>)}
            {!products.length && !error && <View style={styles.empty}><Text style={styles.emptyTitle}>Nothing in the shop yet</Text><Text style={styles.muted}>New FitPass products will appear here.</Text></View>}
          </View>
        ) : (
          <View style={styles.list}>
            {orders.map(order => {
              const activeIndex = ORDER_STEPS.findIndex(step => step.key === order.status);
              return <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderTop}><View style={{ flex: 1 }}><Text style={styles.orderEyebrow}>ORDER · {order.id.slice(0, 8).toUpperCase()}</Text><Text style={styles.productName}>{order.productName}</Text></View><Text style={styles.price}>{order.coinsSpent} FC</Text></View>
                <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                <View style={styles.tracker}>{ORDER_STEPS.map((step, index) => <View key={step.key} style={styles.trackerStep}>
                  <View style={[styles.trackerDot, index <= activeIndex && styles.trackerDotActive]} />
                  {index < ORDER_STEPS.length - 1 && <View style={[styles.trackerLine, index < activeIndex && styles.trackerLineActive]} />}
                  <Text style={[styles.trackerLabel, index === activeIndex && styles.trackerLabelActive]}>{step.label}</Text>
                </View>)}</View>
                <Text style={styles.statusNote}>{order.status === 'DELIVERED' ? 'Your order has been delivered.' : order.status === 'SHIPPED' ? 'Your order is on its way.' : 'Your order has been received and is being prepared.'}</Text>
              </View>;
            })}
            {!orders.length && <View style={styles.empty}><Text style={styles.emptyTitle}>No orders yet</Text><Text style={styles.muted}>Products you order will show their delivery progress here.</Text><Pressable onPress={() => setView('shop')}><Text style={styles.shopLink}>Browse the shop →</Text></Pressable></View>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#11110F' },
  content: { padding: 20, gap: 18, paddingBottom: 120 },
  header: { paddingTop: 8, gap: 7 },
  eyebrow: { color: '#E8BC39', fontSize: 10, fontWeight: '900', letterSpacing: 2.2 },
  title: { color: '#F8F5E9', fontSize: 29, fontWeight: '900', letterSpacing: -0.8 },
  subtitle: { color: '#A8A497', fontSize: 13, lineHeight: 19, maxWidth: 310 },
  balanceCard: { marginTop: 8, padding: 15, borderRadius: 17, backgroundColor: '#1F1E19', borderWidth: 1, borderColor: '#47402A', flexDirection: 'row', alignItems: 'center', gap: 13 },
  coinDisc: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: '#E8BC39', backgroundColor: '#A97817', alignItems: 'center', justifyContent: 'center', shadowColor: '#E8BC39', shadowOpacity: 0.24, shadowRadius: 12, elevation: 5 },
  coinMark: { color: '#FFF2B9', fontSize: 22, fontWeight: '900' },
  balanceCopy: { gap: 2 }, balanceLabel: { color: '#A8A497', fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  balanceValue: { color: '#F8F5E9', fontSize: 25, fontWeight: '900' }, balanceUnit: { color: '#E8BC39', fontSize: 13, fontWeight: '800' },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 13, backgroundColor: '#1F1E19', borderWidth: 1, borderColor: '#34322B' },
  segmentButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: '#E8BC39' }, segmentText: { color: '#A8A497', fontWeight: '800', fontSize: 13 }, segmentTextActive: { color: '#211B09' },
  list: { gap: 13 },
  productCard: { backgroundColor: '#1B1A16', borderWidth: 1, borderColor: '#34322B', borderRadius: 18, overflow: 'hidden' },
  productImage: { width: '100%', height: 190 }, imagePlaceholder: { backgroundColor: '#28251C', justifyContent: 'center', alignItems: 'center' },
  productBody: { padding: 16, gap: 10 }, productHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  productName: { color: '#F8F5E9', fontSize: 17, lineHeight: 22, fontWeight: '800', flex: 1 }, price: { color: '#F0C84A', fontSize: 16, fontWeight: '900' }, priceUnit: { fontSize: 11 },
  description: { color: '#A8A497', fontSize: 12, lineHeight: 18 },
  buyButton: { backgroundColor: '#E8BC39', minHeight: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginTop: 3 }, buttonDisabled: { opacity: 0.65 }, buyText: { color: '#211B09', fontSize: 13, fontWeight: '900' },
  orderCard: { padding: 16, borderRadius: 18, backgroundColor: '#1B1A16', borderWidth: 1, borderColor: '#34322B', gap: 9 },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 12 }, orderEyebrow: { color: '#A8A497', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 }, orderDate: { color: '#A8A497', fontSize: 11 },
  tracker: { flexDirection: 'row', marginTop: 8 }, trackerStep: { flex: 1, alignItems: 'center' }, trackerDot: { width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: '#5A564A', backgroundColor: '#1B1A16' }, trackerDotActive: { backgroundColor: '#E8BC39', borderColor: '#E8BC39' }, trackerLine: { position: 'absolute', height: 2, backgroundColor: '#4A473E', left: '55%', right: '-45%', top: 5 }, trackerLineActive: { backgroundColor: '#E8BC39' }, trackerLabel: { color: '#777366', fontSize: 9, fontWeight: '700', marginTop: 6 }, trackerLabelActive: { color: '#F0C84A' },
  statusNote: { color: '#D1CCBD', fontSize: 11, marginTop: 3 }, empty: { alignItems: 'center', padding: 28, gap: 7, borderRadius: 18, borderWidth: 1, borderColor: '#34322B', backgroundColor: '#1B1A16' }, emptyTitle: { color: '#F8F5E9', fontSize: 16, fontWeight: '800', textAlign: 'center' }, muted: { color: '#A8A497', fontSize: 11 }, shopLink: { color: '#F0C84A', fontSize: 12, fontWeight: '800', marginTop: 7 }, error: { color: '#FF9A80', backgroundColor: '#321E19', padding: 12, borderRadius: 10, fontSize: 12 },
});
