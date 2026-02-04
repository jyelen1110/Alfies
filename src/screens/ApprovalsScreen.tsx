import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { theme } from '../theme';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { Order, OrderItem, Item, User } from '../types';
import { parseOrderCSV, ParsedOrderLine, ParsedCSVResult } from '../utils/csvParser';
import { matchProduct, matchCustomer, ProductMatchResult, CustomerMatchResult, MatchConfidence } from '../utils/productMatcher';

interface EditableOrderItem extends OrderItem {
  isDeleted?: boolean;
}

interface ManualOrderItem {
  item: Item;
  quantity: number;
}

interface ImportMatchedItem {
  line: ParsedOrderLine;
  matchResult: ProductMatchResult;
  selectedItem: Item | null;
  removed: boolean;
}

export default function ApprovalsScreen() {
  const { state, updateOrderStatus, getSupplierName, loadAllData, approveOrderWithInvoice, updateOrder, updateOrderItems, createOrderForCustomer, createItem } = useOrders();
  const { user } = useAuth();

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Edit mode state
  const [editingItems, setEditingItems] = useState<EditableOrderItem[]>([]);
  const [editingNotes, setEditingNotes] = useState('');
  const [showAddItemInEdit, setShowAddItemInEdit] = useState(false);
  const [editItemSearchQuery, setEditItemSearchQuery] = useState('');

  // Manual Order Modal state
  const [manualOrderModalVisible, setManualOrderModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [manualOrderItems, setManualOrderItems] = useState<ManualOrderItem[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [manualOrderStep, setManualOrderStep] = useState<'customer' | 'items' | 'review'>('customer');
  const [deliveryDate, setDeliveryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showItemBrowser, setShowItemBrowser] = useState(true);

  // Import Modal state
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importStep, setImportStep] = useState<'select' | 'preview' | 'confirm'>('select');
  const [parsedCSV, setParsedCSV] = useState<ParsedCSVResult | null>(null);
  const [matchedCustomer, setMatchedCustomer] = useState<CustomerMatchResult | null>(null);
  const [matchedItems, setMatchedItems] = useState<ImportMatchedItem[]>([]);
  const [importSelectedCustomer, setImportSelectedCustomer] = useState<User | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState<number | null>(null);
  const [itemPickerSearch, setItemPickerSearch] = useState('');

  const pendingOrders = useMemo(
    () => state.orders.filter((o) => o.status === 'pending_approval'),
    [state.orders]
  );

  const pendingCount = pendingOrders.length;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadAllData();
    setIsRefreshing(false);
  }, [loadAllData]);

  const openDetail = useCallback((order: Order) => {
    setSelectedOrder(order);
    setDetailModalVisible(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailModalVisible(false);
    setSelectedOrder(null);
  }, []);

  const openEditModal = useCallback((order: Order) => {
    setSelectedOrder(order);
    setEditingItems((order.items || []).map(item => ({ ...item, isDeleted: false })));
    setEditingNotes(order.notes || '');
    setEditModalVisible(true);
    setDetailModalVisible(false);
  }, []);

  const closeEditModal = useCallback(() => {
    setEditModalVisible(false);
    setEditingItems([]);
    setEditingNotes('');
    setShowAddItemInEdit(false);
    setEditItemSearchQuery('');
  }, []);

  const handleUpdateItemQuantity = useCallback((index: number, newQuantity: string) => {
    const qty = parseFloat(newQuantity) || 0;
    setEditingItems(prev => prev.map((item, i) =>
      i === index ? { ...item, quantity: qty, total: qty * item.unit_price } : item
    ));
  }, []);

  const handleUpdateItemUnitPrice = useCallback((index: number, newPrice: string) => {
    const price = parseFloat(newPrice) || 0;
    setEditingItems(prev => prev.map((item, i) =>
      i === index ? { ...item, unit_price: price, total: item.quantity * price } : item
    ));
  }, []);

  const handleDeleteItem = useCallback((index: number) => {
    setEditingItems(prev => prev.map((item, i) =>
      i === index ? { ...item, isDeleted: true } : item
    ));
  }, []);

  const handleRestoreItem = useCallback((index: number) => {
    setEditingItems(prev => prev.map((item, i) =>
      i === index ? { ...item, isDeleted: false } : item
    ));
  }, []);

  const handleAddItemToEdit = useCallback((item: Item) => {
    // Check if item already exists in the order
    const existingIndex = editingItems.findIndex(
      (i) => i.procurement_item_id === item.id || i.name === item.name
    );

    if (existingIndex >= 0) {
      // If it was deleted, restore it and increment quantity
      if (editingItems[existingIndex].isDeleted) {
        setEditingItems(prev => prev.map((i, idx) =>
          idx === existingIndex ? { ...i, isDeleted: false, quantity: 1 } : i
        ));
      } else {
        // Otherwise just increment quantity
        setEditingItems(prev => prev.map((i, idx) =>
          idx === existingIndex ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unit_price } : i
        ));
      }
    } else {
      // Add new item to the order
      const newItem: EditableOrderItem = {
        id: `new-${Date.now()}`,
        order_id: selectedOrder?.id || '',
        procurement_item_id: item.id,
        name: item.name,
        quantity: 1,
        unit: item.unit || 'each',
        unit_price: item.wholesale_price,
        total: item.wholesale_price,
        isDeleted: false,
      };
      setEditingItems(prev => [...prev, newItem]);
    }
  }, [editingItems, selectedOrder]);

  // Filter items for edit modal search
  const filteredEditItems = useMemo(() => {
    const query = editItemSearchQuery.toLowerCase().trim();
    if (!query) return state.items;
    return state.items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
    );
  }, [state.items, editItemSearchQuery]);

  const calculateEditTotal = useCallback(() => {
    return editingItems
      .filter(item => !item.isDeleted && item.quantity > 0)
      .reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [editingItems]);

  const handleSaveEdits = useCallback(async () => {
    if (!selectedOrder) return;

    const activeItems = editingItems.filter(item => !item.isDeleted && item.quantity > 0);
    if (activeItems.length === 0) {
      Alert.alert('Error', 'Order must have at least one item');
      return;
    }

    setIsProcessing(true);
    try {
      // Update order items
      await updateOrderItems(selectedOrder.id, activeItems);

      // Update order totals and notes
      const newTotal = calculateEditTotal();
      await updateOrder(selectedOrder.id, {
        subtotal: newTotal,
        total: newTotal + (selectedOrder.tax || 0) + (selectedOrder.delivery_fee || 0),
        notes: editingNotes,
      });

      Alert.alert('Success', 'Order updated successfully');
      closeEditModal();
      await loadAllData();
    } catch (error) {
      console.error('Error saving edits:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedOrder, editingItems, editingNotes, updateOrderItems, updateOrder, calculateEditTotal, closeEditModal, loadAllData]);

  const handleApprove = useCallback(
    (order: Order) => {
      Alert.alert(
        'Approve Order',
        `Approve order ${order.order_number || order.id.substring(0, 8)}? This will generate an invoice.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Approve & Generate Invoice',
            style: 'default',
            onPress: async () => {
              setIsProcessing(true);
              try {
                const result = await approveOrderWithInvoice(order.id, user?.id || '');
                if (result) {
                  Alert.alert(
                    'Order Approved',
                    `Order approved and invoice ${result.invoice?.invoice_number || ''} has been generated.`
                  );
                }
                closeDetail();
                closeEditModal();
              } catch (error) {
                console.error('Error approving order:', error);
                Alert.alert('Error', 'Failed to approve order. Please try again.');
              } finally {
                setIsProcessing(false);
              }
            },
          },
        ]
      );
    },
    [approveOrderWithInvoice, user?.id, closeDetail, closeEditModal]
  );

  const handleReject = useCallback(
    (order: Order) => {
      Alert.alert(
        'Cancel Order',
        `Are you sure you want to cancel order ${order.order_number || order.id.substring(0, 8)}?`,
        [
          { text: 'Keep Order', style: 'cancel' },
          {
            text: 'Cancel Order',
            style: 'destructive',
            onPress: async () => {
              setIsProcessing(true);
              try {
                await updateOrderStatus(order.id, 'cancelled');
                closeDetail();
                closeEditModal();
              } catch (error) {
                console.error('Error cancelling order:', error);
                Alert.alert('Error', 'Failed to cancel order. Please try again.');
              } finally {
                setIsProcessing(false);
              }
            },
          },
        ]
      );
    },
    [updateOrderStatus, closeDetail, closeEditModal]
  );

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  // Filter customers (users) based on search
  const filteredCustomers = useMemo(() => {
    const query = customerSearchQuery.toLowerCase().trim();
    if (!query) return state.users;
    return state.users.filter(
      (u) =>
        u.business_name?.toLowerCase().includes(query) ||
        u.contact_name?.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query)
    );
  }, [state.users, customerSearchQuery]);

  // Filter items based on search - show all items when browsing, filtered when searching
  const filteredItems = useMemo(() => {
    const query = itemSearchQuery.toLowerCase().trim();
    if (!query) return state.items; // Show all items
    return state.items.filter(
      (item) =>
        item.name?.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
    );
  }, [state.items, itemSearchQuery]);

  // Manual Order Handlers
  const openManualOrderModal = useCallback(() => {
    setManualOrderModalVisible(true);
    setManualOrderStep('customer');
    setSelectedCustomer(null);
    setManualOrderItems([]);
    setCustomerSearchQuery('');
    setItemSearchQuery('');
    setDeliveryDate(null);
    setShowItemBrowser(true);
    setShowDatePicker(false);
  }, []);

  const closeManualOrderModal = useCallback(() => {
    setManualOrderModalVisible(false);
    setManualOrderStep('customer');
    setSelectedCustomer(null);
    setManualOrderItems([]);
    setCustomerSearchQuery('');
    setItemSearchQuery('');
    setDeliveryDate(null);
    setShowItemBrowser(true);
    setShowDatePicker(false);
  }, []);

  const selectCustomerForManualOrder = useCallback((customer: User) => {
    setSelectedCustomer(customer);
    setManualOrderStep('items');
    setCustomerSearchQuery('');
  }, []);

  const addItemToManualOrder = useCallback((item: Item) => {
    setManualOrderItems((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    setItemSearchQuery('');
  }, []);

  const updateManualOrderItemQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setManualOrderItems((prev) => prev.filter((i) => i.item.id !== itemId));
    } else {
      setManualOrderItems((prev) =>
        prev.map((i) => (i.item.id === itemId ? { ...i, quantity } : i))
      );
    }
  }, []);

  const removeManualOrderItem = useCallback((itemId: string) => {
    setManualOrderItems((prev) => prev.filter((i) => i.item.id !== itemId));
  }, []);

  const getManualOrderTotal = useCallback(() => {
    return manualOrderItems.reduce(
      (sum, i) => sum + i.item.wholesale_price * i.quantity,
      0
    );
  }, [manualOrderItems]);

  const submitManualOrder = useCallback(async () => {
    if (!selectedCustomer || manualOrderItems.length === 0) {
      Alert.alert('Error', 'Please select a customer and add items');
      return;
    }

    if (!deliveryDate) {
      Alert.alert('Error', 'Please select a delivery date');
      return;
    }

    setIsProcessing(true);
    try {
      const supplier = state.suppliers.find((s) => s.name.toLowerCase().includes('alfie'));
      const supplierId = supplier?.id || state.suppliers[0]?.id || '';

      const orderNumber = `MO-${Date.now().toString().slice(-8)}`;
      const total = getManualOrderTotal();

      const orderItems: OrderItem[] = manualOrderItems.map((i) => ({
        procurement_item_id: i.item.id,
        name: i.item.name,
        quantity: i.quantity,
        unit: i.item.size || 'each',
        unit_price: i.item.wholesale_price,
        total: i.quantity * i.item.wholesale_price,
        xero_item_code: i.item.xero_item_code,
        xero_account_code: i.item.xero_account_code,
      }));

      const order = await createOrderForCustomer(selectedCustomer.id, {
        supplier_id: supplierId,
        order_number: orderNumber,
        order_date: new Date().toISOString().split('T')[0],
        requested_delivery_date: deliveryDate ? deliveryDate.toISOString().split('T')[0] : undefined,
        subtotal: total,
        total,
        status: 'approved',
        items: orderItems,
        notes: `Created by ${user?.full_name || 'owner'} on behalf of ${selectedCustomer.business_name || selectedCustomer.full_name}`,
      });

      if (order) {
        Alert.alert('Success', `Order ${orderNumber} created successfully`);
        closeManualOrderModal();
        await loadAllData();
      } else {
        Alert.alert('Error', 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating manual order:', error);
      Alert.alert('Error', 'Failed to create order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedCustomer, manualOrderItems, state.suppliers, user, getManualOrderTotal, deliveryDate, createOrderForCustomer, closeManualOrderModal, loadAllData]);

  // Import Handlers
  const openImportModal = useCallback(() => {
    setImportModalVisible(true);
    setImportStep('select');
    setParsedCSV(null);
    setMatchedCustomer(null);
    setMatchedItems([]);
    setImportSelectedCustomer(null);
    setShowCustomerPicker(false);
    setShowItemPicker(null);
  }, []);

  const closeImportModal = useCallback(() => {
    setImportModalVisible(false);
    setImportStep('select');
    setParsedCSV(null);
    setMatchedCustomer(null);
    setMatchedItems([]);
    setImportSelectedCustomer(null);
    setShowCustomerPicker(false);
    setShowItemPicker(null);
  }, []);

  const handlePickCSV = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const parsed = parseOrderCSV(content);

      if (!parsed.success) {
        Alert.alert('Error', parsed.error || 'Failed to parse CSV');
        return;
      }

      setParsedCSV(parsed);

      // Match customer
      const customerMatch = matchCustomer(parsed.customerName, state.users);
      setMatchedCustomer(customerMatch);
      if (customerMatch.user) {
        setImportSelectedCustomer(customerMatch.user);
      }

      // Match products
      const matched: ImportMatchedItem[] = parsed.lines.map((line) => {
        const matchResult = matchProduct(line.barcode, line.productName, state.items);
        return {
          line,
          matchResult,
          selectedItem: matchResult.item,
          removed: false,
        };
      });
      setMatchedItems(matched);

      setImportStep('preview');
    } catch (error) {
      console.error('Error picking CSV:', error);
      Alert.alert('Error', 'Failed to read file. Please try again.');
    }
  }, [state.users, state.items]);

  const getConfidenceColor = (confidence: MatchConfidence): string => {
    switch (confidence) {
      case 'exact':
      case 'high':
        return theme.colors.success;
      case 'low':
        return theme.colors.warning;
      case 'none':
        return theme.colors.danger;
      default:
        return theme.colors.textMuted;
    }
  };

  const getConfidenceIcon = (confidence: MatchConfidence): 'checkmark-circle' | 'alert-circle' | 'close-circle' | 'help-circle' => {
    switch (confidence) {
      case 'exact':
      case 'high':
        return 'checkmark-circle';
      case 'low':
        return 'alert-circle';
      case 'none':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const selectItemForImportLine = useCallback((lineIndex: number, item: Item) => {
    setMatchedItems((prev) =>
      prev.map((m, i) =>
        i === lineIndex ? { ...m, selectedItem: item, matchResult: { ...m.matchResult, confidence: 'exact' as MatchConfidence } } : m
      )
    );
    setShowItemPicker(null);
    setItemPickerSearch('');
  }, []);

  const removeImportLine = useCallback((lineIndex: number) => {
    setMatchedItems((prev) =>
      prev.map((m, i) => (i === lineIndex ? { ...m, removed: true } : m))
    );
  }, []);

  const restoreImportLine = useCallback((lineIndex: number) => {
    setMatchedItems((prev) =>
      prev.map((m, i) => (i === lineIndex ? { ...m, removed: false } : m))
    );
  }, []);

  const canProceedWithImport = useMemo(() => {
    if (!importSelectedCustomer) return false;
    const activeItems = matchedItems.filter((m) => !m.removed);
    if (activeItems.length === 0) return false;
    return activeItems.every((m) => m.selectedItem !== null);
  }, [importSelectedCustomer, matchedItems]);

  const getUnmatchedCount = useMemo(() => {
    return matchedItems.filter((m) => !m.removed && !m.selectedItem).length;
  }, [matchedItems]);

  const submitImportOrder = useCallback(async () => {
    if (!importSelectedCustomer || !canProceedWithImport) {
      Alert.alert('Error', 'Please resolve all unmatched items before proceeding');
      return;
    }

    setIsProcessing(true);
    try {
      const supplier = state.suppliers.find((s) => s.name.toLowerCase().includes('alfie'));
      const supplierId = supplier?.id || state.suppliers[0]?.id || '';

      const orderNumber = parsedCSV?.orderNumber || `IMP-${Date.now().toString().slice(-8)}`;

      const activeItems = matchedItems.filter((m) => !m.removed && m.selectedItem);
      const orderItems: OrderItem[] = activeItems.map((m) => ({
        procurement_item_id: m.selectedItem!.id,
        name: m.selectedItem!.name,
        quantity: m.line.quantity,
        unit: m.selectedItem!.size || 'each',
        unit_price: m.selectedItem!.wholesale_price,
        total: m.line.quantity * m.selectedItem!.wholesale_price,
      }));

      const total = orderItems.reduce((sum, item) => sum + item.total!, 0);

      const order = await createOrderForCustomer(importSelectedCustomer.id, {
        supplier_id: supplierId,
        order_number: orderNumber,
        order_date: parsedCSV?.date || new Date().toISOString().split('T')[0],
        subtotal: total,
        total,
        status: 'approved',
        items: orderItems,
        notes: `Imported from CSV for ${importSelectedCustomer.business_name || importSelectedCustomer.full_name}`,
      });

      if (order) {
        Alert.alert('Success', `Order ${orderNumber} imported successfully`);
        closeImportModal();
        await loadAllData();
      } else {
        Alert.alert('Error', 'Failed to import order');
      }
    } catch (error) {
      console.error('Error importing order:', error);
      Alert.alert('Error', 'Failed to import order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [importSelectedCustomer, canProceedWithImport, matchedItems, parsedCSV, state.suppliers, createOrderForCustomer, closeImportModal, loadAllData]);

  // Filter items for import item picker
  const filteredItemsForPicker = useMemo(() => {
    const query = itemPickerSearch.toLowerCase().trim();
    if (!query) return state.items.slice(0, 50);
    return state.items.filter(
      (item) =>
        item.name?.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query)
    );
  }, [state.items, itemPickerSearch]);

  const getCustomerName = (userId: string | undefined): string => {
    if (!userId) return 'Unknown Customer';
    const customer = state.users.find(u => u.id === userId);
    return customer?.business_name || customer?.full_name || customer?.email || 'Unknown Customer';
  };

  const renderOrderCard = ({ item: order }: { item: Order }) => {
    const customerName = getCustomerName(order.created_by);
    const itemCount = order.items?.length || 0;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openDetail(order)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.orderNumberBadge}>
              <Ionicons name="document-text-outline" size={16} color={theme.colors.accent} />
              <Text style={styles.orderNumberText}>
                {order.order_number || `#${order.id.substring(0, 8)}`}
              </Text>
            </View>
            <Text style={styles.cardDate}>
              {formatDate(order.order_date)}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Ionicons name="time-outline" size={14} color={theme.colors.warning} />
            <Text style={styles.statusText}>Pending</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardRow}>
            <Ionicons name="storefront-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.cardLabel}>Customer</Text>
            <Text style={styles.cardValue} numberOfLines={1}>{customerName}</Text>
          </View>
          <View style={styles.cardRow}>
            <Ionicons name="cube-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.cardLabel}>Items</Text>
            <Text style={styles.cardValue}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatCurrency(order.total)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="checkmark-circle-outline" size={64} color={theme.colors.borderLight} />
      </View>
      <Text style={styles.emptyTitle}>No Pending Approvals</Text>
      <Text style={styles.emptySubtitle}>
        All orders have been reviewed. New orders from team members will appear here.
      </Text>
    </View>
  );

  const renderDetailModal = () => {
    if (!selectedOrder) return null;

    const supplierName = getSupplierName(selectedOrder.supplier_id);
    const orderItems = selectedOrder.items || [];
    const subtotal = selectedOrder.subtotal ?? selectedOrder.total;
    const tax = selectedOrder.tax ?? 0;
    const deliveryFee = selectedOrder.delivery_fee ?? 0;

    return (
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetail}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeDetail} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Order Details</Text>
            <TouchableOpacity onPress={() => openEditModal(selectedOrder)} style={styles.modalCloseButton}>
              <Ionicons name="create-outline" size={24} color={theme.colors.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order Number</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder.order_number || `#${selectedOrder.id.substring(0, 8)}`}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(selectedOrder.order_date)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Supplier</Text>
                <Text style={styles.detailValue}>{supplierName}</Text>
              </View>
              {selectedOrder.created_by && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created By</Text>
                  <Text style={styles.detailValue}>{selectedOrder.created_by}</Text>
                </View>
              )}
              {selectedOrder.requested_delivery_date && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Requested Delivery</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(selectedOrder.requested_delivery_date)}
                  </Text>
                </View>
              )}
              {selectedOrder.notes && (
                <View style={styles.detailNotesRow}>
                  <Text style={styles.detailLabel}>Notes</Text>
                  <Text style={styles.detailNotes}>{selectedOrder.notes}</Text>
                </View>
              )}
            </View>

            <View style={styles.itemsSection}>
              <Text style={styles.itemsSectionTitle}>
                Items ({orderItems.length})
              </Text>
              {orderItems.map((item, index) => (
                <View
                  key={item.id || index}
                  style={[
                    styles.itemRow,
                    index < orderItems.length - 1 && styles.itemRowBorder,
                  ]}
                >
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.code ? `${item.code} · ` : ''}{item.quantity} {item.unit} @ {formatCurrency(item.unit_price)}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>
                    {formatCurrency(item.total ?? item.quantity * item.unit_price)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.totalsSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalRowLabel}>Subtotal</Text>
                <Text style={styles.totalRowValue}>{formatCurrency(subtotal)}</Text>
              </View>
              {tax > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalRowLabel}>Tax</Text>
                  <Text style={styles.totalRowValue}>{formatCurrency(tax)}</Text>
                </View>
              )}
              {deliveryFee > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalRowLabel}>Delivery Fee</Text>
                  <Text style={styles.totalRowValue}>{formatCurrency(deliveryFee)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(selectedOrder.total)}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelOrderButton]}
              onPress={() => handleReject(selectedOrder)}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              <Ionicons name="close-circle-outline" size={20} color={theme.colors.white} />
              <Text style={styles.actionButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => openEditModal(selectedOrder)}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              <Ionicons name="create-outline" size={20} color={theme.colors.white} />
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(selectedOrder)}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.white} />
                  <Text style={styles.actionButtonText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderEditModal = () => {
    if (!selectedOrder) return null;

    const supplierName = getSupplierName(selectedOrder.supplier_id);
    const editTotal = calculateEditTotal();

    return (
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeEditModal} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Order</Text>
            <View style={styles.modalCloseButton} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailSection}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Order</Text>
                <Text style={styles.detailValue}>
                  {selectedOrder.order_number || `#${selectedOrder.id.substring(0, 8)}`}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Supplier</Text>
                <Text style={styles.detailValue}>{supplierName}</Text>
              </View>
            </View>

            <View style={styles.itemsSection}>
              <View style={styles.editItemsHeader}>
                <Text style={styles.itemsSectionTitle}>Edit Items</Text>
                <TouchableOpacity
                  style={styles.addItemButton}
                  onPress={() => setShowAddItemInEdit(!showAddItemInEdit)}
                >
                  <Ionicons name={showAddItemInEdit ? "close" : "add-circle-outline"} size={20} color={theme.colors.accent} />
                  <Text style={styles.addItemButtonText}>{showAddItemInEdit ? "Done" : "Add Item"}</Text>
                </TouchableOpacity>
              </View>

              {showAddItemInEdit && (
                <View style={styles.addItemSection}>
                  <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color={theme.colors.textMuted} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search products..."
                      placeholderTextColor={theme.colors.textMuted}
                      value={editItemSearchQuery}
                      onChangeText={setEditItemSearchQuery}
                    />
                    {editItemSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setEditItemSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.addItemList}>
                    {filteredEditItems.slice(0, 5).map((item) => {
                      const inOrder = editingItems.find(
                        (i) => (i.procurement_item_id === item.id || i.name === item.name) && !i.isDeleted
                      );
                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.addItemRow, inOrder && styles.addItemRowInOrder]}
                          onPress={() => handleAddItemToEdit(item)}
                        >
                          <View style={styles.addItemInfo}>
                            <Text style={styles.addItemName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.addItemPrice}>{formatCurrency(item.wholesale_price)}</Text>
                          </View>
                          <Ionicons
                            name={inOrder ? "checkmark-circle" : "add-circle"}
                            size={22}
                            color={inOrder ? theme.colors.success : theme.colors.accent}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {editingItems.map((item, index) => (
                <View
                  key={item.id || index}
                  style={[
                    styles.editItemRowStacked,
                    item.isDeleted && styles.editItemDeleted,
                  ]}
                >
                  <View style={styles.editItemNameRow}>
                    <Text style={[styles.editItemNameFull, item.isDeleted && styles.deletedText]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {item.isDeleted ? (
                      <TouchableOpacity
                        style={styles.restoreButton}
                        onPress={() => handleRestoreItem(index)}
                      >
                        <Ionicons name="refresh" size={20} color={theme.colors.accent} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.deleteItemButton}
                        onPress={() => handleDeleteItem(index)}
                      >
                        <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {!item.isDeleted && (
                    <View style={styles.editItemControlsRow}>
                      <View style={styles.priceInputContainer}>
                        <Text style={styles.inputLabel}>$</Text>
                        <TextInput
                          style={styles.priceInput}
                          value={item.unit_price.toFixed(2)}
                          onChangeText={(text) => handleUpdateItemUnitPrice(index, text)}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                        />
                      </View>
                      <Text style={styles.inputMultiplier}>×</Text>
                      <View style={styles.quantityInputContainer}>
                        <TextInput
                          style={styles.quantityInput}
                          value={item.quantity.toString()}
                          onChangeText={(text) => handleUpdateItemQuantity(index, text)}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                        />
                      </View>
                      <Text style={styles.inputEquals}>=</Text>
                      <Text style={styles.editItemTotalStacked}>
                        {formatCurrency(item.quantity * item.unit_price)}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            <View style={styles.notesSection}>
              <Text style={styles.itemsSectionTitle}>Notes</Text>
              <TextInput
                style={styles.notesInput}
                value={editingNotes}
                onChangeText={setEditingNotes}
                placeholder="Add notes for this order..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.totalsSection}>
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>New Total</Text>
                <Text style={styles.grandTotalValue}>{formatCurrency(editTotal)}</Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelOrderButton]}
              onPress={() => handleReject(selectedOrder)}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              <Ionicons name="close-circle-outline" size={20} color={theme.colors.white} />
              <Text style={styles.actionButtonText}>Cancel Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSaveEdits}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color={theme.colors.white} />
                  <Text style={styles.actionButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(selectedOrder)}
              activeOpacity={0.8}
              disabled={isProcessing}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.white} />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // Render Manual Order Modal
  const renderManualOrderModal = () => (
    <Modal
      visible={manualOrderModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeManualOrderModal}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={closeManualOrderModal} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {manualOrderStep === 'customer' ? 'Select Customer' : manualOrderStep === 'items' ? 'Add Items' : 'Review Order'}
          </Text>
          <View style={styles.modalCloseButton} />
        </View>

        {manualOrderStep === 'customer' && (
          <View style={styles.modalContent}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={theme.colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search customers..."
                placeholderTextColor={theme.colors.textMuted}
                value={customerSearchQuery}
                onChangeText={setCustomerSearchQuery}
              />
            </View>
            <FlatList
              data={filteredCustomers}
              keyExtractor={(item) => item.id}
              renderItem={({ item: customer }) => (
                <TouchableOpacity
                  style={styles.customerItem}
                  onPress={() => selectCustomerForManualOrder(customer)}
                >
                  <View style={styles.customerInfo}>
                    <Text style={styles.customerName}>
                      {customer.business_name || customer.full_name}
                    </Text>
                    {customer.contact_name && customer.business_name && (
                      <Text style={styles.customerContact}>{customer.contact_name}</Text>
                    )}
                    <Text style={styles.customerEmail}>{customer.email}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyListText}>No customers found</Text>
              }
            />
          </View>
        )}

        {manualOrderStep === 'items' && (
          <View style={styles.modalContent}>
            <View style={styles.selectedCustomerBanner}>
              <Ionicons name="person" size={16} color={theme.colors.accent} />
              <Text style={styles.selectedCustomerText}>
                {selectedCustomer?.business_name || selectedCustomer?.full_name}
              </Text>
              <TouchableOpacity onPress={() => setManualOrderStep('customer')}>
                <Text style={styles.changeLink}>Change</Text>
              </TouchableOpacity>
            </View>

            {/* Delivery Date (Required) */}
            <View style={styles.deliveryDateSection}>
              <Text style={styles.deliveryDateLabel}>Delivery Date <Text style={styles.requiredAsterisk}>*</Text></Text>
              <TouchableOpacity
                style={styles.deliveryDateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.colors.accent} />
                <Text style={styles.deliveryDateButtonText}>
                  {deliveryDate ? deliveryDate.toLocaleDateString() : 'Select date'}
                </Text>
              </TouchableOpacity>
              {deliveryDate && (
                <TouchableOpacity onPress={() => setDeliveryDate(null)}>
                  <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePicker
                value={deliveryDate || new Date()}
                mode="date"
                display="calendar"
                onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                  setShowDatePicker(false);
                  if (event.type === 'set' && selectedDate) {
                    setDeliveryDate(selectedDate);
                  }
                }}
                minimumDate={new Date()}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <Modal
                visible={showDatePicker}
                transparent
                animationType="slide"
              >
                <View style={styles.datePickerModalOverlay}>
                  <View style={styles.datePickerModalContent}>
                    <View style={styles.datePickerModalHeader}>
                      <Text style={styles.datePickerModalTitle}>Select Delivery Date</Text>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <Ionicons name="close" size={24} color="#000000" />
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      value={deliveryDate || new Date()}
                      mode="date"
                      display="inline"
                      themeVariant="light"
                      accentColor={theme.colors.accent}
                      onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                        if (selectedDate) {
                          setDeliveryDate(selectedDate);
                        }
                      }}
                      minimumDate={new Date()}
                      style={styles.datePickerInline}
                    />
                    <TouchableOpacity
                      style={styles.datePickerDoneButton}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={styles.datePickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            )}

            {/* Toggle between order items and browse catalog */}
            <View style={styles.viewToggle}>
              <TouchableOpacity
                style={[styles.viewToggleButton, !showItemBrowser && styles.viewToggleButtonActive]}
                onPress={() => setShowItemBrowser(false)}
              >
                <Ionicons name="cart" size={16} color={!showItemBrowser ? theme.colors.white : theme.colors.text} />
                <Text style={[styles.viewToggleText, !showItemBrowser && styles.viewToggleTextActive]}>
                  Order ({manualOrderItems.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.viewToggleButton, showItemBrowser && styles.viewToggleButtonActive]}
                onPress={() => setShowItemBrowser(true)}
              >
                <Ionicons name="list" size={16} color={showItemBrowser ? theme.colors.white : theme.colors.text} />
                <Text style={[styles.viewToggleText, showItemBrowser && styles.viewToggleTextActive]}>
                  Browse Items
                </Text>
              </TouchableOpacity>
            </View>

            {showItemBrowser ? (
              /* Browse/Search Items View */
              <View style={styles.itemBrowserContainer}>
                <View style={styles.searchContainer}>
                  <Ionicons name="search" size={20} color={theme.colors.textMuted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name, barcode, or category..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={itemSearchQuery}
                    onChangeText={setItemSearchQuery}
                  />
                  {itemSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setItemSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                <FlatList
                  data={filteredItems}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    const inOrder = manualOrderItems.find((o) => o.item.id === item.id);
                    return (
                      <TouchableOpacity
                        style={[styles.browseItem, inOrder && styles.browseItemInOrder]}
                        onPress={() => addItemToManualOrder(item)}
                      >
                        <View style={styles.browseItemInfo}>
                          <Text style={styles.browseItemName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.browseItemMeta}>
                            {item.category ? `${item.category} · ` : ''}{formatCurrency(item.wholesale_price)}
                          </Text>
                        </View>
                        {inOrder ? (
                          <View style={styles.inOrderBadge}>
                            <Text style={styles.inOrderBadgeText}>{inOrder.quantity}</Text>
                          </View>
                        ) : (
                          <Ionicons name="add-circle" size={24} color={theme.colors.accent} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.emptyListText}>No items found</Text>
                  }
                  initialNumToRender={20}
                  maxToRenderPerBatch={20}
                />
              </View>
            ) : (
              /* Order Items View */
              <View style={styles.orderItemsList}>
                <ScrollView style={styles.orderItemsScroll}>
                  {manualOrderItems.map((orderItem) => (
                    <View key={orderItem.item.id} style={styles.orderItemRow}>
                      <View style={styles.orderItemInfo}>
                        <Text style={styles.orderItemName} numberOfLines={1}>{orderItem.item.name}</Text>
                        <Text style={styles.orderItemPrice}>
                          {formatCurrency(orderItem.item.wholesale_price)} each
                        </Text>
                      </View>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => updateManualOrderItemQuantity(orderItem.item.id, orderItem.quantity - 1)}
                        >
                          <Ionicons name="remove" size={18} color={theme.colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{orderItem.quantity}</Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => updateManualOrderItemQuantity(orderItem.item.id, orderItem.quantity + 1)}
                        >
                          <Ionicons name="add" size={18} color={theme.colors.text} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.orderItemTotal}>
                        {formatCurrency(orderItem.item.wholesale_price * orderItem.quantity)}
                      </Text>
                      <TouchableOpacity onPress={() => removeManualOrderItem(orderItem.item.id)}>
                        <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {manualOrderItems.length === 0 && (
                    <View style={styles.emptyOrderState}>
                      <Ionicons name="cart-outline" size={48} color={theme.colors.borderLight} />
                      <Text style={styles.emptyOrderText}>No items added yet</Text>
                      <TouchableOpacity
                        style={styles.browseItemsButton}
                        onPress={() => setShowItemBrowser(true)}
                      >
                        <Text style={styles.browseItemsButtonText}>Browse Items</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {manualOrderStep === 'items' && manualOrderItems.length > 0 && (
          <View style={styles.modalActions}>
            <View style={styles.orderTotalRow}>
              <Text style={styles.orderTotalLabel}>Total</Text>
              <Text style={styles.orderTotalValue}>{formatCurrency(getManualOrderTotal())}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.approveButton,
                (!deliveryDate || manualOrderItems.length === 0) && styles.disabledButton,
              ]}
              onPress={submitManualOrder}
              disabled={isProcessing || !deliveryDate || manualOrderItems.length === 0}
            >
              {isProcessing ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.white} />
                  <Text style={styles.actionButtonText}>Create Order</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );

  // Render Import Modal
  const renderImportModal = () => (
    <Modal
      visible={importModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closeImportModal}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={closeImportModal} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {importStep === 'select' ? 'Import Order' : 'Review Import'}
          </Text>
          <View style={styles.modalCloseButton} />
        </View>

        {importStep === 'select' && (
          <View style={[styles.modalContent, styles.importSelectContent]}>
            <View style={styles.importInstructions}>
              <Ionicons name="document-text-outline" size={64} color={theme.colors.borderLight} />
              <Text style={styles.importTitle}>Import Order from CSV</Text>
              <Text style={styles.importSubtitle}>
                Select a CSV file exported from your email or ordering system
              </Text>
            </View>
            <TouchableOpacity style={styles.pickFileButton} onPress={handlePickCSV}>
              <Ionicons name="folder-open-outline" size={24} color={theme.colors.white} />
              <Text style={styles.pickFileButtonText}>Select CSV File</Text>
            </TouchableOpacity>
          </View>
        )}

        {importStep === 'preview' && parsedCSV && (
          <ScrollView style={styles.modalContent}>
            {/* Order Info */}
            <View style={styles.importSection}>
              <Text style={styles.sectionTitle}>Order Details</Text>
              <View style={styles.importDetailRow}>
                <Text style={styles.importDetailLabel}>Order #</Text>
                <Text style={styles.importDetailValue}>{parsedCSV.orderNumber}</Text>
              </View>
              <View style={styles.importDetailRow}>
                <Text style={styles.importDetailLabel}>Date</Text>
                <Text style={styles.importDetailValue}>{formatDate(parsedCSV.date)}</Text>
              </View>
            </View>

            {/* Customer Selection */}
            <View style={styles.importSection}>
              <Text style={styles.sectionTitle}>Customer</Text>
              {!showCustomerPicker ? (
                <TouchableOpacity
                  style={styles.customerSelectionRow}
                  onPress={() => setShowCustomerPicker(true)}
                >
                  {importSelectedCustomer ? (
                    <>
                      <View style={styles.matchBadge}>
                        <Ionicons
                          name={getConfidenceIcon(matchedCustomer?.confidence || 'none')}
                          size={16}
                          color={getConfidenceColor(matchedCustomer?.confidence || 'none')}
                        />
                      </View>
                      <View style={styles.customerSelectionInfo}>
                        <Text style={styles.customerSelectionName}>
                          {importSelectedCustomer.business_name || importSelectedCustomer.full_name}
                        </Text>
                        <Text style={styles.customerSelectionMeta}>
                          CSV: "{parsedCSV.customerName}"
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={[styles.matchBadge, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
                      </View>
                      <View style={styles.customerSelectionInfo}>
                        <Text style={styles.unmatchedText}>No customer matched</Text>
                        <Text style={styles.customerSelectionMeta}>
                          CSV: "{parsedCSV.customerName}"
                        </Text>
                      </View>
                    </>
                  )}
                  <Text style={styles.changeLink}>Change</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.customerPickerContainer}>
                  <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={theme.colors.textMuted} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search customers..."
                      placeholderTextColor={theme.colors.textMuted}
                      value={customerSearchQuery}
                      onChangeText={setCustomerSearchQuery}
                      autoFocus
                    />
                  </View>
                  <View style={styles.customerPickerList}>
                    {filteredCustomers.slice(0, 5).map((customer) => (
                      <TouchableOpacity
                        key={customer.id}
                        style={styles.customerPickerItem}
                        onPress={() => {
                          setImportSelectedCustomer(customer);
                          setShowCustomerPicker(false);
                          setCustomerSearchQuery('');
                        }}
                      >
                        <Text style={styles.customerPickerName}>
                          {customer.business_name || customer.full_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={styles.cancelPickerButton}
                    onPress={() => {
                      setShowCustomerPicker(false);
                      setCustomerSearchQuery('');
                    }}
                  >
                    <Text style={styles.cancelPickerText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Items */}
            <View style={styles.importSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Items ({matchedItems.filter((m) => !m.removed).length})</Text>
                {getUnmatchedCount > 0 && (
                  <View style={styles.unmatchedBadge}>
                    <Text style={styles.unmatchedBadgeText}>{getUnmatchedCount} unmatched</Text>
                  </View>
                )}
              </View>

              {matchedItems.map((matchedItem, index) => (
                <View
                  key={index}
                  style={[
                    styles.importItemRow,
                    matchedItem.removed && styles.importItemRemoved,
                  ]}
                >
                  {showItemPicker === index ? (
                    <View style={styles.itemPickerContainer}>
                      <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color={theme.colors.textMuted} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Search items..."
                          placeholderTextColor={theme.colors.textMuted}
                          value={itemPickerSearch}
                          onChangeText={setItemPickerSearch}
                          autoFocus
                        />
                      </View>
                      <View style={styles.itemPickerList}>
                        {filteredItemsForPicker.slice(0, 5).map((item) => (
                          <TouchableOpacity
                            key={item.id}
                            style={styles.itemPickerItem}
                            onPress={() => selectItemForImportLine(index, item)}
                          >
                            <Text style={styles.itemPickerName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.itemPickerPrice}>{formatCurrency(item.wholesale_price)}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity
                        style={styles.cancelPickerButton}
                        onPress={() => {
                          setShowItemPicker(null);
                          setItemPickerSearch('');
                        }}
                      >
                        <Text style={styles.cancelPickerText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <View style={styles.matchBadge}>
                        <Ionicons
                          name={matchedItem.removed ? 'remove-circle' : getConfidenceIcon(matchedItem.selectedItem ? matchedItem.matchResult.confidence : 'none')}
                          size={16}
                          color={matchedItem.removed ? theme.colors.textMuted : getConfidenceColor(matchedItem.selectedItem ? matchedItem.matchResult.confidence : 'none')}
                        />
                      </View>
                      <View style={styles.importItemInfo}>
                        <Text
                          style={[styles.importItemName, matchedItem.removed && styles.removedText]}
                          numberOfLines={1}
                        >
                          {matchedItem.selectedItem?.name || matchedItem.line.productName}
                        </Text>
                        {matchedItem.selectedItem && matchedItem.selectedItem.name !== matchedItem.line.productName && (
                          <Text style={styles.importItemOriginal}>CSV: "{matchedItem.line.productName}"</Text>
                        )}
                        {!matchedItem.selectedItem && !matchedItem.removed && (
                          <Text style={styles.unmatchedWarning}>Unmatched - tap to select</Text>
                        )}
                      </View>
                      <Text style={[styles.importItemQty, matchedItem.removed && styles.removedText]}>
                        x{matchedItem.line.quantity}
                      </Text>
                      {matchedItem.selectedItem && !matchedItem.removed && (
                        <Text style={styles.importItemPrice}>
                          {formatCurrency(matchedItem.selectedItem.wholesale_price * matchedItem.line.quantity)}
                        </Text>
                      )}
                      <View style={styles.importItemActions}>
                        {!matchedItem.removed ? (
                          <>
                            <TouchableOpacity
                              style={styles.importItemAction}
                              onPress={() => setShowItemPicker(index)}
                            >
                              <Ionicons name="search" size={18} color={theme.colors.accent} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.importItemAction}
                              onPress={() => removeImportLine(index)}
                            >
                              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            style={styles.importItemAction}
                            onPress={() => restoreImportLine(index)}
                          >
                            <Ionicons name="refresh" size={18} color={theme.colors.accent} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </>
                  )}
                </View>
              ))}
            </View>

            {/* Total */}
            <View style={styles.importTotalSection}>
              <Text style={styles.importTotalLabel}>Estimated Total</Text>
              <Text style={styles.importTotalValue}>
                {formatCurrency(
                  matchedItems
                    .filter((m) => !m.removed && m.selectedItem)
                    .reduce((sum, m) => sum + m.selectedItem!.wholesale_price * m.line.quantity, 0)
                )}
              </Text>
            </View>
          </ScrollView>
        )}

        {importStep === 'preview' && (
          <View style={styles.modalActions}>
            {!canProceedWithImport && (
              <View style={styles.importWarning}>
                <Ionicons name="warning" size={16} color={theme.colors.warning} />
                <Text style={styles.importWarningText}>
                  {!importSelectedCustomer
                    ? 'Please select a customer'
                    : `Resolve ${getUnmatchedCount} unmatched item(s)`}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.approveButton,
                !canProceedWithImport && styles.disabledButton,
              ]}
              onPress={submitImportOrder}
              disabled={!canProceedWithImport || isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color={theme.colors.white} size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.white} />
                  <Text style={styles.actionButtonText}>Import Order</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Approvals</Text>
          {pendingCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={openManualOrderModal}>
            <Ionicons name="add-circle-outline" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={openImportModal}>
            <Ionicons name="document-attach-outline" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {state.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : (
        <FlatList
          data={pendingOrders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            pendingOrders.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.accent}
              colors={[theme.colors.accent]}
            />
          }
        />
      )}

      {renderDetailModal()}
      {renderEditModal()}
      {renderManualOrderModal()}
      {renderImportModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surfaceHover,
  },
  countBadge: {
    backgroundColor: theme.colors.warning,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs + 2,
    marginLeft: theme.spacing.sm,
  },
  countBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.white,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  listContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  listContentEmpty: {
    flex: 1,
  },
  // Order Card
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  orderNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderNumberText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  cardDate: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9E7',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    gap: 4,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.warning,
  },
  cardBody: {
    gap: theme.spacing.xs + 2,
    marginBottom: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  cardLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    width: 76,
  },
  cardValue: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
  },
  totalValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  emptyIconContainer: {
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Detail Modal
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
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  modalContent: {
    flex: 1,
  },
  detailSection: {
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs + 2,
  },
  detailLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  detailNotesRow: {
    paddingVertical: theme.spacing.xs + 2,
  },
  detailNotes: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginTop: 4,
    lineHeight: 20,
  },
  // Items Section
  itemsSection: {
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  itemsSectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  itemInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  itemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  itemTotal: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  // Edit Item styles
  editItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  editItemDeleted: {
    opacity: 0.5,
    backgroundColor: theme.colors.surfaceHover,
    marginHorizontal: -theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  editItemInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  editItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  quantityInputContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: 60,
  },
  quantityInput: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    textAlign: 'center',
  },
  editItemTotal: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    minWidth: 60,
    textAlign: 'right',
  },
  deleteItemButton: {
    padding: theme.spacing.xs,
  },
  restoreButton: {
    padding: theme.spacing.sm,
  },
  // Stacked edit item layout
  editItemRowStacked: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  editItemNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  editItemNameFull: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginRight: theme.spacing.sm,
  },
  editItemControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingLeft: theme.spacing.xs,
  },
  inputEquals: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.xs,
  },
  editItemTotalStacked: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
    minWidth: 70,
    textAlign: 'right',
  },
  // Edit modal - Add Item section
  editItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  addItemButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.accent,
  },
  addItemSection: {
    backgroundColor: theme.colors.backgroundLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  addItemList: {
    marginTop: theme.spacing.sm,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  addItemRowInOrder: {
    backgroundColor: theme.colors.background,
  },
  addItemInfo: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  addItemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  addItemPrice: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  // Price input styles
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.xs,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  priceInput: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    textAlign: 'right',
    minWidth: 60,
  },
  inputMultiplier: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    paddingHorizontal: theme.spacing.xs,
  },
  deletedText: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
  },
  // Notes section
  notesSection: {
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  notesInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Totals Section
  totalsSection: {
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  totalRowLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  totalRowValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
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
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
  // Action Buttons
  modalActions: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.xs,
    minHeight: 48,
  },
  approveButton: {
    backgroundColor: theme.colors.success,
  },
  cancelOrderButton: {
    backgroundColor: theme.colors.danger,
  },
  editButton: {
    backgroundColor: theme.colors.accent,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  actionButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.white,
  },
  // Manual Order & Import Modal styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  customerContact: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  customerEmail: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  emptyListText: {
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    paddingVertical: theme.spacing.xl,
  },
  selectedCustomerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceHover,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  selectedCustomerText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  changeLink: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.semibold,
  },
  itemSearchResults: {
    maxHeight: 200,
    marginHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  searchResultMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  orderItemsList: {
    flex: 1,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  orderItemsScroll: {
    flex: 1,
  },
  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  orderItemPrice: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    minWidth: 24,
    textAlign: 'center',
  },
  orderItemTotal: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.accent,
    minWidth: 60,
    textAlign: 'right',
  },
  orderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  orderTotalLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  orderTotalValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
  // Import Modal styles
  importSelectContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  importInstructions: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  importTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  importSubtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  pickFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
  },
  pickFileButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.white,
  },
  importSection: {
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  importDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
  },
  importDetailLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  importDetailValue: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  customerSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  matchBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerSelectionInfo: {
    flex: 1,
  },
  customerSelectionName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  customerSelectionMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  unmatchedText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.danger,
  },
  customerPickerContainer: {
    marginTop: theme.spacing.sm,
  },
  customerPickerList: {
    marginTop: theme.spacing.sm,
  },
  customerPickerItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  customerPickerName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  cancelPickerButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  cancelPickerText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  unmatchedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  unmatchedBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.danger,
  },
  importItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    gap: theme.spacing.sm,
  },
  importItemRemoved: {
    opacity: 0.5,
    backgroundColor: theme.colors.surfaceHover,
    marginHorizontal: -theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  importItemInfo: {
    flex: 1,
  },
  importItemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  importItemOriginal: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  unmatchedWarning: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.danger,
    marginTop: 2,
  },
  importItemQty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    minWidth: 30,
  },
  importItemPrice: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.accent,
    minWidth: 60,
    textAlign: 'right',
  },
  importItemActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  importItemAction: {
    padding: theme.spacing.xs,
  },
  removedText: {
    textDecorationLine: 'line-through',
    color: theme.colors.textMuted,
  },
  itemPickerContainer: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
  },
  itemPickerList: {
    marginTop: theme.spacing.sm,
  },
  itemPickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  itemPickerName: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  itemPickerPrice: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.accent,
    marginLeft: theme.spacing.sm,
  },
  importTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadow.sm,
  },
  importTotalLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  importTotalValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
  importWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
  },
  importWarningText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.warning,
  },
  disabledButton: {
    opacity: 0.5,
  },
  // Delivery Date styles
  deliveryDateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.md,
  },
  deliveryDateLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  requiredAsterisk: {
    color: theme.colors.error,
    fontWeight: theme.fontWeight.bold,
  },
  deliveryDateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deliveryDateButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingBottom: theme.spacing.xl,
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  datePickerModalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: '#000000',
  },
  datePickerInline: {
    height: 350,
    backgroundColor: '#FFFFFF',
  },
  datePickerDoneButton: {
    marginHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  datePickerDoneText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  // View Toggle styles
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.md,
    padding: 4,
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
  },
  viewToggleButtonActive: {
    backgroundColor: theme.colors.accent,
  },
  viewToggleText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  viewToggleTextActive: {
    color: theme.colors.white,
  },
  // Item Browser styles
  itemBrowserContainer: {
    flex: 1,
    marginTop: theme.spacing.sm,
  },
  browseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  browseItemInOrder: {
    backgroundColor: theme.colors.surfaceHover,
  },
  browseItemInfo: {
    flex: 1,
  },
  browseItemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  browseItemMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  inOrderBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inOrderBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.white,
  },
  emptyOrderState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyOrderText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  browseItemsButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
  },
  browseItemsButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.white,
  },
});
