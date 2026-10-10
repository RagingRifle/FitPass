import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { API_CLIENT } from '@/lib/api-client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { theme } from '@/design-system/theme';
import { Camera } from '@/components/ui/app-icons';

type Props = { size?: number; editable?: boolean; nameFallback?: string };

export function ProfileAvatar({ size = 48, editable = false, nameFallback = 'U' }: Props) {
  const user = useAuth((state) => state.user);
  const updateUserLocal = useAuth((state) => state.updateUserLocal);
  const [uploading, setUploading] = useState(false);
  const radius = size / 2;

  const choosePhoto = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow photo library access to choose a profile picture.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.78,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const body = new FormData();
    if (Platform.OS === 'web' && asset.file) {
      body.append('profileImage', asset.file, asset.fileName || 'fitprime-profile.jpg');
    } else {
      body.append('profileImage', {
        uri: asset.uri,
        name: asset.fileName || 'fitprime-profile.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as any);
    }

    setUploading(true);
    try {
      const response = await API_CLIENT.put('/auth/profile/image', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      await updateUserLocal({ profileImageUrl: response.data.profileImageUrl });
    } catch (error: any) {
      Alert.alert('Could not update photo', error.response?.data?.message || 'Please try again in a moment.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={editable ? 0.78 : 1}
      disabled={!editable || uploading}
      onPress={choosePhoto}
      accessibilityRole={editable ? 'button' : undefined}
      accessibilityLabel={editable ? 'Change profile picture' : 'Profile picture'}
      style={[styles.avatar, { width: size, height: size, borderRadius: radius }]}
    >
      {user?.profileImageUrl ? (
        <Image source={{ uri: user.profileImageUrl }} style={{ width: size, height: size, borderRadius: radius }} />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{(user?.name?.[0] || nameFallback).toUpperCase()}</Text>
      )}
      {editable && (
        <View style={[styles.editBadge, { width: Math.max(20, size * 0.38), height: Math.max(20, size * 0.38), borderRadius: size }]}>
          {uploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Camera size={size * 0.19} color="#FFFFFF" />}
        </View>
      )}
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
  initial: { color: theme.colors.primary, fontWeight: '800' },
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
