import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Print functionality uses Xero PDFs only - no local HTML generation
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useOrders } from '../context/OrderContext';
import { theme } from '../theme';
import { getXeroInvoicePDF } from '../services/xero';
import { supabase } from '../lib/supabase';
import type { Invoice, InvoiceItem } from '../types';

type ExportStatus = 'pending' | 'not_exported' | 'exported' | 'export_failed';
type PaymentStatus = 'pending_payment' | 'paid';

const EXPORT_STATUS_CONFIG: Record<ExportStatus, { label: string; bg: string; text: string; icon: string }> = {
  pending: { label: 'Processing', bg: '#E3F2FD', text: theme.colors.info, icon: 'hourglass-outline' },
  not_exported: { label: 'Not Exported', bg: '#F5F5F5', text: theme.colors.textMuted, icon: 'cloud-outline' },
  exported: { label: 'Exported', bg: '#E8F8EF', text: theme.colors.success, icon: 'checkmark-circle' },
  export_failed: { label: 'Export Failed', bg: '#FDEDED', text: theme.colors.error, icon: 'alert-circle' },
};

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; bg: string; text: string; icon: string }> = {
  pending_payment: { label: 'Pending Payment', bg: '#FEF3E2', text: theme.colors.warning, icon: 'time-outline' },
  paid: { label: 'Paid', bg: '#E8F8EF', text: theme.colors.success, icon: 'checkmark-circle' },
};

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ExportStatusBadge({ status }: { status: ExportStatus }) {
  const config = EXPORT_STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Ionicons name={config.icon as any} size={12} color={config.text} />
      <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = PAYMENT_STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Ionicons name={config.icon as any} size={12} color={config.text} />
      <Text style={[styles.badgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}


export default function InvoicesScreen() {
  const { state, exportToXero, getSupplierName, loadInvoices } = useOrders();
  const { invoices, suppliers } = state;

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [supplierFilterOpen, setSupplierFilterOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Update selectedInvoice when invoices change (after export)
  React.useEffect(() => {
    if (selectedInvoice) {
      const updated = invoices.find(i => i.id === selectedInvoice.id);
      if (updated) {
        setSelectedInvoice(updated);
      }
    }
  }, [invoices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  }, [loadInvoices]);

  const filteredInvoices = useMemo(() => {
    // Filter by archived status first
    let filtered = invoices.filter((inv) =>
      showArchived ? inv.is_archived === true : inv.is_archived !== true
    );
    // Then filter by supplier if selected
    if (selectedSupplier) {
      filtered = filtered.filter((inv) => inv.supplier_id === selectedSupplier);
    }
    return filtered;
  }, [invoices, selectedSupplier, showArchived]);

  const archivedCount = useMemo(() =>
    invoices.filter((inv) => inv.is_archived === true).length
  , [invoices]);

  const openDetail = useCallback((invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setModalVisible(true);
  }, []);

  const closeDetail = useCallback(() => {
    setModalVisible(false);
    setSelectedInvoice(null);
  }, []);

  const showMessage = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }, []);

  const handleExport = useCallback(
    async (invoiceId: string) => {
      try {
        setExporting(invoiceId);
        await exportToXero(invoiceId);
        // Refresh selected invoice with updated data from context
        // exportToXero already calls loadInvoices, so we need to get fresh data
        showMessage('Success', 'Invoice exported to Xero successfully.');
      } catch (err: any) {
        showMessage('Export Failed', err?.message ?? 'Could not export invoice to Xero.');
      } finally {
        setExporting(null);
      }
    },
    [exportToXero, showMessage]
  );

  const handlePrint = useCallback(
    async (invoice: Invoice) => {
      // Only allow printing if invoice has been exported to Xero
      if (!invoice.xero_invoice_id) {
        showMessage('Cannot Print', 'Invoice must be exported to Xero before printing.');
        return;
      }

      setPrinting(true);
      console.log('=== Print Invoice (Xero PDF) ===');
      console.log('Invoice ID:', invoice.id);
      console.log('Xero Invoice ID:', invoice.xero_invoice_id);
      console.log('PDF Storage Path:', invoice.pdf_storage_path);

      try {
        let pdfBase64: string | null = null;

        // Try 1: Use stored PDF from Supabase Storage
        if (invoice.pdf_storage_path) {
          console.log('Downloading PDF from storage:', invoice.pdf_storage_path);
          const { data, error } = await supabase.storage
            .from('invoice-pdfs')
            .download(invoice.pdf_storage_path);

          if (!error && data) {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
              reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
              };
              reader.onerror = reject;
            });
            reader.readAsDataURL(data);
            pdfBase64 = await base64Promise;
            console.log('PDF loaded from storage');
          } else {
            console.error('Failed to download from storage:', error);
          }
        }

        // Try 2: Fetch from Xero API if not in storage
        if (!pdfBase64 && invoice.xero_invoice_id) {
          console.log('Fetching PDF from Xero API');
          const result = await getXeroInvoicePDF(invoice.xero_invoice_id);

          if (result.success && result.pdf_base64) {
            pdfBase64 = result.pdf_base64;
            console.log('PDF fetched from Xero');
          } else {
            console.error('Failed to fetch from Xero:', result.error);
          }
        }

        // If we have a PDF, share/print it
        if (pdfBase64) {
          const fileUri = `${FileSystem.cacheDirectory}invoice_${invoice.invoice_number}.pdf`;
          await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
            encoding: 'base64',
          });

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/pdf',
              dialogTitle: `Invoice ${invoice.invoice_number}`,
            });
          } else {
            showMessage('Error', 'Sharing is not available on this device');
          }
        } else {
          // No PDF available from Xero
          showMessage('PDF Not Available', 'Could not retrieve the invoice PDF from Xero. Please try again or check your Xero connection.');
        }
      } catch (error) {
        console.error('Print error:', error);
        showMessage('Print Error', 'Failed to load invoice PDF. Please try again.');
      } finally {
        setPrinting(false);
      }
    },
    [showMessage]
  );

  const handleArchive = useCallback(
    async (invoice: Invoice) => {
      const newArchivedState = !invoice.is_archived;
      const action = newArchivedState ? 'archive' : 'unarchive';

      setArchiving(true);
      try {
        const { error } = await supabase
          .from('invoices')
          .update({ is_archived: newArchivedState })
          .eq('id', invoice.id);

        if (error) {
          throw error;
        }

        // Reload invoices to reflect the change
        await loadInvoices();

        // Close modal after archiving
        if (newArchivedState) {
          closeDetail();
        }

        showMessage(
          newArchivedState ? 'Archived' : 'Unarchived',
          `Invoice ${invoice.invoice_number} has been ${action}d.`
        );
      } catch (error) {
        console.error('Archive error:', error);
        showMessage('Error', `Failed to ${action} invoice. Please try again.`);
      } finally {
        setArchiving(false);
      }
    },
    [loadInvoices, closeDetail, showMessage]
  );

  const getExportStatus = (invoice: Invoice): ExportStatus => {
    if (invoice.xero_invoice_id) return 'exported';
    if (invoice.status === 'export_failed') return 'export_failed';
    if (invoice.status === 'pending') return 'pending';
    return 'not_exported';
  };

  const getPaymentStatus = (invoice: Invoice): PaymentStatus => {
    if (invoice.status === 'paid') return 'paid';
    return 'pending_payment';
  };

  const selectedSupplierName = selectedSupplier
    ? getSupplierName(selectedSupplier)
    : 'All Suppliers';

  const renderInvoiceItem = ({ item }: { item: Invoice }) => {
    const exportStatus = getExportStatus(item);
    const paymentStatus = getPaymentStatus(item);
    const supplierName = getSupplierName(item.supplier_id);

    return (
      <TouchableOpacity
        style={styles.invoiceCard}
        activeOpacity={0.7}
        onPress={() => openDetail(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
            <Text style={styles.invoiceDate}>Delivery: {formatDate(item.invoice_date)}</Text>
          </View>
          <View style={styles.cardBadges}>
            <ExportStatusBadge status={exportStatus} />
            <PaymentStatusBadge status={paymentStatus} />
          </View>
        </View>

        <Text style={styles.supplierName}>{supplierName}</Text>

        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.totalAmount}>{formatCurrency(item.total)}</Text>
            {paymentStatus === 'pending_payment' && item.due_date && (
              <Text style={styles.dueDateText}>Due: {formatDate(item.due_date)}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={showArchived ? 'archive-outline' : 'document-text-outline'}
        size={64}
        color={theme.colors.textMuted}
      />
      <Text style={styles.emptyTitle}>
        {showArchived ? 'No Archived Invoices' : 'No Invoices'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {showArchived
          ? 'Archived invoices will appear here.'
          : selectedSupplier
            ? 'No invoices found for this supplier.'
            : 'Invoices will appear here once orders are placed.'}
      </Text>
    </View>
  );

  // ---- Detail Modal ----
  const renderDetailModal = () => {
    if (!selectedInvoice) return null;
    const invoice = selectedInvoice;
    const exportStatus = getExportStatus(invoice);
    const paymentStatus = getPaymentStatus(invoice);
    const supplierName = getSupplierName(invoice.supplier_id);
    const isExported = exportStatus === 'exported';
    const isPending = exportStatus === 'pending';
    const canExport = exportStatus !== 'exported' && exportStatus !== 'pending';
    const isExporting = exporting === invoice.id;

    return (
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetail}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeDetail} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Invoice Details</Text>
            <View style={styles.modalCloseBtn} />
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Invoice header info */}
            <View style={styles.detailSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailInvoiceNumber}>{invoice.invoice_number}</Text>
              </View>

              <View style={styles.detailStatusRow}>
                <ExportStatusBadge status={exportStatus} />
                <PaymentStatusBadge status={paymentStatus} />
              </View>

              <View style={styles.detailMeta}>
                <View style={styles.detailMetaRow}>
                  <Ionicons name="business-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.detailMetaText}>{supplierName}</Text>
                </View>
                <View style={styles.detailMetaRow}>
                  <Ionicons name="calendar-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.detailMetaText}>{formatDate(invoice.invoice_date)}</Text>
                </View>
                {invoice.due_date && (
                  <View style={styles.detailMetaRow}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.detailMetaText}>Due {formatDate(invoice.due_date)}</Text>
                  </View>
                )}
                {invoice.order_id && (
                  <View style={styles.detailMetaRow}>
                    <Ionicons name="cart-outline" size={16} color={theme.colors.textSecondary} />
                    <Text style={styles.detailMetaText}>Order #{invoice.order_id}</Text>
                  </View>
                )}
              </View>

              {isPending && (
                <View style={[styles.xeroExportedBanner, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="hourglass-outline" size={18} color={theme.colors.info} />
                  <Text style={[styles.xeroExportedText, { color: theme.colors.info }]}>
                    Exporting to Xero...
                  </Text>
                </View>
              )}

              {isExported && invoice.exported_at && (
                <View style={styles.xeroExportedBanner}>
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
                  <Text style={styles.xeroExportedText}>
                    Exported to Xero on {formatDateTime(invoice.exported_at)}
                  </Text>
                </View>
              )}

              {exportStatus === 'export_failed' && (
                <View style={[styles.xeroExportedBanner, { backgroundColor: '#FDEDED' }]}>
                  <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.xeroExportedText, { color: theme.colors.error }]}>
                      Export to Xero failed
                    </Text>
                    {invoice.export_error && (
                      <Text style={[styles.exportErrorText, { color: theme.colors.error }]}>
                        {invoice.export_error}
                      </Text>
                    )}
                    <Text style={[styles.xeroExportedText, { color: theme.colors.textMuted, marginTop: 4 }]}>
                      Tap below to retry.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Line Items */}
            {invoice.items && invoice.items.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Line Items</Text>
                <View style={styles.lineItemsHeader}>
                  <Text style={[styles.lineItemHeaderText, styles.lineItemDesc]}>Item</Text>
                  <Text style={[styles.lineItemHeaderText, styles.lineItemQty]}>Qty</Text>
                  <Text style={[styles.lineItemHeaderText, styles.lineItemPrice]}>Price</Text>
                  <Text style={[styles.lineItemHeaderText, styles.lineItemTotal]}>Total</Text>
                </View>
                {invoice.items.map((item: InvoiceItem) => (
                  <View key={item.id} style={styles.lineItemRow}>
                    <Text style={[styles.lineItemText, styles.lineItemDesc]} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={[styles.lineItemText, styles.lineItemQty]}>{item.quantity}</Text>
                    <Text style={[styles.lineItemText, styles.lineItemPrice]}>
                      {formatCurrency(item.unit_price)}
                    </Text>
                    <Text style={[styles.lineItemText, styles.lineItemTotal]}>
                      {formatCurrency(item.total)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Totals */}
            <View style={styles.detailSection}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Subtotal</Text>
                <Text style={styles.totalsValue}>{formatCurrency(invoice.subtotal)}</Text>
              </View>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Tax</Text>
                <Text style={styles.totalsValue}>{formatCurrency(invoice.tax)}</Text>
              </View>
              <View style={[styles.totalsRow, styles.totalsDivider]}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total)}</Text>
              </View>
            </View>

            {/* Match Status */}
            {invoice.match_status && (
              <View style={styles.detailSection}>
                <View style={styles.detailMetaRow}>
                  <Ionicons name="git-compare-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.detailMetaText}>
                    Match status: {invoice.match_status}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            {canExport && (
              <TouchableOpacity
                style={[styles.actionButton, exportStatus === 'export_failed' ? styles.retryButton : styles.exportButton]}
                onPress={() => handleExport(invoice.id)}
                disabled={isExporting}
                activeOpacity={0.7}
              >
                {isExporting ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name={exportStatus === 'export_failed' ? 'refresh-outline' : 'cloud-upload-outline'}
                      size={20}
                      color={theme.colors.white}
                    />
                    <Text style={styles.actionButtonText}>
                      {exportStatus === 'export_failed' ? 'Retry Export' : 'Export to Xero'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {isExported && (
              <TouchableOpacity
                style={[styles.actionButton, styles.printButton]}
                onPress={() => handlePrint(invoice)}
                disabled={printing}
                activeOpacity={0.7}
              >
                {printing ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name="print-outline"
                      size={20}
                      color={theme.colors.white}
                    />
                    <Text style={styles.actionButtonText}>
                      Print Invoice
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionButton, styles.archiveButton]}
              onPress={() => handleArchive(invoice)}
              disabled={archiving}
              activeOpacity={0.7}
            >
              {archiving ? (
                <ActivityIndicator size="small" color={theme.colors.textMuted} />
              ) : (
                <>
                  <Ionicons
                    name={invoice.is_archived ? 'arrow-undo-outline' : 'archive-outline'}
                    size={20}
                    color={theme.colors.textMuted}
                  />
                  <Text style={styles.archiveButtonText}>
                    {invoice.is_archived ? 'Unarchive' : 'Archive'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ---- Supplier Filter Dropdown ----
  const renderSupplierFilter = () => (
    <Modal
      visible={supplierFilterOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setSupplierFilterOpen(false)}
    >
      <TouchableOpacity
        style={styles.filterOverlay}
        activeOpacity={1}
        onPress={() => setSupplierFilterOpen(false)}
      >
        <View style={styles.filterDropdown}>
          <Text style={styles.filterTitle}>Filter by Supplier</Text>
          <TouchableOpacity
            style={[
              styles.filterOption,
              !selectedSupplier && styles.filterOptionActive,
            ]}
            onPress={() => {
              setSelectedSupplier(null);
              setSupplierFilterOpen(false);
            }}
          >
            <Text
              style={[
                styles.filterOptionText,
                !selectedSupplier && styles.filterOptionTextActive,
              ]}
            >
              All Suppliers
            </Text>
            {!selectedSupplier && (
              <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
            )}
          </TouchableOpacity>
          {suppliers.map((supplier) => {
            const isActive = selectedSupplier === supplier.id;
            return (
              <TouchableOpacity
                key={supplier.id}
                style={[styles.filterOption, isActive && styles.filterOptionActive]}
                onPress={() => {
                  setSelectedSupplier(supplier.id);
                  setSupplierFilterOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    isActive && styles.filterOptionTextActive,
                  ]}
                >
                  {supplier.name ?? getSupplierName(supplier.id)}
                </Text>
                {isActive && (
                  <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {showArchived ? 'Archived Invoices' : 'Invoices'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.archiveToggle, showArchived && styles.archiveToggleActive]}
            onPress={() => setShowArchived(!showArchived)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={showArchived ? 'document-text-outline' : 'archive-outline'}
              size={18}
              color={showArchived ? theme.colors.accent : theme.colors.textMuted}
            />
            {archivedCount > 0 && !showArchived && (
              <View style={styles.archiveBadge}>
                <Text style={styles.archiveBadgeText}>{archivedCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setSupplierFilterOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="funnel-outline" size={18} color={theme.colors.text} />
            <Text style={styles.filterButtonText} numberOfLines={1}>
              {selectedSupplierName}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Invoice List */}
      <FlatList
        data={filteredInvoices}
        keyExtractor={(item) => item.id}
        renderItem={renderInvoiceItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          filteredInvoices.length === 0
            ? styles.listEmptyContent
            : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
          />
        }
      />

      {renderDetailModal()}
      {renderSupplierFilter()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl ?? 22,
    fontWeight: theme.fontWeight.bold ?? '700',
    color: theme.colors.text,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md ?? 8,
    gap: 4,
    maxWidth: 200,
  },
  filterButtonText: {
    fontSize: theme.fontSize.sm ?? 13,
    color: theme.colors.text,
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  archiveToggle: {
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm ?? 4,
    position: 'relative',
  },
  archiveToggleActive: {
    backgroundColor: theme.colors.background,
  },
  archiveBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: theme.colors.textMuted,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  archiveBadgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold ?? '700',
  },

  // ---- List ----
  listContent: {
    padding: theme.spacing.md,
  },
  listEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  separator: {
    height: theme.spacing.sm,
  },

  // ---- Invoice Card ----
  invoiceCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md ?? 8,
    padding: theme.spacing.md,
    ...theme.shadow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  invoiceNumber: {
    fontSize: theme.fontSize.md ?? 15,
    fontWeight: theme.fontWeight.semibold ?? '600',
    color: theme.colors.text,
  },
  invoiceDate: {
    fontSize: theme.fontSize.sm ?? 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  supplierName: {
    fontSize: theme.fontSize.sm ?? 13,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalAmount: {
    fontSize: theme.fontSize.lg ?? 17,
    fontWeight: theme.fontWeight.bold ?? '700',
    color: theme.colors.text,
  },
  dueDateText: {
    fontSize: theme.fontSize.xs ?? 11,
    color: theme.colors.warning,
    marginTop: 2,
  },

  // ---- Badges ----
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm ?? 4,
  },
  badgeText: {
    fontSize: theme.fontSize.xs ?? 11,
    fontWeight: theme.fontWeight.semibold ?? '600',
  },
  cardBadges: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  detailStatusRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },

  // ---- Empty State ----
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg ?? 17,
    fontWeight: theme.fontWeight.semibold ?? '600',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptySubtitle: {
    fontSize: theme.fontSize.sm ?? 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ---- Filter Dropdown ----
  filterOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  filterDropdown: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg ?? 12,
    width: '100%',
    maxWidth: 340,
    maxHeight: '70%',
    padding: theme.spacing.md,
    ...theme.shadow,
  },
  filterTitle: {
    fontSize: theme.fontSize.md ?? 15,
    fontWeight: theme.fontWeight.bold ?? '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm ?? 4,
  },
  filterOptionActive: {
    backgroundColor: theme.colors.surfaceHover,
  },
  filterOptionText: {
    fontSize: theme.fontSize.md ?? 15,
    color: theme.colors.text,
    flex: 1,
  },
  filterOptionTextActive: {
    fontWeight: theme.fontWeight.semibold ?? '600',
    color: theme.colors.accent,
  },

  // ---- Detail Modal ----
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: theme.fontSize.md ?? 15,
    fontWeight: theme.fontWeight.semibold ?? '600',
    color: theme.colors.text,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },

  // ---- Detail Sections ----
  detailSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md ?? 8,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  detailInvoiceNumber: {
    fontSize: theme.fontSize.lg ?? 17,
    fontWeight: theme.fontWeight.bold ?? '700',
    color: theme.colors.text,
  },
  detailMeta: {
    gap: theme.spacing.xs + 2,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  detailMetaText: {
    fontSize: theme.fontSize.sm ?? 13,
    color: theme.colors.textSecondary,
  },
  xeroExportedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: '#EBF5FB',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.borderRadius.sm ?? 4,
    marginTop: theme.spacing.sm,
  },
  xeroExportedText: {
    fontSize: theme.fontSize.sm ?? 13,
    color: theme.colors.info,
    fontWeight: theme.fontWeight.medium ?? '500',
  },
  exportErrorText: {
    fontSize: theme.fontSize.xs ?? 11,
    marginTop: 4,
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md ?? 15,
    fontWeight: theme.fontWeight.semibold ?? '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },

  // ---- Line Items ----
  lineItemsHeader: {
    flexDirection: 'row',
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: theme.spacing.xs,
  },
  lineItemHeaderText: {
    fontSize: theme.fontSize.xs ?? 11,
    fontWeight: theme.fontWeight.semibold ?? '600',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lineItemRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
  },
  lineItemText: {
    fontSize: theme.fontSize.sm ?? 13,
    color: theme.colors.text,
  },
  lineItemDesc: {
    flex: 3,
    paddingRight: theme.spacing.xs,
  },
  lineItemQty: {
    flex: 1,
    textAlign: 'center',
  },
  lineItemPrice: {
    flex: 1.5,
    textAlign: 'right',
  },
  lineItemTotal: {
    flex: 1.5,
    textAlign: 'right',
  },

  // ---- Totals ----
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  totalsLabel: {
    fontSize: theme.fontSize.sm ?? 13,
    color: theme.colors.textSecondary,
  },
  totalsValue: {
    fontSize: theme.fontSize.sm ?? 13,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium ?? '500',
  },
  totalsDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.sm,
  },
  grandTotalLabel: {
    fontSize: theme.fontSize.md ?? 15,
    fontWeight: theme.fontWeight.bold ?? '700',
    color: theme.colors.text,
  },
  grandTotalValue: {
    fontSize: theme.fontSize.lg ?? 17,
    fontWeight: theme.fontWeight.bold ?? '700',
    color: theme.colors.text,
  },

  // ---- Modal Actions ----
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? theme.spacing.xl : theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm + 4,
    borderRadius: theme.borderRadius.md ?? 8,
  },
  exportButton: {
    backgroundColor: theme.colors.accent,
  },
  retryButton: {
    backgroundColor: theme.colors.warning,
  },
  printButton: {
    backgroundColor: theme.colors.accent,
  },
  printButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  actionButtonText: {
    fontSize: theme.fontSize.md ?? 15,
    fontWeight: theme.fontWeight.semibold ?? '600',
    color: theme.colors.white,
  },
  printButtonTextSecondary: {
    color: theme.colors.accent,
  },
  archiveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  archiveButtonText: {
    fontSize: theme.fontSize.md ?? 15,
    fontWeight: theme.fontWeight.semibold ?? '600',
    color: theme.colors.textMuted,
  },
});
