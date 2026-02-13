import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { Item, Order, OrderItem } from '../types';
import { supabase } from '../lib/supabase';

interface UnmatchedItem {
  name: string;
  quantity: number;
  code?: string;
}

interface ItemMatchingModalProps {
  visible: boolean;
  order: Order;
  items: Item[];
  tenantId: string;
  onClose: () => void;
  onItemsMatched: (newItems: OrderItem[]) => void;
}

// Parse unmatched items from order notes
export function parseUnmatchedItems(notes: string | undefined): UnmatchedItem[] {
  if (!notes) return [];

  // Match with or without emoji prefix (⚠️)
  const unmatchedSection = notes.match(/UNMATCHED ITEMS \((\d+)\):\s*([\s\S]*?)(?:\n\n|$)/);
  if (!unmatchedSection) return [];

  const items: UnmatchedItem[] = [];
  const content = unmatchedSection[2];

  // Split by newlines and/or bullet points (handles various Unicode bullets)
  const parts = content.split(/[\n\r]+|[•●○◦▪‣⁃]/);

  for (const part of parts) {
    // Clean up: remove leading whitespace, dashes, asterisks, bullets
    const line = part.replace(/^[\s\-\*]+/, '').trim();
    if (!line) continue;

    // Format: "ITEM NAME x5 (code)" or "ITEM NAME xQUANTITY (code)"
    const matchNew = line.match(/^(.+?)\s+x(\d+)\s*\(([^)]+)\)\s*$/);
    if (matchNew) {
      items.push({
        name: matchNew[1].trim(),
        quantity: parseInt(matchNew[2], 10),
        code: matchNew[3] === 'no code' ? undefined : matchNew[3],
      });
      continue;
    }

    // Old format without quantity: "ITEM NAME (code)"
    const matchOld = line.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (matchOld) {
      items.push({
        name: matchOld[1].trim(),
        quantity: 1, // Default to 1 if not specified
        code: matchOld[2] === 'no code' ? undefined : matchOld[2],
      });
    }
  }

  return items;
}

// Normalize name for matching
function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate similarity score between two strings
function similarityScore(a: string, b: string): number {
  const aNorm = normalizeName(a);
  const bNorm = normalizeName(b);

  if (aNorm === bNorm) return 1;

  // Check if one contains the other
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return 0.8;

  // Word overlap
  const aWords = new Set(aNorm.split(' ').filter(w => w.length > 2));
  const bWords = new Set(bNorm.split(' ').filter(w => w.length > 2));

  let overlap = 0;
  for (const word of aWords) {
    if (bWords.has(word)) overlap++;
  }

  const maxWords = Math.max(aWords.size, bWords.size);
  return maxWords > 0 ? overlap / maxWords : 0;
}

export default function ItemMatchingModal({
  visible,
  order,
  items,
  tenantId,
  onClose,
  onItemsMatched,
}: ItemMatchingModalProps) {
  const unmatchedItems = useMemo(() => parseUnmatchedItems(order.notes), [order.notes]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllItems, setShowAllItems] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showConfirmAlias, setShowConfirmAlias] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [matchedOrderItems, setMatchedOrderItems] = useState<OrderItem[]>([]);

  const currentUnmatched = unmatchedItems[currentIndex];

  // Get suggested items (sorted by similarity)
  const suggestedItems = useMemo(() => {
    if (!currentUnmatched) return [];

    const scored = items
      .filter(item => item.status === 'active')
      .map(item => ({
        item,
        score: similarityScore(currentUnmatched.name, item.name),
      }))
      .filter(({ score }) => showAllItems || score > 0.2)
      .sort((a, b) => b.score - a.score);

    return scored.map(s => s.item);
  }, [items, currentUnmatched, showAllItems]);

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return suggestedItems;

    const query = searchQuery.toLowerCase();
    return items
      .filter(item => item.status === 'active')
      .filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.sku && item.sku.toLowerCase().includes(query))
      );
  }, [items, suggestedItems, searchQuery]);

  const handleSelectItem = useCallback((item: Item) => {
    setSelectedItem(item);
    setShowConfirmAlias(true);
  }, []);

  const handleConfirmMatch = useCallback(async (saveForFuture: boolean) => {
    if (!selectedItem || !currentUnmatched) return;

    setProcessing(true);

    try {
      // Create alias if user wants to save for future
      if (saveForFuture) {
        const aliasName = normalizeName(currentUnmatched.name);

        const { error: aliasError } = await supabase
          .from('item_name_aliases')
          .upsert({
            tenant_id: tenantId,
            item_id: selectedItem.id,
            alias_name: aliasName,
            original_name: currentUnmatched.name,
          }, {
            onConflict: 'tenant_id,alias_name',
          });

        if (aliasError) {
          console.error('Error creating alias:', aliasError);
        }
      }

      // Create order item
      const newOrderItem: OrderItem = {
        order_id: order.id,
        tenant_id: tenantId,
        procurement_item_id: selectedItem.id,
        name: selectedItem.name,
        quantity: currentUnmatched.quantity,
        unit: 'each',
        unit_price: selectedItem.wholesale_price || 0,
        total: (selectedItem.wholesale_price || 0) * currentUnmatched.quantity,
        xero_item_code: selectedItem.xero_item_code || undefined,
        xero_account_code: selectedItem.xero_account_code || undefined,
      };

      // Add to database
      const { data: insertedItem, error: insertError } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          tenant_id: tenantId,
          procurement_item_id: selectedItem.id,
          name: selectedItem.name,
          quantity: currentUnmatched.quantity,
          unit: 'each',
          unit_price: selectedItem.wholesale_price || 0,
          total: (selectedItem.wholesale_price || 0) * currentUnmatched.quantity,
          xero_item_code: selectedItem.xero_item_code,
          xero_account_code: selectedItem.xero_account_code,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Update order totals
      const newSubtotal = (order.subtotal || 0) + newOrderItem.total!;
      const taxRate = selectedItem.tax_rate || 10;
      const itemTax = (newOrderItem.total! * taxRate) / 100;
      const newTax = (order.tax || 0) + itemTax;
      const newTotal = newSubtotal + newTax;

      await supabase
        .from('orders')
        .update({
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal,
        })
        .eq('id', order.id);

      // Track matched items
      setMatchedOrderItems(prev => [...prev, { ...newOrderItem, id: insertedItem.id }]);

      // Move to next item or finish
      setShowConfirmAlias(false);
      setSelectedItem(null);
      setSearchQuery('');
      setShowAllItems(false);

      if (currentIndex < unmatchedItems.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // All done - update notes to remove matched items
        const updatedNotes = order.notes?.replace(
          /⚠️ UNMATCHED ITEMS \(\d+\):[\s\S]*?(?=\n\n|$)/,
          ''
        ).trim();

        await supabase
          .from('orders')
          .update({ notes: updatedNotes || null })
          .eq('id', order.id);

        onItemsMatched(matchedOrderItems);
        onClose();

        const message = `Successfully matched ${unmatchedItems.length} item${unmatchedItems.length > 1 ? 's' : ''}`;
        if (Platform.OS === 'web') {
          window.alert(message);
        } else {
          Alert.alert('Items Matched', message);
        }
      }
    } catch (error: any) {
      console.error('Error matching item:', error);
      const errorMsg = error.message || 'Failed to match item';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert('Error', errorMsg);
      }
    } finally {
      setProcessing(false);
    }
  }, [selectedItem, currentUnmatched, currentIndex, unmatchedItems, order, tenantId, matchedOrderItems, onItemsMatched, onClose]);

  const handleSkip = useCallback(() => {
    if (currentIndex < unmatchedItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSearchQuery('');
      setShowAllItems(false);
    } else {
      onItemsMatched(matchedOrderItems);
      onClose();
    }
  }, [currentIndex, unmatchedItems.length, matchedOrderItems, onItemsMatched, onClose]);

  const handleClose = useCallback(() => {
    // Reset state
    setCurrentIndex(0);
    setSearchQuery('');
    setShowAllItems(false);
    setSelectedItem(null);
    setShowConfirmAlias(false);
    setMatchedOrderItems([]);
    onClose();
  }, [onClose]);

  // Show debug info if no items parsed
  if (unmatchedItems.length === 0) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.title}>Match Items</Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={{ padding: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>
                Could not parse unmatched items from notes:
              </Text>
              <Text style={{ fontSize: 14, color: '#666', backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8 }}>
                {order.notes || '(no notes)'}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={{ marginTop: 20, backgroundColor: theme.colors.primary, padding: 15, borderRadius: 8, alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={() => handleSelectItem(item)}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemDetails}>
          {item.sku && `SKU: ${item.sku} • `}
          ${item.wholesale_price?.toFixed(2) || '0.00'}
          {item.category && ` • ${item.category}`}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Match Items</Text>
            <Text style={styles.progress}>{currentIndex + 1}/{unmatchedItems.length}</Text>
          </View>

          {/* Current unmatched item */}
          {currentUnmatched && (
            <View style={styles.unmatchedCard}>
              <Text style={styles.unmatchedLabel}>Unmatched Item from Order:</Text>
              <Text style={styles.unmatchedName}>{currentUnmatched.name}</Text>
              <View style={styles.unmatchedMeta}>
                <Text style={styles.unmatchedQty}>Qty: {currentUnmatched.quantity}</Text>
                {currentUnmatched.code && (
                  <Text style={styles.unmatchedCode}>Code: {currentUnmatched.code}</Text>
                )}
              </View>
            </View>
          )}

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.colors.textMuted}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Show all toggle */}
          <TouchableOpacity
            style={styles.showAllToggle}
            onPress={() => setShowAllItems(!showAllItems)}
          >
            <Ionicons
              name={showAllItems ? 'checkbox' : 'square-outline'}
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.showAllText}>Show all products</Text>
          </TouchableOpacity>

          {/* Item list */}
          <FlatList
            data={filteredItems}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={48} color={theme.colors.border} />
                <Text style={styles.emptyText}>No matching products found</Text>
                <Text style={styles.emptySubtext}>Try enabling "Show all products"</Text>
              </View>
            }
          />

          {/* Skip button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Skip this item</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Confirm alias modal */}
      <Modal visible={showConfirmAlias} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            {processing ? (
              <ActivityIndicator size="large" color={theme.colors.accent} />
            ) : (
              <>
                <Text style={styles.confirmTitle}>Match Confirmed</Text>
                <Text style={styles.confirmText}>
                  "{currentUnmatched?.name}" will be matched to:
                </Text>
                <Text style={styles.confirmItemName}>{selectedItem?.name}</Text>
                <Text style={styles.confirmQty}>
                  Quantity: {currentUnmatched?.quantity} @ ${selectedItem?.wholesale_price?.toFixed(2) || '0.00'} each
                </Text>

                <Text style={styles.confirmQuestion}>
                  Save this match for future orders?
                </Text>

                <View style={styles.confirmButtons}>
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.confirmButtonSecondary]}
                    onPress={() => handleConfirmMatch(false)}
                  >
                    <Text style={styles.confirmButtonTextSecondary}>Just this time</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmButton, styles.confirmButtonPrimary]}
                    onPress={() => handleConfirmMatch(true)}
                  >
                    <Text style={styles.confirmButtonTextPrimary}>Yes, remember</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '90%',
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  progress: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  unmatchedCard: {
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warning + '20',
    borderRadius: theme.borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning,
  },
  unmatchedLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  unmatchedName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  unmatchedMeta: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  unmatchedQty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
  },
  unmatchedCode: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    marginHorizontal: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  showAllToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  showAllText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: 2,
  },
  itemDetails: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  footer: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  skipButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
  },
  // Confirm modal
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  confirmCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  confirmText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  confirmItemName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
    textAlign: 'center',
    marginVertical: theme.spacing.sm,
  },
  confirmQty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  confirmQuestion: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  confirmButtonSecondary: {
    backgroundColor: theme.colors.background,
  },
  confirmButtonPrimary: {
    backgroundColor: theme.colors.accent,
  },
  confirmButtonTextSecondary: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
  },
  confirmButtonTextPrimary: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.white,
  },
});
