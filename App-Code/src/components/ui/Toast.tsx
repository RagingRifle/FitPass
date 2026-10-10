import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, Animated, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from '@/components/ui/app-icons';
import { fontFamilies } from '@/design-system/tokens';
import { useToast } from '@/hooks/useToast';

export const Toast: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { message, type, visible, hide } = useToast();
  const [animValue] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.spring(animValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 90,
        friction: 12,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, animValue]);

  if (!message) return null;

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 color="#16A34A" size={22} />,
          bgIcon: '#DCFCE7',
          btnBg: '#16A34A',
        };
      case 'error':
        return {
          icon: <AlertCircle color="#DC2626" size={22} />,
          bgIcon: '#FEE2E2',
          btnBg: '#DC2626',
        };
      case 'warning':
        return {
          icon: <AlertTriangle color="#D97706" size={22} />,
          bgIcon: '#FEF3C7',
          btnBg: '#D97706',
        };
      case 'info':
      default:
        return {
          icon: <Info color="#2563EB" size={22} />,
          bgIcon: '#DBEAFE',
          btnBg: '#2563EB',
        };
    }
  };

  const config = getToastConfig();

  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 0],
  });

  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  const bottomOffset = Math.max(insets.bottom + 80, 95);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.popupWrapper,
        {
          bottom: bottomOffset,
          opacity: animValue,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <View style={styles.popupCard}>
        {/* Green Tick Icon Circle */}
        <View style={[styles.iconCircle, { backgroundColor: config.bgIcon }]}>
          {config.icon}
        </View>

        {/* Message */}
        <Text style={styles.messageText} numberOfLines={2}>
          {message}
        </Text>

        {/* One Simple OK Button */}
        <TouchableOpacity
          style={[styles.okBtn, { backgroundColor: config.btnBg }]}
          onPress={hide}
          activeOpacity={0.8}
        >
          <Text style={styles.okBtnText}>OK</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  popupWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignSelf: 'center',
    maxWidth: 420,
    zIndex: 99999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  popupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageText: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 20,
  },
  okBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  okBtnText: {
    fontFamily: fontFamilies.header,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
