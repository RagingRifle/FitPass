import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Check, ChevronLeft, Coins, MapPin, Users } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';
import { useToast } from '@/hooks/useToast';

type ClassSession = { id?: string; _id?: string; name: string; type: string; trainerName?: string; gymName?: string; branchName?: string; description?: string; scheduleDate: string; startTime: string; endTime: string; maxSeats: number; seatsAvailable: number; priceCoins?: number; isAddOn?: boolean; isBooked?: boolean; isBookingClosed?: boolean };

export default function FitPassClassesScreen() {
  const router = useRouter();
  const toast = useToast();
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');

  const refresh = useCallback(async (pull = false) => {
    pull ? setRefreshing(true) : setLoading(true);
    try {
      const [classesRes, walletRes] = await Promise.all([
        API_CLIENT.get('/member-portal/classes'),
        API_CLIENT.get('/member-portal/class-wallet'),
      ]);
      setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
      setBalance(Number(walletRes.data?.balance) || 0);
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Class schedule could not be loaded.', 'error');
    } finally { setLoading(false); setRefreshing(false); }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const book = async (item: ClassSession) => {
    const id = String(item.id || item._id);
    setBusyId(id);
    try {
      const { data } = await API_CLIENT.post(`/member-portal/classes/${id}/book`);
      if (data.balance !== undefined) setBalance(data.balance);
      toast.show(data.coinsCharged ? `Booked · ${data.coinsCharged} FitCoins used.` : 'Class booked.', 'success');
      await refresh(true);
    } catch (err: any) { toast.show(err.response?.data?.message || 'Could not book this class.', 'error'); }
    finally { setBusyId(''); }
  };

  const cancel = (item: ClassSession) => {
    const id = String(item.id || item._id);
    Alert.alert('Cancel class booking?', item.isAddOn ? 'Your FitCoins will be returned while the class is still upcoming.' : 'Your reserved seat will be released.', [
      { text: 'Keep booking', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: async () => {
        setBusyId(id);
        try {
          const { data } = await API_CLIENT.delete(`/member-portal/classes/${id}/book`);
          if (data.balance !== undefined) setBalance(data.balance);
          toast.show(data.coinsRefunded ? `${data.coinsRefunded} FitCoins returned.` : 'Booking cancelled.', 'success');
          await refresh(true);
        } catch (err: any) { toast.show(err.response?.data?.message || 'Could not cancel this booking.', 'error'); }
        finally { setBusyId(''); }
      } },
    ]);
  };

  return <ScreenContainer scrollable={false} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(true)} tintColor="#4935A1" />}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}><ChevronLeft size={18} color="#4935A1" /><Text style={styles.backText}>FitPass</Text></TouchableOpacity>
      <View style={styles.hero}><View><Text style={styles.eyebrow}>PARTNER GYM SESSIONS</Text><Text style={styles.title}>Book a class</Text><Text style={styles.subtitle}>Yoga, Zumba, personal training and other coach-led sessions.</Text></View><View style={styles.coinCard}><Coins size={18} color="#E0BD42" /><Text style={styles.coinValue}>{balance.toLocaleString('en-IN')}</Text><Text style={styles.coinLabel}>FITCOINS</Text></View></View>
      {loading ? <ActivityIndicator color="#4935A1" style={{ marginTop: 50 }} /> : classes.length === 0 ? <View style={styles.empty}><Calendar size={27} color="#4935A1" /><Text style={styles.emptyTitle}>No upcoming sessions</Text><Text style={styles.emptyText}>Your partner gym has not posted a bookable class yet. Check again soon.</Text></View> : classes.map((item) => {
        const id = String(item.id || item._id);
        const price = item.isAddOn ? Number(item.priceCoins) || 0 : 0;
        const enough = balance >= price;
        return <View key={id} style={styles.card}>
          <View style={styles.cardTop}><View style={styles.typePill}><Text style={styles.typeText}>{item.type || 'CLASS'}</Text></View>{item.isBooked && <View style={styles.bookedPill}><Check size={12} color="#216344" /><Text style={styles.bookedText}>Reserved</Text></View>}</View>
          <Text style={styles.className}>{item.name}</Text>
          {item.trainerName ? <Text style={styles.coach}>Coach {item.trainerName}</Text> : null}
          <View style={styles.details}><View style={styles.detail}><Calendar size={14} color="#6655B8" /><Text style={styles.detailText}>{new Date(item.scheduleDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {item.startTime}–{item.endTime}</Text></View><View style={styles.detail}><MapPin size={14} color="#6655B8" /><Text style={styles.detailText}>{[item.gymName, item.branchName].filter(Boolean).join(' · ') || 'Partner studio'}</Text></View><View style={styles.detail}><Users size={14} color="#6655B8" /><Text style={styles.detailText}>{item.seatsAvailable} of {item.maxSeats} seats open</Text></View></View>
          {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
          <View style={styles.priceRow}><Text style={styles.priceLabel}>{price ? 'COACH-LED ADD-ON' : 'CLASS ENTRY'}</Text><Text style={styles.price}>{price ? `${price} FitCoins` : 'Included'}</Text></View>
          <TouchableOpacity disabled={busyId === id || (item.isBooked ? false : item.seatsAvailable <= 0 || item.isBookingClosed || !enough)} onPress={() => item.isBooked ? cancel(item) : book(item)} style={[styles.action, item.isBooked ? styles.cancelAction : null, !item.isBooked && (!enough || item.seatsAvailable <= 0 || item.isBookingClosed) ? styles.disabledAction : null]}>
            {busyId === id ? <ActivityIndicator color={item.isBooked ? '#A33B31' : '#FFFFFF'} /> : <Text style={[styles.actionText, item.isBooked ? styles.cancelText : null]}>{item.isBooked ? 'Cancel booking' : item.isBookingClosed ? 'Booking closed' : item.seatsAvailable <= 0 ? 'Full' : !enough ? 'Not enough FitCoins' : price ? `Reserve · ${price} FitCoins` : 'Reserve a seat'}</Text>}
          </TouchableOpacity>
        </View>;
      })}
    </ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3FB' }, content: { padding: 18, paddingBottom: 34, gap: 13 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 3 }, backText: { color: '#4935A1', fontSize: 12, fontWeight: '800' },
  hero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 17, borderRadius: 18, backgroundColor: '#241C50' }, eyebrow: { color: '#CAC2F5', fontSize: 8, letterSpacing: 1.2, fontWeight: '900' }, title: { marginTop: 5, color: '#FFFFFF', fontSize: 23, fontWeight: '900' }, subtitle: { marginTop: 5, maxWidth: 230, color: '#D0CDE0', fontSize: 10, lineHeight: 15 }, coinCard: { alignItems: 'center', justifyContent: 'center', minWidth: 75, padding: 10, borderRadius: 13, backgroundColor: '#342B69' }, coinValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 4 }, coinLabel: { marginTop: 1, color: '#CEC8F1', fontSize: 7, letterSpacing: 1, fontWeight: '900' },
  empty: { alignItems: 'center', gap: 8, padding: 25, borderRadius: 16, backgroundColor: '#FFFFFF' }, emptyTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '900' }, emptyText: { color: theme.colors.textSecondary, fontSize: 11, textAlign: 'center', lineHeight: 17 },
  card: { padding: 15, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3DFF1' }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, typePill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EFEAFF' }, typeText: { color: '#5140A0', fontSize: 9, fontWeight: '900', letterSpacing: .6 }, bookedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#E7F5EC' }, bookedText: { color: '#216344', fontSize: 9, fontWeight: '800' }, className: { marginTop: 10, color: '#201B37', fontSize: 17, fontWeight: '900' }, coach: { marginTop: 3, color: '#706B7F', fontSize: 11 }, details: { gap: 8, marginTop: 13 }, detail: { flexDirection: 'row', alignItems: 'center', gap: 7 }, detailText: { color: '#5E596D', fontSize: 10, fontWeight: '650' }, description: { marginTop: 10, color: '#777284', fontSize: 10, lineHeight: 15 }, priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#F0EEF5' }, priceLabel: { color: '#817B90', fontSize: 8, fontWeight: '900', letterSpacing: .7 }, price: { color: '#4935A1', fontSize: 12, fontWeight: '900' }, action: { minHeight: 43, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 11, backgroundColor: '#5140A0' }, actionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }, cancelAction: { backgroundColor: '#FFF1EF', borderWidth: 1, borderColor: '#F1CBC6' }, cancelText: { color: '#A33B31' }, disabledAction: { backgroundColor: '#AAA6B6' },
});
