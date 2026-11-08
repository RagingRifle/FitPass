import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';

export default function H4Shop() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    API_CLIENT.get('/store/products?division=h4').then(({ data }) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => Alert.alert('Merchandise unavailable', 'Please try again later.'))
      .finally(() => setLoading(false));
  }, []);
  return <SafeAreaView style={styles.root}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>H4 FITNESS</Text>
    <Text style={styles.title}>H4 Merchandise</Text>
    <Text style={styles.subtitle}>Browse what’s available. Visit the front desk at your H4 gym to purchase.</Text>
    {loading ? <ActivityIndicator color={theme.colors.primary} /> : products.map(item => <View key={item.id} style={styles.card}>
      {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.image} /> : <View style={[styles.image, styles.placeholder]}><Text style={styles.muted}>Product image</Text></View>}
      <View style={styles.cardBody}><Text style={styles.name}>{item.name}</Text>{item.description ? <Text style={styles.description}>{item.description}</Text> : null}<Text style={styles.callout}>Ask at H4 to purchase</Text></View>
    </View>)}
    {!loading && !products.length && <Text style={styles.muted}>Our merchandise catalog is being updated. Check back soon.</Text>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  eyebrow: { color: theme.colors.primaryText, fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: theme.colors.text, fontSize: 28, fontWeight: '900' },
  subtitle: { color: theme.colors.textSecondary, lineHeight: 21, marginBottom: 8 },
  card: { backgroundColor: theme.colors.card, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border },
  image: { width: '100%', height: 185 },
  placeholder: { backgroundColor: theme.colors.brandLight, justifyContent: 'center', alignItems: 'center' },
  cardBody: { padding: 16, gap: 8 },
  name: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  description: { color: theme.colors.textSecondary },
  callout: { color: theme.colors.primaryText, fontWeight: '800', marginTop: 3 },
  muted: { color: theme.colors.textSecondary },
});
