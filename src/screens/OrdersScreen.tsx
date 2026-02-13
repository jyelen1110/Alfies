import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { Order, OrderStatus } from '../types';
import ItemMatchingModal, { parseUnmatchedItems } from '../components/ItemMatchingModal';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type DateRange = 'all' | 'today' | 'week' | 'month' | '3months';

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: 'All Time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last 3 Months', value: '3months' },
];

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: '#BDC3C7', text: '#2C3E50' },
  pending_approval: { label: 'Pending', bg: '#F5CBA7', text: '#7E5109' },
  approved: { label: 'Approved', bg: '#AED6F1', text: '#1B4F72' },
  sent: { label: 'Sent', bg: '#D2B4DE', text: '#4A235A' },
  delivered: { label: 'Delivered', bg: '#A9DFBF', text: '#1E8449' },
  cancelled: { label: 'Cancelled', bg: '#F5B7B1', text: '#922B21' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDateRangeStart(range: DateRange): Date | null {
  const now = new Date();
  switch (range) {
    case 'today':
      return startOfDay(now);
    case 'week': {
      const d = startOfDay(now);
      d.setDate(d.getDate() - d.getDay());
      return d;
    }
    case 'month': {
      const d = startOfDay(now);
      d.setDate(1);
      return d;
    }
    case '3months': {
      const d = startOfDay(now);
      d.setMonth(d.getMonth() - 3);
      return d;
    }
    default:
      return null;
  }
}

function formatDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function OrdersScreen() {
  const { state, updateOrderStatus, deleteOrder, getSupplierName, generateInvoice, loadAllData } = useOrders();
  const { user, isOwner, tenant } = useAuth();

  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showMatchingModal, setShowMatchingModal] = useState(false);

  // -- Filtered orders -------------------------------------------------------

  const filteredOrders = useMemo(() => {
    let result = [...state.orders];

    // Supplier filter
    if (selectedSupplier !== 'all') {
      result = result.filter((o) => o.supplier_id === selectedSupplier);
    }

    // Date range filter
    const rangeStart = getDateRangeStart(dateRange);
    if (rangeStart) {
      result = result.filter((o) => new Date(o.order_date) >= rangeStart);
    }

    // Sort newest first (already sorted from context, but ensure)
    result.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());

    return result;
  }, [state.orders, selectedSupplier, dateRange]);

  // -- Check if order already has an invoice ---------------------------------

  const orderHasInvoice = useCallback(
    (orderId: string): boolean => {
      return state.invoices.some((inv) => inv.order_id === orderId);
    },
    [state.invoices],
  );

  // -- Actions ---------------------------------------------------------------

  const handleOpenDetail = (order: Order) => {
    setSelectedOrder(order);
    // If order has unmatched items, show matching modal instead of detail modal
    const hasUnmatched = order.notes && (
      order.notes.toUpperCase().includes('UNMATCHED') ||
      order.notes.includes('⚠️')
    );
    if (hasUnmatched) {
      setShowMatchingModal(true);
    } else {
      setModalVisible(true);
    }
  };

  const handleCloseDetail = () => {
    setModalVisible(false);
    setSelectedOrder(null);
  };

  const handleDeleteOrder = (order: Order) => {
    Alert.alert('Delete Order', `Are you sure you want to delete order ${order.order_number || order.id.substring(0, 8)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setActionLoading(true);
          const success = await deleteOrder(order.id);
          setActionLoading(false);
          if (success) {
            handleCloseDetail();
          } else {
            Alert.alert('Error', 'Failed to delete order.');
          }
        },
      },
    ]);
  };

  const handlePrint = async (order: Order) => {
    const html = buildOrderHtml(order);
    try {
      await Print.printAsync({ html });
    } catch (e) {
      console.error('Print error:', e);
    }
  };

  const handleEmail = async (order: Order) => {
    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Email Unavailable', 'Mail is not configured on this device.');
      return;
    }

    const supplier = state.suppliers.find((s) => s.id === order.supplier_id);
    const subject = `Order ${order.order_number || order.id.substring(0, 8)}`;
    const body = buildOrderPlainText(order);

    await MailComposer.composeAsync({
      recipients: supplier?.orders_email ? [supplier.orders_email] : [],
      subject,
      body,
      isHtml: false,
    });
  };

  const handleGenerateInvoice = async (order: Order) => {
    setActionLoading(true);
    const invoice = await generateInvoice(order);
    setActionLoading(false);
    if (invoice) {
      Alert.alert('Invoice Generated', `Invoice ${invoice.invoice_number} has been created.`);
    } else {
      Alert.alert('Error', 'Failed to generate invoice.');
    }
  };

  const handleUploadInvoice = () => {
    // Placeholder -- would open document picker in production
    Alert.alert('Upload Invoice', 'Document picker would open here to upload a supplier invoice.');
  };

  // -- HTML / text builders --------------------------------------------------

  const buildOrderHtml = (order: Order): string => {
    const supplierName = getSupplierName(order.supplier_id);
    const rows = (order.items || [])
      .map(
        (item) =>
          `<tr>
            <td style="padding:4px 8px;border-bottom:1px solid #eee">${item.code}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee">${item.name}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${item.quantity} ${item.unit}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.unit_price)}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.quantity * item.unit_price)}</td>
          </tr>`,
      )
      .join('');

    return `
      <html><body style="font-family:Helvetica,Arial,sans-serif;padding:24px">
        <h2>Order ${order.order_number || order.id.substring(0, 8)}</h2>
        <p><strong>Date:</strong> ${formatDate(order.order_date)}</p>
        <p><strong>Supplier:</strong> ${supplierName}</p>
        <p><strong>Status:</strong> ${STATUS_CONFIG[order.status].label}</p>
        ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <thead><tr style="background:#f5f5f5">
            <th style="padding:6px 8px;text-align:left">Code</th>
            <th style="padding:6px 8px;text-align:left">Item</th>
            <th style="padding:6px 8px;text-align:right">Qty</th>
            <th style="padding:6px 8px;text-align:right">Price</th>
            <th style="padding:6px 8px;text-align:right">Total</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:16px;text-align:right">
          ${order.subtotal != null ? `<p>Subtotal: ${formatCurrency(order.subtotal)}</p>` : ''}
          ${order.tax != null ? `<p>Tax: ${formatCurrency(order.tax)}</p>` : ''}
          ${order.delivery_fee != null && order.delivery_fee > 0 ? `<p>Delivery: ${formatCurrency(order.delivery_fee)}</p>` : ''}
          <p><strong>Total: ${formatCurrency(order.total)}</strong></p>
        </div>
      </body></html>
    `;
  };

  const buildOrderPlainText = (order: Order): string => {
    const supplierName = getSupplierName(order.supplier_id);
    const itemLines = (order.items || [])
      .map((item) => `  ${item.code}  ${item.name}  x${item.quantity} ${item.unit}  @ ${formatCurrency(item.unit_price)}  = ${formatCurrency(item.quantity * item.unit_price)}`)
      .join('\n');

    return [
      `Order: ${order.order_number || order.id.substring(0, 8)}`,
      `Date: ${formatDate(order.order_date)}`,
      `Supplier: ${supplierName}`,
      `Status: ${STATUS_CONFIG[order.status].label}`,
      order.notes ? `Notes: ${order.notes}` : '',
      '',
      'Items:',
      itemLines,
      '',
      `Total: ${formatCurrency(order.total)}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  // -- Render helpers --------------------------------------------------------

  const renderOrderCard = ({ item: order }: { item: Order }) => {
    const supplierName = getSupplierName(order.supplier_id);
    const itemCount = order.items?.length ?? 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => handleOpenDetail(order)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.orderNumber}>#{order.order_number || order.id.substring(0, 8)}</Text>
          <StatusBadge status={order.status} />
        </View>

        <Text style={styles.cardDate}>{formatDate(order.order_date)}</Text>
        <Text style={styles.cardSupplier}>{supplierName}</Text>

        <View style={styles.cardFooter}>
          <Text style={styles.cardItemCount}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
          <Text style={styles.cardTotal}>{formatCurrency(order.total)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterBar = () => (
    <View style={styles.filterBar}>
      {/* Supplier picker trigger */}
      <TouchableOpacity
        style={styles.filterPicker}
        onPress={() => setSupplierPickerOpen(true)}
      >
        <Ionicons name="business-outline" size={16} color={theme.colors.textSecondary} />
        <Text style={styles.filterPickerText} numberOfLines={1}>
          {selectedSupplier === 'all' ? 'All Suppliers' : getSupplierName(selectedSupplier)}
        </Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {/* Date range pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateRangeRow}
      >
        {DATE_RANGE_OPTIONS.map((opt) => {
          const active = dateRange === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.dateRangePill, active && styles.dateRangePillActive]}
              onPress={() => setDateRange(opt.value)}
            >
              <Text style={[styles.dateRangePillText, active && styles.dateRangePillTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderResultsHeader = () => (
    <View style={styles.resultsHeader}>
      <Text style={styles.resultsCount}>
        {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
      </Text>
    </View>
  );

  // -- Supplier picker modal -------------------------------------------------

  const renderSupplierPicker = () => (
    <Modal visible={supplierPickerOpen} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlayBackdrop}
        activeOpacity={1}
        onPress={() => setSupplierPickerOpen(false)}
      >
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>Select Supplier</Text>

          <TouchableOpacity
            style={[styles.pickerOption, selectedSupplier === 'all' && styles.pickerOptionActive]}
            onPress={() => {
              setSelectedSupplier('all');
              setSupplierPickerOpen(false);
            }}
          >
            <Text
              style={[
                styles.pickerOptionText,
                selectedSupplier === 'all' && styles.pickerOptionTextActive,
              ]}
            >
              All Suppliers
            </Text>
            {selectedSupplier === 'all' && (
              <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
            )}
          </TouchableOpacity>

          <ScrollView style={styles.pickerList}>
            {state.suppliers.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.pickerOption, selectedSupplier === s.id && styles.pickerOptionActive]}
                onPress={() => {
                  setSelectedSupplier(s.id);
                  setSupplierPickerOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerOptionText,
                    selectedSupplier === s.id && styles.pickerOptionTextActive,
                  ]}
                >
                  {s.name}
                </Text>
                {selectedSupplier === s.id && (
                  <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // -- Order detail modal ----------------------------------------------------

  const renderDetailModal = () => {
    if (!selectedOrder) return null;

    const order = selectedOrder;
    const supplierName = getSupplierName(order.supplier_id);
    const canGenerateInvoice =
      (order.status === 'approved' || order.status === 'delivered') && !orderHasInvoice(order.id);
    const isDelivered = order.status === 'delivered';
    const canDelete = order.status === 'draft' || order.status === 'cancelled' || isOwner();

    return (
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCloseDetail} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              Order #{order.order_number || order.id.substring(0, 8)}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {/* Summary section */}
            <View style={styles.detailSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <StatusBadge status={order.status} />
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(order.order_date)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Supplier</Text>
                <Text style={styles.detailValue}>{supplierName}</Text>
              </View>
              {order.requested_delivery_date && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Requested Delivery</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(order.requested_delivery_date)}
                  </Text>
                </View>
              )}
              {order.actual_delivery_date && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Delivered</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(order.actual_delivery_date)}
                  </Text>
                </View>
              )}
              {order.notes ? (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={[styles.detailValue, { flex: 1 }]}>{order.notes}</Text>
                </View>
              ) : null}

            </View>

            {/* Items list */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>Items</Text>
              {(order.items || []).map((item, index) => (
                <View key={item.id || index} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCode}>{item.code}</Text>
                  </View>
                  <View style={styles.itemNumbers}>
                    <Text style={styles.itemQty}>
                      {item.quantity} {item.unit}
                    </Text>
                    <Text style={styles.itemPrice}>
                      @ {formatCurrency(item.unit_price)}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>
                    {formatCurrency(item.quantity * item.unit_price)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={styles.detailSection}>
              {order.subtotal != null && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>{formatCurrency(order.subtotal)}</Text>
                </View>
              )}
              {order.tax != null && order.tax > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tax</Text>
                  <Text style={styles.totalValue}>{formatCurrency(order.tax)}</Text>
                </View>
              )}
              {order.delivery_fee != null && order.delivery_fee > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Delivery Fee</Text>
                  <Text style={styles.totalValue}>{formatCurrency(order.delivery_fee)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(order.total)}</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.detailActions}>
              {/* Print */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handlePrint(order)}
              >
                <Ionicons name="print-outline" size={20} color={theme.colors.text} />
                <Text style={styles.actionBtnText}>Print</Text>
              </TouchableOpacity>

              {/* Email / Forward */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleEmail(order)}
              >
                <Ionicons name="mail-outline" size={20} color={theme.colors.text} />
                <Text style={styles.actionBtnText}>Email</Text>
              </TouchableOpacity>

              {/* Generate Invoice */}
              {canGenerateInvoice && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnAccent]}
                  onPress={() => handleGenerateInvoice(order)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <Ionicons name="document-text-outline" size={20} color={theme.colors.white} />
                  )}
                  <Text style={[styles.actionBtnText, styles.actionBtnTextLight]}>
                    Generate Invoice
                  </Text>
                </TouchableOpacity>
              )}

              {/* Upload Invoice (delivered orders) */}
              {isDelivered && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnOutline]}
                  onPress={handleUploadInvoice}
                >
                  <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.accent} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.accent }]}>
                    Upload Invoice
                  </Text>
                </TouchableOpacity>
              )}

              {/* Delete */}
              {canDelete && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDanger]}
                  onPress={() => handleDeleteOrder(order)}
                  disabled={actionLoading}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                  <Text style={[styles.actionBtnText, { color: theme.colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // -- Empty state -----------------------------------------------------------

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="receipt-outline" size={56} color={theme.colors.textLight} />
      <Text style={styles.emptyTitle}>No orders found</Text>
      <Text style={styles.emptySubtitle}>
        {selectedSupplier !== 'all' || dateRange !== 'all'
          ? 'Try changing your filters.'
          : 'Orders you create will appear here.'}
      </Text>
    </View>
  );

  // -- Loading state ---------------------------------------------------------

  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // -- Main render -----------------------------------------------------------

  return (
    <View style={styles.container}>
      {renderFilterBar()}
      {renderResultsHeader()}

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {renderSupplierPicker()}
      {renderDetailModal()}

      {/* Item Matching Modal */}
      {selectedOrder && tenant && (
        <ItemMatchingModal
          visible={showMatchingModal}
          order={selectedOrder}
          items={state.items}
          tenantId={tenant.id}
          onClose={() => setShowMatchingModal(false)}
          onItemsMatched={() => {
            // Reload data to get updated order
            loadAllData();
            setShowMatchingModal(false);
            setModalVisible(false);
            setSelectedOrder(null);
          }}
        />
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },

  // -- Filter bar -----------------------------------------------------------
  filterBar: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  filterPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterPickerText: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  dateRangePill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dateRangePillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  dateRangePillText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  dateRangePillTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },

  // -- Results header -------------------------------------------------------
  resultsHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  resultsCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },

  // -- List -----------------------------------------------------------------
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },

  // -- Card -----------------------------------------------------------------
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  orderNumber: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  cardDate: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  cardSupplier: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
    marginBottom: theme.spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    paddingTop: theme.spacing.sm,
  },
  cardItemCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  cardTotal: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },

  // -- Badge ----------------------------------------------------------------
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
  },
  badgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },

  // -- Supplier picker modal ------------------------------------------------
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  pickerContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxHeight: '70%',
    padding: theme.spacing.lg,
    ...theme.shadow.lg,
  },
  pickerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  pickerOptionActive: {
    backgroundColor: theme.colors.surfaceHover,
  },
  pickerOptionText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  pickerOptionTextActive: {
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.accent,
  },

  // -- Detail modal ---------------------------------------------------------
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingTop: Platform.OS === 'ios' ? theme.spacing.xxl : theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  modalCloseBtn: {
    padding: theme.spacing.xs,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },

  // -- Detail sections ------------------------------------------------------
  detailSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  matchItemsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  matchItemsButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.white,
  },
  detailLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  detailValue: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },

  // -- Item rows ------------------------------------------------------------
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  itemName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  itemCode: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  itemNumbers: {
    alignItems: 'flex-end',
    marginRight: theme.spacing.md,
  },
  itemQty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  itemPrice: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  itemTotal: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    minWidth: 64,
    textAlign: 'right',
  },

  // -- Totals ---------------------------------------------------------------
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  totalLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  totalValue: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  grandTotalLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  grandTotalValue: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },

  // -- Action buttons -------------------------------------------------------
  detailActions: {
    gap: theme.spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  actionBtnAccent: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  actionBtnOutline: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.accent,
  },
  actionBtnDanger: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.danger,
  },
  actionBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  actionBtnTextLight: {
    color: theme.colors.white,
  },

  // -- Empty state ----------------------------------------------------------
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl * 2,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
});
