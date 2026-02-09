import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { Tenant } from '../types';

export default function BusinessSwitcher() {
  const { isMaster, allTenants, tenant, switchTenant } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);

  if (!isMaster() || allTenants.length === 0) {
    return null;
  }

  const handleSelect = async (selectedTenant: Tenant) => {
    await switchTenant(selectedTenant.id);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.switcherButton}
        onPress={() => setModalVisible(true)}
      >
        <Ionicons name="business-outline" size={18} color={theme.colors.accent} />
        <Text style={styles.currentBusiness} numberOfLines={1}>
          {tenant?.name || 'Select Business'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Switch Business</Text>
            <View style={styles.closeButton} />
          </View>

          <FlatList
            data={allTenants}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.tenantRow,
                  item.id === tenant?.id && styles.tenantRowActive,
                ]}
                onPress={() => handleSelect(item)}
              >
                <View style={styles.tenantInfo}>
                  <Text style={styles.tenantName}>{item.name}</Text>
                  <Text style={styles.tenantSlug}>{item.slug}</Text>
                </View>
                {item.id === tenant?.id && (
                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  switcherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  currentBusiness: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  listContent: {
    padding: theme.spacing.md,
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
  },
  tenantRowActive: {
    backgroundColor: theme.colors.backgroundLight,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  tenantInfo: {
    flex: 1,
  },
  tenantName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  tenantSlug: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  separator: {
    height: theme.spacing.sm,
  },
});
