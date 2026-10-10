import React from 'react';
import { StyleSheet, View, Text, Modal as RNModal, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { ChevronDown } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  fullScreen?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  fullScreen = true,
}) => {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, fullScreen && styles.fullScreenOverlay]}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modalContent, fullScreen && styles.fullScreenModalContent]}>
          <SafeAreaView style={styles.safeContainer}>
            {/* Top Grab Handle */}
            <View style={styles.dragHandleContainer}>
              <View style={styles.dragHandle} />
            </View>

            {/* Header Bar */}
            <View style={styles.header}>
              <View style={styles.headerTitleGroup}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <ChevronDown color={theme.colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Body Content */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  fullScreenOverlay: {
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxHeight: '92%',
    height: '92%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  fullScreenModalContent: {
    height: '94%',
    maxHeight: '94%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  safeContainer: {
    flex: 1,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  headerTitleGroup: {
    flex: 1,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.bgTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing['2xl'],
  },
});
