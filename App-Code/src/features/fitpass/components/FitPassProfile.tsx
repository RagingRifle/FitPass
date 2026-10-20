import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { theme } from '@/design-system/theme';
import { fontFamilies } from '@/design-system/tokens';
import { Modal, Skeleton } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { useSessionStatus } from '../api/fitpass.api';
import { CheckInHistory } from './CheckInHistory';
import { Mail, Phone, LogOut, BadgeCheck, ChevronRight, User, Lock } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { useToast } from '@/hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { PROFILE_AVATARS, ProfileAvatarArt } from '@/components/ui/ProfileAvatarArt';

export function FitPassProfile() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const updateUserLocal = useAuth((s) => s.updateUserLocal);
  const { data: session, isLoading: isSessionLoading } = useSessionStatus();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileEmail, setProfileEmail] = useState(user?.email ?? '');
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? '');
  const [profilePassword, setProfilePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.profileImageUrl ?? '');
  const avatarChoices = PROFILE_AVATARS;

  const handleOpenEdit = () => {
    setProfileName(user?.name ?? '');
    setProfileEmail(user?.email ?? '');
    setProfilePhone(user?.phone ?? '');
    setProfilePassword('');
    setSelectedAvatar(user?.profileImageUrl ?? '');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      toast.show('Name is required', 'error');
      return;
    }
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
      await updateUserLocal({
        profileImageUrl: selectedAvatar || null,
      });
      setProfilePassword('');
      queryClient.invalidateQueries();
      toast.show(res.data?.message || 'Profile updated successfully!', 'success');
      setIsModalOpen(false);
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast.show(
        error.response?.data?.message || 'Failed to update profile.',
        'error'
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <View style={styles.headerIconWrap}>
            <User size={18} color="#171713" strokeWidth={2.5} />
          </View>
          <Text style={styles.headerTitle}>Account Profile</Text>
        </View>
      </View>

      {/* Member Pass ID Card */}
      {isSessionLoading ? (
        <View style={styles.skeletonMemberCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Skeleton width={50} height={50} borderRadius={25} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={20} borderRadius={6} />
              <Skeleton width="45%" height={14} borderRadius={4} />
            </View>
          </View>
          <View style={{ marginTop: 16, gap: 10 }}>
            <Skeleton width="80%" height={14} borderRadius={4} />
          </View>
        </View>
      ) : (
        <View style={styles.memberCard}>
          <View style={styles.memberCardTop}>
            <ProfileAvatar size={56} editable nameFallback="F" />

            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{user?.name ?? 'Member'}</Text>
              <View style={styles.verifiedChip}>
                <BadgeCheck size={12} color="#10B981" />
                <Text style={styles.verifiedChipText}>FITPASS PRO MEMBER</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Mail size={13} color="#6B7280" />
              <Text style={styles.infoText}>{user?.email ?? 'Not provided'}</Text>
            </View>
            {user?.phone ? (
              <View style={styles.infoRow}>
                <Phone size={13} color="#6B7280" />
                <Text style={styles.infoText}>{user.phone}</Text>
              </View>
            ) : null}
          </View>

          {/* Sessions Stats Meter */}
          <View style={styles.passGrid}>
            <View style={styles.passStat}>
              <Text style={styles.passStatNum}>{session?.sessionsRemaining ?? 0}</Text>
              <Text style={styles.passStatLabel}>SESSIONS LEFT</Text>
            </View>
            <View style={styles.passStatDivider} />
            <View style={styles.passStat}>
              <Text style={styles.passStatPlan}>{session?.planName ?? 'No Active Plan'}</Text>
              <Text style={[
                styles.passStatStatus,
                session?.planStatus === 'Active' && styles.passStatStatusActive
              ]}>
                {session?.planStatus === 'Active' ? 'Active Plan' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Account Settings Options List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        
        <View style={styles.settingsGroup}>
          <TouchableOpacity style={styles.settingsItem} onPress={handleOpenEdit} activeOpacity={0.7}>
            <View style={[styles.settingsIconWrap, { backgroundColor: '#FBF2D8' }]}>
              <User size={18} color="#5F4A00" />
            </View>
            <View style={styles.settingsTextWrap}>
              <Text style={styles.settingsLabel}>Edit Personal Details</Text>
              <Text style={styles.settingsSubLabel}>Update name, phone number, and email</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.settingsDivider} />

          <TouchableOpacity style={styles.settingsItem} onPress={handleOpenEdit} activeOpacity={0.7}>
            <View style={[styles.settingsIconWrap, { backgroundColor: '#F5F1E7' }]}>
              <Lock size={18} color="#171713" />
            </View>
            <View style={styles.settingsTextWrap}>
              <Text style={styles.settingsLabel}>Password & Security</Text>
              <Text style={styles.settingsSubLabel}>Change your log in credentials</Text>
            </View>
            <ChevronRight size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Attendance History Timeline Section */}
      <View style={styles.historySection}>
        <CheckInHistory />
      </View>

      {/* Logout Action Button */}
      <TouchableOpacity style={styles.logoutCard} onPress={logout} activeOpacity={0.8}>
        <LogOut size={18} color="#EF4444" />
        <Text style={styles.logoutText}>Sign Out Account</Text>
      </TouchableOpacity>

      {/* Edit Profile Modal (Premium Skeuomorphic soft card layout matching your screenshot) */}
      <Modal visible={isModalOpen} onClose={() => setIsModalOpen(false)} title="Edit Profile">
        <View style={styles.premiumModalForm}>
          <Text style={styles.premiumSubTitle}>Update your client or contact details below</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>{avatarChoices.map((avatar) => <TouchableOpacity key={avatar.url} onPress={() => setSelectedAvatar(avatar.url)} accessibilityRole="radio" accessibilityState={{ selected: selectedAvatar === avatar.url }} style={{ width: '30%', alignItems: 'center', gap: 3, borderWidth: selectedAvatar === avatar.url ? 2 : 1, borderColor: selectedAvatar === avatar.url ? theme.colors.primary : theme.colors.border, borderRadius: 13, padding: 7 }}><ProfileAvatarArt avatarUrl={avatar.url} size={48} /><Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '700' }}>{avatar.name}</Text><Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>{avatar.trait}</Text></TouchableOpacity>)}</View>
          
          <View style={styles.premiumInputGroup}>
            <Text style={styles.premiumInputLabel}>FULL NAME *</Text>
            <View style={styles.premiumInputBox}>
              <User size={16} color="#9CA3AF" style={styles.premiumInputIcon} />
              <TextInput
                value={profileName}
                onChangeText={setProfileName}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#9CA3AF"
                style={styles.premiumTextInput}
              />
            </View>
          </View>

          <View style={styles.premiumInputGroup}>
            <Text style={styles.premiumInputLabel}>CONTACT NUMBER *</Text>
            <View style={styles.premiumInputBox}>
              <Phone size={16} color="#9CA3AF" style={styles.premiumInputIcon} />
              <TextInput
                value={profilePhone}
                onChangeText={setProfilePhone}
                placeholder="10-digit mobile number"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                style={styles.premiumTextInput}
              />
            </View>
          </View>

          <View style={styles.premiumInputGroup}>
            <Text style={styles.premiumInputLabel}>EMAIL ADDRESS *</Text>
            <View style={styles.premiumInputBox}>
              <Mail size={16} color="#9CA3AF" style={styles.premiumInputIcon} />
              <TextInput
                value={profileEmail}
                onChangeText={setProfileEmail}
                placeholder="client@mail.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.premiumTextInput}
              />
            </View>
          </View>

          <View style={styles.premiumInputGroup}>
            <Text style={styles.premiumInputLabel}>NEW PASSWORD (OPTIONAL)</Text>
            <View style={styles.premiumInputBox}>
              <Lock size={16} color="#9CA3AF" style={styles.premiumInputIcon} />
              <TextInput
                value={profilePassword}
                onChangeText={setProfilePassword}
                placeholder="Leave blank to keep current"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                style={styles.premiumTextInput}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.premiumShowTextBtn}>
                <Text style={styles.premiumShowText}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Solid Black Save Changes Capsule Button */}
          <TouchableOpacity
            style={[styles.premiumSaveButton, updating && { opacity: 0.75 }]}
            onPress={handleSaveProfile}
            disabled={updating}
            activeOpacity={0.9}
          >
            <View style={styles.premiumSaveButtonContent}>
              <Lock size={14} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
              <Text style={styles.premiumSaveButtonText}>
                {updating ? 'SAVING CHANGES...' : 'SAVE CHANGES'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 100, gap: 20 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FBF2D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 20,
    fontWeight: '800',
    color: '#171713',
  },

  // Member Pass Card Redesign
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  skeletonMemberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
  },
  memberCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FBF2D8',
    borderWidth: 1.5,
    borderColor: '#F0E1A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamilies.header,
    fontSize: 22,
    fontWeight: '900',
    color: '#5F4A00',
  },
  memberName: {
    fontFamily: fontFamilies.header,
    fontSize: 18,
    fontWeight: '800',
    color: '#171713',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  verifiedChipText: {
    fontFamily: fontFamilies.header,
    fontSize: 8,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },

  infoList: { gap: 8, paddingTop: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: '#585448',
    fontWeight: '500',
  },

  passGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8F5ED',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 4,
  },
  passStat: { alignItems: 'center', gap: 3 },
  passStatNum: {
    fontFamily: fontFamilies.header,
    fontSize: 24,
    fontWeight: '900',
    color: '#171713',
  },
  passStatLabel: {
    fontFamily: fontFamilies.body,
    fontSize: 9,
    color: '#9CA3AF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  passStatDivider: { width: 1, height: 36, backgroundColor: '#E3DCCB' },
  passStatPlan: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '800',
    color: '#171713',
  },
  passStatStatus: {
    fontFamily: fontFamilies.body,
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  passStatStatusActive: {
    color: '#10B981',
  },

  // Settings Options
  section: { gap: 10 },
  sectionTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 16,
    fontWeight: '800',
    color: '#171713',
  },
  settingsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3DCCB',
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  settingsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTextWrap: { flex: 1, gap: 2 },
  settingsLabel: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '700',
    color: '#171713',
  },
  settingsSubLabel: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: '#9CA3AF',
  },
  settingsDivider: { height: 1, backgroundColor: '#F5F1E7' },

  historySection: { marginTop: 8 },

  // Logout Card
  logoutCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  logoutText: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '800',
    color: '#EF4444',
  },

  // Redesigned Edit Details UI/UX - Premium Skeuomorphic soft card layout matching your screenshot
  premiumModalForm: {
    gap: 12,
  },
  premiumSubTitle: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  premiumSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3DCCB',
    padding: 16,
    gap: 12,
  },
  premiumSectionHeader: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  premiumInputGroup: {
    gap: 6,
  },
  premiumInputLabel: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '800',
    color: '#171713',
    letterSpacing: 0.3,
  },
  premiumInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#E3DCCB',
    borderRadius: 12,
    backgroundColor: '#F8F5ED',
    paddingHorizontal: 12,
    height: 48,
  },
  premiumInputIcon: {
    marginRight: 8,
  },
  premiumTextInput: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    color: '#171713',
    height: '100%',
    padding: 0,
  },
  premiumShowTextBtn: {
    paddingHorizontal: 6,
  },
  premiumShowText: {
    fontFamily: fontFamilies.header,
    fontSize: 9,
    fontWeight: '800',
    color: '#5F4A00',
    letterSpacing: 0.5,
  },
  premiumSaveButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  premiumSaveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumSaveButtonText: {
    fontFamily: fontFamilies.header,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
});
