import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { theme } from '@/design-system/theme';
import { Badge, Input, Modal, Button } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { useH4Plan, useH4Payments } from '../api/h4.api';
import {
  Mail, Phone, Edit3, CreditCard, ChevronRight, LogOut, ShieldCheck,
} from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { H4TopHeader } from './H4TopHeader';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { PROFILE_AVATARS, ProfileAvatarArt } from '@/components/ui/ProfileAvatarArt';

//  Section Block helper 
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>{children}</View>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.row, !last && [styles.rowBorder, { borderBottomColor: theme.colors.border }]]}>
      <Text style={[styles.rowLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      {typeof value === 'string' ? <Text style={[styles.rowValue, { color: theme.colors.text }]}>{value}</Text> : value}
    </View>
  );
}

import { useToast } from '@/hooks/useToast';

//  Main Component 
export function H4Profile() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const updateUserLocal = useAuth((s) => s.updateUserLocal);
  const { data: plan } = useH4Plan();
  const { data: paymentsData } = useH4Payments();
  const toast = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? '');
  const [profilePassword, setProfilePassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.profileImageUrl ?? '');
  const avatarChoices = PROFILE_AVATARS;

  const handleOpenEdit = () => {
    setProfileName(user?.name ?? '');
    setProfileEmail(user?.email ?? '');
    setProfilePhone(user?.phone ?? '');
    setProfilePassword('');
    setSelectedAvatar(user?.profileImageUrl ?? '');
    setIsModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) { toast.show('Name is required', 'error'); return; }
    if (profilePassword && profilePassword.trim().length < 6) {
      toast.show('New password must be at least 6 characters', 'error');
      return;
    }
    setUpdating(true);
    try {
      const res = await API_CLIENT.put('/member-portal/profile', {
        password: profilePassword || undefined,
        avatarUrl: selectedAvatar || null,
      });
      await updateUserLocal({ profileImageUrl: selectedAvatar || null });
      setProfilePassword('');
      toast.show(res.data?.message || 'Profile and password updated successfully!', 'success');
      setIsModalOpen(false);
    } catch (error: any) {
      toast.show(error.response?.data?.message || 'Failed to update profile.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const payments = paymentsData?.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <H4TopHeader title="Athlete Profile" />
      <ScrollView style={[styles.root, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/*  Avatar + Name  */}
      <View style={styles.profileHead}>
        <ProfileAvatar size={58} editable nameFallback="H" />
        <View style={styles.profileHeadInfo}>
          <Text style={[styles.profileName, { color: theme.colors.text }]}>{user?.name ?? ''}</Text>
          <View style={styles.memberBadge}>
            <ShieldCheck size={13} color={theme.colors.primaryText} />
            <Text style={styles.memberBadgeText}>H4 Member</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={handleOpenEdit} activeOpacity={0.7}>
          <Edit3 size={16} color={theme.colors.primaryText} />
        </TouchableOpacity>
      </View>

      {/*  Contact Info  */}
      <Section title="Contact">
        <Row label="Email" value={
          <View style={styles.iconVal}>
            <Mail size={13} color={theme.colors.textMuted} />
            <Text style={[styles.rowValue, { color: theme.colors.text }]}>{user?.email ?? ''}</Text>
          </View>
        } />
        <Row label="Phone" last value={
          <View style={styles.iconVal}>
            <Phone size={13} color={theme.colors.textMuted} />
            <Text style={[styles.rowValue, { color: theme.colors.text }]}>{user?.phone ?? ''}</Text>
          </View>
        } />
      </Section>

      {/*  Membership  */}
      <Section title="Membership">
        <Row label="Plan" value={plan?.planName ?? ''} />
        <Row label="Status" value={
          <Badge
            label={plan?.status ?? 'Unknown'}
            variant={plan?.status === 'Active' ? 'active' : 'expired'}
          />
        } />
        <Row label="Valid Until" last value={
          plan?.expiryDate
            ? new Date(plan.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
            : ''
        } />
      </Section>

      {/*  Payment History  */}
      <Section title="Payment History">
        {payments.length === 0 ? (
          <View style={styles.emptyRow}>
            <CreditCard size={20} color={theme.colors.textMuted} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No payment records found.</Text>
          </View>
        ) : (
          payments.slice(0, 5).map((p: any, i: number) => (
            <View key={p.id ?? i} style={[styles.row, i < payments.length - 1 && i < 4 && [styles.rowBorder, { borderBottomColor: theme.colors.border }]]}>
              <View>
                <Text style={[styles.payDate, { color: theme.colors.text }]}>
                  {p.date
                    ? new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : ''}
                </Text>
                <Text style={[styles.rowLabel, { color: theme.colors.textSecondary }]}>{p.description ?? 'Membership Payment'}</Text>
              </View>
              <View style={styles.payRight}>
                <Text style={[styles.payAmt, { color: theme.colors.text }]}>INR {p.amount}</Text>
                <View style={[styles.payStatus, { backgroundColor: p.status === 'Paid' ? 'rgba(46,125,50,0.1)' : 'rgba(198,40,40,0.1)' }]}>
                  <Text style={[styles.payStatusText, { color: p.status === 'Paid' ? '#2E7D32' : '#C62828' }]}>
                    {p.status ?? 'Paid'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </Section>

      {/*  App Settings  */}
      <Section title="Settings">
<TouchableOpacity
          style={styles.row}
          onPress={() => Alert.alert('Logout', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
          ])}
          activeOpacity={0.7}
        >
          <View style={styles.iconVal}>
            <LogOut size={16} color={theme.colors.error} />
            <Text style={[styles.rowValue, { color: theme.colors.error }]}>Logout</Text>
          </View>
          <ChevronRight size={16} color={theme.colors.error} />
        </TouchableOpacity>
      </Section>

      {/*  Edit Profile Modal  */}
      <Modal visible={isModalOpen} onClose={() => setIsModalOpen(false)} title="Edit Profile">
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>{avatarChoices.map((avatar) => <TouchableOpacity key={avatar.url} onPress={() => setSelectedAvatar(avatar.url)} accessibilityRole="radio" accessibilityState={{ selected: selectedAvatar === avatar.url }} style={{ width: '30%', alignItems: 'center', gap: 3, borderWidth: selectedAvatar === avatar.url ? 2 : 1, borderColor: selectedAvatar === avatar.url ? theme.colors.primary : theme.colors.border, borderRadius: 13, padding: 7 }}><ProfileAvatarArt avatarUrl={avatar.url} size={48} /><Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '700' }}>{avatar.name}</Text><Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>{avatar.trait}</Text></TouchableOpacity>)}</View>
          <Input label="Name" value={profileName} onChangeText={setProfileName} placeholder="Your name" />
          <Input label="Email" value={profileEmail} onChangeText={setProfileEmail} placeholder="Email address" keyboardType="email-address" />
          <Input label="Phone" value={profilePhone} onChangeText={setProfilePhone} placeholder="Phone number" keyboardType="phone-pad" />
          <Input label="New Password (optional)" value={profilePassword} onChangeText={setProfilePassword} placeholder="Leave blank to keep current" secureTextEntry />
          <Button title="Save Profile" onPress={handleSaveProfile} loading={updating} style={{ marginTop: 4 }} />
        </View>
      </Modal>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 18, paddingBottom: 100, gap: 20 },

  // Profile head
  profileHead: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingBottom: 4,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(254,223,30,0.12)',
    borderWidth: 2, borderColor: 'rgba(254,223,30,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#735B00' },
  profileHeadInfo: { flex: 1, gap: 4 },
  profileName: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  memberBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: 'rgba(254,223,30,0.1)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(254,223,30,0.25)',
  },
  memberBadgeText: { fontSize: 11, fontWeight: '700', color: '#735B00' },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },

  // Section
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionCard: { borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', overflow: 'hidden' },

  // Row
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  rowLabel: { fontSize: 13, color: '#64748B' },
  rowValue: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  iconVal: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Payment
  payDate: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  payRight: { alignItems: 'flex-end', gap: 4 },
  payAmt: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  payStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  payStatusText: { fontSize: 11, fontWeight: '700' },

  // Empty
  emptyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 20, justifyContent: 'center',
  },
  emptyText: { fontSize: 13, color: '#64748B' },
});
