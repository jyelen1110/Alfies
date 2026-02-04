import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { CartItem, Supplier, formatCutoffTime } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_ABBR_TO_INDEX: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/**
 * Return the next N available delivery dates.
 * All dates from tomorrow onwards are available.
 */
function getAvailableDeliveryDates(_supplier: Supplier, count = 14): Date[] {
  const dates: Date[] = [];
  const cursor = new Date();
  // Start from tomorrow
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(0, 0, 0, 0);

  while (dates.length < count) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function formatDate(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Types for section list
// ---------------------------------------------------------------------------

interface SupplierSection {
  supplier: Supplier;
  data: CartItem[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CartScreen() {
  const navigation = useNavigation();
  const { state, updateCartQuantity, removeFromCart, clearCart, createOrder, getSupplierName } =
    useOrders();
  const { user, tenant, isOwner } = useAuth();

  const { cart, suppliers } = state;

  // Per-supplier state
  const [deliveryDates, setDeliveryDates] = useState<Record<string, Date>>({});
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});

  // Modals
  const [datePickerSupplier, setDatePickerSupplier] = useState<string | null>(null);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    supplierName: string;
    orderNumber?: string;
    isApproved: boolean;
  } | null>(null);
  const [placingOrder, setPlacingOrder] = useState<string | null>(null);

  // ---- Sections ----------------------------------------------------------

  const sections: SupplierSection[] = useMemo(() => {
    const grouped: Record<string, CartItem[]> = {};
    for (const cartItem of cart) {
      const sid = cartItem.item.supplier_id;
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push(cartItem);
    }
    return Object.entries(grouped)
      .map(([supplierId, items]) => {
        const supplier = suppliers.find((s) => s.id === supplierId);
        if (!supplier) return null;
        return { supplier, data: items };
      })
      .filter(Boolean) as SupplierSection[];
  }, [cart, suppliers]);

  // ---- Per-supplier calculations -----------------------------------------

  const getSubtotal = useCallback(
    (items: CartItem[]) =>
      items.reduce((sum, ci) => sum + ci.item.wholesale_price * ci.quantity, 0),
    [],
  );

  const getGST = useCallback(
    (items: CartItem[]) =>
      items.reduce((sum, ci) => {
        const rate = ci.item.tax_rate ?? (tenant?.settings?.tax_rate || 0);
        return sum + ci.item.wholesale_price * ci.quantity * (rate / 100);
      }, 0),
    [tenant],
  );

  const getDeliveryFee = useCallback(
    (supplier: Supplier, subtotal: number) => {
      if (supplier.free_delivery_min && subtotal >= supplier.free_delivery_min) return 0;
      return supplier.delivery_fee;
    },
    [],
  );

  // ---- Handlers ----------------------------------------------------------

  const handleQuantityChange = useCallback(
    (itemId: string, delta: number, current: number) => {
      const next = current + delta;
      if (next <= 0) {
        Alert.alert('Remove item', 'Remove this item from your cart?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(itemId) },
        ]);
        return;
      }
      updateCartQuantity(itemId, next);
    },
    [updateCartQuantity, removeFromCart],
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      Alert.alert('Remove item', 'Remove this item from your cart?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(itemId) },
      ]);
    },
    [removeFromCart],
  );

  const handleSelectDate = useCallback((supplierId: string, date: Date) => {
    setDeliveryDates((prev) => ({ ...prev, [supplierId]: date }));
    setDatePickerSupplier(null);
  }, []);

  const handlePlaceOrder = useCallback(
    async (section: SupplierSection) => {
      const { supplier, data: items } = section;
      const subtotal = getSubtotal(items);

      if (subtotal < supplier.min_order) {
        Alert.alert(
          'Minimum order not met',
          `The minimum order for ${supplier.name} is ${formatCurrency(supplier.min_order)}. Your current subtotal is ${formatCurrency(subtotal)}.`,
        );
        return;
      }

      const selectedDate = deliveryDates[supplier.id];
      if (!selectedDate) {
        Alert.alert('Select delivery date', 'Please select a delivery date before placing the order.');
        return;
      }

      setPlacingOrder(supplier.id);

      try {
        const gst = getGST(items);
        const deliveryFee = getDeliveryFee(supplier, subtotal);
        const total = subtotal + gst + deliveryFee;

        const orderItems = items.map((ci) => ({
          code: ci.item.barcode || ci.item.sku || '',
          name: ci.item.name,
          quantity: ci.quantity,
          unit: ci.item.size || 'each',
          unit_price: ci.item.wholesale_price,
          total: ci.item.wholesale_price * ci.quantity,
        }));

        const order = await createOrder({
          supplier_id: supplier.id,
          order_date: new Date().toISOString().split('T')[0],
          requested_delivery_date: formatDateISO(selectedDate),
          subtotal,
          tax: gst,
          delivery_fee: deliveryFee,
          total,
          status: 'draft', // createOrder will override based on role
          notes: orderNotes[supplier.id] || undefined,
          items: orderItems,
        });

        if (order) {
          await clearCart(supplier.id);
          setDeliveryDates((prev) => {
            const next = { ...prev };
            delete next[supplier.id];
            return next;
          });
          setOrderNotes((prev) => {
            const next = { ...prev };
            delete next[supplier.id];
            return next;
          });
          setConfirmationData({
            supplierName: supplier.name,
            orderNumber: order.order_number || order.id.substring(0, 8).toUpperCase(),
            isApproved: isOwner(),
          });
          setConfirmationVisible(true);
        } else {
          Alert.alert('Error', 'Failed to create order. Please try again.');
        }
      } catch (err) {
        console.error('Error placing order:', err);
        Alert.alert('Error', 'An unexpected error occurred while placing the order.');
      } finally {
        setPlacingOrder(null);
      }
    },
    [
      deliveryDates,
      orderNotes,
      getSubtotal,
      getGST,
      getDeliveryFee,
      createOrder,
      clearCart,
      isOwner,
    ],
  );

  // ---- Renderers ---------------------------------------------------------

  const renderItem = useCallback(
    ({ item }: { item: CartItem }) => {
      const lineTotal = item.item.wholesale_price * item.quantity;
      return (
        <View style={styles.itemRow}>
          {item.item.image_url ? (
            <Image source={{ uri: item.item.image_url }} style={styles.itemImage} />
          ) : (
            <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
              <Ionicons name="cube-outline" size={24} color={theme.colors.textMuted} />
            </View>
          )}

          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.item.name}
            </Text>
            {item.item.barcode && <Text style={styles.itemCode}>{item.item.barcode}</Text>}
            <Text style={styles.itemPrice}>
              {formatCurrency(item.item.wholesale_price)}{item.item.size ? ` / ${item.item.size}` : ''}
            </Text>
          </View>

          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.item_id, -1, item.quantity)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="remove" size={18} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.item_id, 1, item.quantity)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add" size={18} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.lineTotal}>{formatCurrency(lineTotal)}</Text>

          <TouchableOpacity
            onPress={() => handleRemoveItem(item.item_id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.removeButton}
          >
            <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      );
    },
    [handleQuantityChange, handleRemoveItem],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SupplierSection }) => {
      const { supplier } = section;
      const selectedDate = deliveryDates[supplier.id];
      const availableDates = getAvailableDeliveryDates(supplier);

      return (
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderTop}>
            <View style={styles.supplierInfo}>
              <Ionicons name="storefront-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.supplierName}>{supplier.name}</Text>
            </View>
            <View style={styles.cutoffBadge}>
              <Ionicons name="time-outline" size={14} color={theme.colors.warning} />
              <Text style={styles.cutoffText}>
                Cutoff {formatCutoffTime(supplier.cutoff_time)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.datePickerButton}
            onPress={() => setDatePickerSupplier(supplier.id)}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.colors.accent} />
            <Text style={styles.datePickerText}>
              {selectedDate ? formatDate(selectedDate) : 'Select delivery date'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      );
    },
    [deliveryDates],
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: SupplierSection }) => {
      const { supplier, data: items } = section;
      const subtotal = getSubtotal(items);
      const gst = getGST(items);
      const deliveryFee = getDeliveryFee(supplier, subtotal);
      const total = subtotal + gst + deliveryFee;
      const belowMinimum = subtotal < supplier.min_order;
      const isPlacing = placingOrder === supplier.id;

      // Free delivery progress
      let freeDeliveryHint: string | null = null;
      if (supplier.free_delivery_min && subtotal < supplier.free_delivery_min && supplier.delivery_fee > 0) {
        const remaining = supplier.free_delivery_min - subtotal;
        freeDeliveryHint = `Add ${formatCurrency(remaining)} more for free delivery`;
      }
      if (supplier.free_delivery_min && subtotal >= supplier.free_delivery_min && supplier.delivery_fee > 0) {
        freeDeliveryHint = 'Free delivery applied!';
      }

      return (
        <View style={styles.sectionFooter}>
          {/* Order notes */}
          <View style={styles.notesContainer}>
            <Text style={styles.notesLabel}>Order notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes for this supplier..."
              placeholderTextColor={theme.colors.textLight}
              value={orderNotes[supplier.id] || ''}
              onChangeText={(text) =>
                setOrderNotes((prev) => ({ ...prev, [supplier.id]: text }))
              }
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Minimum order warning */}
          {belowMinimum && (
            <View style={styles.warningBanner}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.warning} />
              <Text style={styles.warningText}>
                Minimum order is {formatCurrency(supplier.min_order)} (need{' '}
                {formatCurrency(supplier.min_order - subtotal)} more)
              </Text>
            </View>
          )}

          {/* Free delivery hint */}
          {freeDeliveryHint && (
            <View
              style={[
                styles.freeDeliveryHint,
                deliveryFee === 0 && supplier.free_delivery_min
                  ? styles.freeDeliveryHintSuccess
                  : null,
              ]}
            >
              <Ionicons
                name={deliveryFee === 0 && supplier.free_delivery_min ? 'checkmark-circle' : 'bicycle-outline'}
                size={16}
                color={
                  deliveryFee === 0 && supplier.free_delivery_min
                    ? theme.colors.success
                    : theme.colors.accent
                }
              />
              <Text
                style={[
                  styles.freeDeliveryText,
                  deliveryFee === 0 && supplier.free_delivery_min
                    ? styles.freeDeliveryTextSuccess
                    : null,
                ]}
              >
                {freeDeliveryHint}
              </Text>
            </View>
          )}

          {/* Totals */}
          <View style={styles.totalsContainer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST</Text>
              <Text style={styles.totalValue}>{formatCurrency(gst)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery</Text>
              <Text
                style={[
                  styles.totalValue,
                  deliveryFee === 0 && supplier.free_delivery_min
                    ? { color: theme.colors.success }
                    : null,
                ]}
              >
                {deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.totalRowGrand]}>
              <Text style={styles.totalLabelGrand}>Total</Text>
              <Text style={styles.totalValueGrand}>{formatCurrency(total)}</Text>
            </View>
          </View>

          {/* Place order button */}
          <TouchableOpacity
            style={[
              styles.placeOrderButton,
              (belowMinimum || isPlacing) && styles.placeOrderButtonDisabled,
            ]}
            onPress={() => handlePlaceOrder(section)}
            disabled={belowMinimum || isPlacing}
            activeOpacity={0.7}
          >
            {isPlacing ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.white} />
                <Text style={styles.placeOrderText}>Place Order</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [
      orderNotes,
      placingOrder,
      getSubtotal,
      getGST,
      getDeliveryFee,
      handlePlaceOrder,
    ],
  );

  // ---- Empty state -------------------------------------------------------

  if (cart.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={80} color={theme.colors.textLight} />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>
          Browse products and add items to get started.
        </Text>
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.browseButtonText}>Browse Products</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- Date picker modal data --------------------------------------------

  const datePickerSupplierObj = datePickerSupplier
    ? suppliers.find((s) => s.id === datePickerSupplier) || null
    : null;
  const datePickerDates = datePickerSupplierObj
    ? getAvailableDeliveryDates(datePickerSupplierObj)
    : [];

  // ---- Render ------------------------------------------------------------

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader as any}
        renderSectionFooter={renderSectionFooter as any}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        showsVerticalScrollIndicator={false}
      />

      {/* Delivery date picker modal */}
      <Modal
        visible={datePickerSupplier !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDatePickerSupplier(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Delivery Date</Text>
              <TouchableOpacity onPress={() => setDatePickerSupplier(null)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            {datePickerSupplierObj && (
              <Text style={styles.modalSubtitle}>
                {datePickerSupplierObj.name} delivers on{' '}
                {datePickerSupplierObj.delivery_days
                  .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
                  .join(', ')}
              </Text>
            )}
            <FlatList
              data={datePickerDates}
              keyExtractor={(item) => item.toISOString()}
              renderItem={({ item: date }) => {
                const isSelected =
                  datePickerSupplier &&
                  deliveryDates[datePickerSupplier] &&
                  formatDateISO(deliveryDates[datePickerSupplier]) === formatDateISO(date);
                return (
                  <TouchableOpacity
                    style={[styles.dateOption, isSelected && styles.dateOptionSelected]}
                    onPress={() => handleSelectDate(datePickerSupplier!, date)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={isSelected ? theme.colors.accent : theme.colors.textMuted}
                    />
                    <Text
                      style={[styles.dateOptionText, isSelected && styles.dateOptionTextSelected]}
                    >
                      {formatDate(date)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.noDateText}>
                  No available delivery dates found. Please contact the supplier.
                </Text>
              }
              style={styles.dateList}
            />
          </View>
        </View>
      </Modal>

      {/* Order confirmation modal */}
      <Modal
        visible={confirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmationVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <View style={styles.confirmationIconWrapper}>
              <Ionicons
                name="checkmark-circle"
                size={64}
                color={theme.colors.success}
              />
            </View>
            <Text style={styles.confirmationTitle}>
              {confirmationData?.isApproved ? 'Order Confirmed' : 'Order Submitted'}
            </Text>
            <Text style={styles.confirmationMessage}>
              {confirmationData?.isApproved
                ? `Your order has been confirmed and will be processed.`
                : `Your order has been sent to Alfie's Food Co for approval.`}
            </Text>
            {confirmationData?.orderNumber && (
              <Text style={styles.confirmationOrderNumber}>
                Order #{confirmationData.orderNumber}
              </Text>
            )}
            <TouchableOpacity
              style={styles.confirmationButton}
              onPress={() => {
                setConfirmationVisible(false);
                setConfirmationData(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.confirmationButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  listContent: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },

  // ---- Section header ----------------------------------------------------
  sectionHeader: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  sectionHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  supplierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  supplierName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  cutoffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.borderLight,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  cutoffText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.borderLight,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  datePickerText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },

  // ---- Cart item row -----------------------------------------------------
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
  },
  itemImagePlaceholder: {
    backgroundColor: theme.colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  itemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  itemCode: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },

  // ---- Quantity controls -------------------------------------------------
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.borderLight,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
  },
  quantityButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    minWidth: 24,
    textAlign: 'center',
  },
  lineTotal: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    minWidth: 56,
    textAlign: 'right',
    marginRight: theme.spacing.sm,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },

  // ---- Section footer ----------------------------------------------------
  sectionFooter: {
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: theme.borderRadius.lg,
    borderBottomRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },

  // ---- Notes -------------------------------------------------------------
  notesContainer: {
    marginBottom: theme.spacing.md,
  },
  notesLabel: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    minHeight: 48,
    textAlignVertical: 'top',
  },

  // ---- Warnings and hints ------------------------------------------------
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: '#FEF3E2',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  warningText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.warning,
    flex: 1,
  },
  freeDeliveryHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  freeDeliveryHintSuccess: {},
  freeDeliveryText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.accent,
  },
  freeDeliveryTextSuccess: {
    color: theme.colors.success,
  },

  // ---- Totals ------------------------------------------------------------
  totalsContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  totalValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  totalRowGrand: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  totalLabelGrand: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  totalValueGrand: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },

  // ---- Place order button ------------------------------------------------
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadow.md,
  },
  placeOrderButtonDisabled: {
    backgroundColor: theme.colors.textLight,
    ...theme.shadow.sm,
  },
  placeOrderText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.white,
  },

  // ---- Section separator -------------------------------------------------
  sectionSeparator: {
    height: theme.spacing.md,
  },

  // ---- Empty state -------------------------------------------------------
  emptyContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 20,
  },
  browseButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.lg,
  },
  browseButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.white,
  },

  // ---- Modals (shared) ---------------------------------------------------
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  dateList: {
    maxHeight: 400,
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  dateOptionSelected: {
    backgroundColor: theme.colors.surfaceHover,
  },
  dateOptionText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  dateOptionTextSelected: {
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.accent,
  },
  noDateText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  },

  // ---- Confirmation modal ------------------------------------------------
  confirmationModal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  confirmationIconWrapper: {
    marginBottom: theme.spacing.md,
  },
  confirmationTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  confirmationMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  confirmationOrderNumber: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  confirmationButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    width: '100%',
    alignItems: 'center',
  },
  confirmationButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.white,
  },
});
