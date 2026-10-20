import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_CLIENT } from '@/lib/api-client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { theme } from '@/design-system/theme';
import { Sparkles } from '@/components/ui/app-icons';
import { PROFILE_AVATARS, ProfileAvatarArt } from '@/components/ui/ProfileAvatarArt';

type Props = { size?: number; editable?: boolean; nameFallback?: string };

export function ProfileAvatar({ size = 48, editable = false, nameFallback = 'U' }: Props) {
  const user = useAuth((state) => state.user);
  const updateUserLocal = useAuth((state) => state.updateUserLocal);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.profileImageUrl || '');
  const radius = size / 2;

  const chooseAvatar = async () => {
    if (!PROFILE_AVATARS.some((avatar) => avatar.url === selectedAvatar)) {
      Alert.alert('Choose an avatar', 'Select one of the six avatars first.');
      return;
    }
    setUploading(true);
    try {
      await API_CLIENT.put('/member-portal/profile', { avatarUrl: selectedAvatar });
      await updateUserLocal({ profileImageUrl: selectedAvatar });
      setPickerOpen(false);
    } catch (error: any) {
      Alert.alert('Could not update avatar', error.response?.data?.message || 'Please try again in a moment.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={editable ? 0.78 : 1}
      disabled={!editable || uploading}
      onPress={() => { setSelectedAvatar(user?.profileImageUrl || ''); setPickerOpen(true); }}
      accessibilityRole={editable ? 'button' : undefined}
      accessibilityLabel={editable ? 'Choose profile avatar' : 'Profile picture'}
      style={[styles.avatar, { width: size, height: size, borderRadius: radius }]}
    >
      {PROFILE_AVATARS.some((avatar) => avatar.url === user?.profileImageUrl) ? (
        <ProfileAvatarArt avatarUrl={user!.profileImageUrl!} size={size} />
      ) : user?.profileImageUrl ? (
        <Image source={{ uri: user.profileImageUrl }} style={{ width: size, height: size, borderRadius: radius }} />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{(user?.name?.[0] || nameFallback).toUpperCase()}</Text>
      )}
      {editable && (
        <View style={[styles.editBadge, { width: Math.max(20, size * 0.38), height: Math.max(20, size * 0.38), borderRadius: size }]}>
                  {uploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Sparkles size={size * 0.19} color="#FFFFFF" />}
        </View>
      )}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.scrim}>
          <View style={styles.picker}>
            <Text style={styles.title}>Choose your avatar</Text>
            <Text style={styles.subtitle}>Pick a character that feels like you.</Text>
            <View style={styles.grid}>
              {PROFILE_AVATARS.map((avatar) => (
                <TouchableOpacity
                  key={avatar.url}
                  onPress={() => setSelectedAvatar(avatar.url)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedAvatar === avatar.url }}
                  style={[styles.option, selectedAvatar === avatar.url && styles.optionSelected]}
                >
                  <ProfileAvatarArt avatarUrl={avatar.url} size={58} />
                  <Text style={styles.avatarName}>{avatar.name}</Text>
                  <Text style={styles.trait}>{avatar.trait}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setPickerOpen(false)} disabled={uploading}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={chooseAvatar} disabled={uploading}>
                {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Use avatar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  avatar: {
    position: 'relative',
    overflow: 'visible',
    backgroundColor: theme.colors.brandLight,
    borderColor: theme.colors.card,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: theme.colors.primaryText, fontWeight: '800' },
  scrim: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(12, 19, 24, 0.68)' },
  picker: { width: '100%', maxWidth: 440, alignSelf: 'center', padding: 20, borderRadius: 22, backgroundColor: theme.colors.card },
  title: { color: theme.colors.text, fontSize: 21, fontWeight: '800' },
  subtitle: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'center' },
  option: { width: '31%', minWidth: 88, alignItems: 'center', paddingVertical: 9, borderRadius: 14, borderWidth: 2, borderColor: theme.colors.border, backgroundColor: theme.colors.background },
  optionSelected: { borderColor: theme.colors.primary },
  avatarName: { color: theme.colors.text, fontSize: 13, fontWeight: '800', marginTop: 5 },
  trait: { color: theme.colors.textMuted, fontSize: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  cancelText: { color: theme.colors.text, fontWeight: '700' },
  saveButton: { flex: 1.3, alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 12, backgroundColor: theme.colors.primary, minHeight: 48 },
  saveText: { color: '#FFFFFF', fontWeight: '800' },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },
});
