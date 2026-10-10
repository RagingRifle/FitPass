import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { ChevronDown, Check } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';

interface Option {
  label: string;
  value: string | number;
}

interface SelectProps {
  label: string;
  options: Option[];
  value: string | number;
  onValueChange: (value: string | number) => void;
  placeholder?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  value,
  onValueChange,
  placeholder = 'Select option',
  error,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (val: string | number) => {
    onValueChange(val);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={[
          styles.trigger,
          { borderColor: error ? theme.colors.error : theme.colors.border },
        ]}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.triggerText,
            { color: selectedOption ? theme.colors.text : theme.colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <ChevronDown color={theme.colors.textSecondary} size={20} />
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.closeBtn}>Close</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <TouchableOpacity
                    style={[
                      styles.optionItem,
                      isSelected && { backgroundColor: theme.colors.brandLight },
                    ]}
                    onPress={() => handleSelect(item.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: isSelected ? theme.colors.primary : theme.colors.text,
                          fontWeight: isSelected ? '700' : '400',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && <Check color={theme.colors.primary} size={18} />}
                  </TouchableOpacity>
                );
              }}
              style={styles.optionsList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  label: {
    ...theme.typography.bodySm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  trigger: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    backgroundColor: theme.colors.bgTertiary,
    paddingHorizontal: theme.spacing.md,
  },
  triggerText: {
    ...theme.typography.bodySm,
    flex: 1,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.bgTertiary,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    maxHeight: '60%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  closeBtn: {
    ...theme.typography.bodySm,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  optionsList: {
    paddingVertical: theme.spacing.sm,
  },
  optionItem: {
    height: 54, // min tap target 44px
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
  },
  optionText: {
    ...theme.typography.bodySm,
  },
});
