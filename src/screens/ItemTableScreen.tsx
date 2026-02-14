import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { useOrders } from '../context/OrderContext';
import { Item } from '../types';

interface Column {
  key: keyof Item | 'supplier_name';
  label: string;
  width: number;
  editable: boolean;
  type: 'text' | 'number' | 'select';
  visible: boolean;
}

const DEFAULT_COLUMNS: Column[] = [
  { key: 'name', label: 'Name', width: 200, editable: true, type: 'text', visible: true },
  { key: 'supplier_name', label: 'Supplier', width: 120, editable: false, type: 'text', visible: true },
  { key: 'category', label: 'Category', width: 100, editable: true, type: 'text', visible: true },
  { key: 'wholesale_price', label: 'Price', width: 80, editable: true, type: 'number', visible: true },
  { key: 'size', label: 'Size', width: 80, editable: true, type: 'text', visible: true },
  { key: 'carton_size', label: 'Carton', width: 70, editable: true, type: 'number', visible: true },
  { key: 'rrp', label: 'RRP', width: 80, editable: true, type: 'number', visible: true },
  { key: 'barcode', label: 'Barcode', width: 120, editable: true, type: 'text', visible: false },
  { key: 'country_of_origin', label: 'Origin', width: 100, editable: true, type: 'text', visible: false },
  { key: 'purchase_price', label: 'Cost', width: 80, editable: true, type: 'number', visible: false },
  { key: 'carton_price', label: 'Carton $', width: 80, editable: true, type: 'number', visible: false },
  { key: 'tax_rate', label: 'Tax %', width: 60, editable: true, type: 'number', visible: false },
  { key: 'status', label: 'Status', width: 80, editable: true, type: 'select', visible: true },
];

export default function ItemTableScreen() {
  const navigation = useNavigation();
  const { state, updateItem, getSupplierName } = useOrders();
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [editingCell, setEditingCell] = useState<{ itemId: string; column: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [displayLimit, setDisplayLimit] = useState(50);
  const inputRef = useRef<TextInput>(null);

  const ITEMS_PER_PAGE = 50;
  const screenWidth = Dimensions.get('window').width;

  const visibleColumns = useMemo(() => columns.filter(col => col.visible), [columns]);
  const totalColumnWidth = useMemo(() => visibleColumns.reduce((sum, col) => sum + col.width, 0), [visibleColumns]);

  // Filter all items based on search
  const allFilteredItems = useMemo(() => {
    const activeItems = state.items.filter(i => i.status === 'active');
    if (!searchQuery) return activeItems;
    const query = searchQuery.toLowerCase();
    return activeItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query) ||
        item.barcode?.toLowerCase().includes(query)
    );
  }, [state.items, searchQuery]);

  // Apply pagination limit
  const filteredItems = useMemo(() => {
    return allFilteredItems.slice(0, displayLimit);
  }, [allFilteredItems, displayLimit]);

  const hasMoreItems = allFilteredItems.length > displayLimit;
  const totalItemCount = allFilteredItems.length;

  const handleLoadMore = () => {
    setDisplayLimit(prev => prev + ITEMS_PER_PAGE);
  };

  // Reset display limit when search changes
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setDisplayLimit(ITEMS_PER_PAGE);
  };

  const handleCellPress = (item: Item, column: Column) => {
    if (!column.editable) return;

    const value = column.key === 'supplier_name'
      ? getSupplierName(item.supplier_id)
      : item[column.key as keyof Item];

    setEditingCell({ itemId: item.id, column: column.key });
    setEditValue(value?.toString() || '');

    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSaveCell = useCallback(async () => {
    if (!editingCell) return;

    const item = state.items.find((i) => i.id === editingCell.itemId);
    if (!item) return;

    const column = columns.find((c) => c.key === editingCell.column);
    if (!column || column.key === 'supplier_name') return;

    let newValue: any = editValue;
    if (column.type === 'number') {
      newValue = editValue ? parseFloat(editValue) : undefined;
    }

    // Only update if value changed
    const currentValue = item[column.key as keyof Item];
    if (currentValue?.toString() !== editValue) {
      const updatedItem = {
        ...item,
        [column.key]: newValue,
      };
      await updateItem(updatedItem);
    }

    setEditingCell(null);
    setEditValue('');
  }, [editingCell, editValue, state.items, columns, updateItem]);

  const toggleColumnVisibility = (columnKey: string) => {
    setColumns(prev =>
      prev.map(col =>
        col.key === columnKey ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const moveColumn = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newColumns = [...columns];
    const [movedColumn] = newColumns.splice(fromIndex, 1);
    newColumns.splice(toIndex, 0, movedColumn);
    setColumns(newColumns);
  };

  const handleColumnHeaderPress = (index: number) => {
    if (draggedColumnIndex === null) {
      // Start dragging
      setDraggedColumnIndex(index);
    } else {
      // Drop at this position
      const visibleIndex = visibleColumns.findIndex(col => col.key === columns[draggedColumnIndex].key);
      const targetVisibleIndex = visibleColumns.findIndex(col => col.key === visibleColumns[index].key);

      // Find actual indices in full columns array
      const fromActualIndex = columns.findIndex(col => col.key === visibleColumns[visibleIndex]?.key);
      const toActualIndex = columns.findIndex(col => col.key === visibleColumns[targetVisibleIndex]?.key);

      if (fromActualIndex !== -1 && toActualIndex !== -1) {
        moveColumn(fromActualIndex, toActualIndex);
      }
      setDraggedColumnIndex(null);
    }
  };

  const getCellValue = (item: Item, column: Column): string => {
    if (column.key === 'supplier_name') {
      return getSupplierName(item.supplier_id);
    }
    const value = item[column.key as keyof Item];
    if (value === null || value === undefined) return '';
    if (column.type === 'number' && typeof value === 'number') {
      return column.key === 'wholesale_price' || column.key === 'rrp' || column.key === 'carton_price' || column.key === 'purchase_price'
        ? value.toFixed(2)
        : value.toString();
    }
    return value.toString();
  };

  if (state.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Items</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.columnPickerButton}
            onPress={() => setShowColumnPicker(true)}
          >
            <Ionicons name="options-outline" size={22} color={theme.colors.primary} />
          </Pressable>
          <Text style={styles.itemCount}>
            {filteredItems.length}{state.items.filter(i => i.status === 'active').length > 100 ? '+' : ''} items
          </Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={searchQuery}
          onChangeText={handleSearchChange}
          placeholderTextColor={theme.colors.textMuted}
        />
        <Text style={styles.itemCount}>
          {filteredItems.length}{hasMoreItems ? `/${totalItemCount}` : ''} items
        </Text>
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearchChange('')}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Ionicons name="information-circle-outline" size={16} color={theme.colors.textMuted} />
        <Text style={styles.instructionsText}>
          Tap cell to edit (auto-saves). Tap column header to drag, tap another to drop.
        </Text>
      </View>

      {/* Drag indicator */}
      {draggedColumnIndex !== null && (
        <View style={styles.dragIndicator}>
          <Text style={styles.dragIndicatorText}>
            Moving "{visibleColumns[draggedColumnIndex]?.label}" - tap destination column
          </Text>
          <TouchableOpacity onPress={() => setDraggedColumnIndex(null)}>
            <Text style={styles.cancelDrag}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Table */}
      <ScrollView style={styles.tableContainer} horizontal>
        <View style={{ width: Math.max(totalColumnWidth, screenWidth - 32) }}>
          {/* Column Headers */}
          <View style={styles.headerRow}>
            {visibleColumns.map((column, index) => (
              <TouchableOpacity
                key={column.key}
                style={[
                  styles.headerCell,
                  { width: column.width },
                  draggedColumnIndex === index && styles.draggingColumn,
                  draggedColumnIndex !== null && draggedColumnIndex !== index && styles.dropTarget,
                ]}
                onPress={() => handleColumnHeaderPress(index)}
              >
                <Text style={styles.headerCellText} numberOfLines={1}>
                  {column.label}
                </Text>
                {draggedColumnIndex !== null && draggedColumnIndex !== index && (
                  <View style={styles.dropIndicator} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Data Rows */}
          <ScrollView style={styles.dataContainer} showsVerticalScrollIndicator={true}>
            {filteredItems.map((item, rowIndex) => (
              <View
                key={item.id}
                style={[styles.dataRow, rowIndex % 2 === 1 && styles.dataRowAlt]}
              >
                {visibleColumns.map((column) => {
                  const isEditing =
                    editingCell?.itemId === item.id && editingCell?.column === column.key;

                  return (
                    <TouchableOpacity
                      key={`${item.id}-${column.key}`}
                      style={[
                        styles.dataCell,
                        { width: column.width },
                        !column.editable && styles.dataCellReadOnly,
                        isEditing && styles.dataCellEditing,
                      ]}
                      onPress={() => handleCellPress(item, column)}
                      disabled={!column.editable}
                    >
                      {isEditing ? (
                        <TextInput
                          ref={inputRef}
                          style={styles.cellInput}
                          value={editValue}
                          onChangeText={setEditValue}
                          onBlur={handleSaveCell}
                          onSubmitEditing={handleSaveCell}
                          keyboardType={column.type === 'number' ? 'decimal-pad' : 'default'}
                          autoFocus
                          selectTextOnFocus
                        />
                      ) : (
                        <Text style={styles.dataCellText} numberOfLines={1}>
                          {getCellValue(item, column)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* Load More Button */}
          {hasMoreItems && (
            <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
              <Text style={styles.loadMoreText}>
                Load More ({totalItemCount - filteredItems.length} remaining)
              </Text>
              <Ionicons name="chevron-down" size={18} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Column Picker Modal */}
      <Modal visible={showColumnPicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Show/Hide Columns</Text>
              <TouchableOpacity onPress={() => setShowColumnPicker(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {columns.map((column) => (
                <View key={column.key} style={styles.columnToggleRow}>
                  <Text style={styles.columnToggleLabel}>{column.label}</Text>
                  <Switch
                    value={column.visible}
                    onValueChange={() => toggleColumnVisibility(column.key)}
                    trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
                    thumbColor={theme.colors.white}
                  />
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalDoneButton}
              onPress={() => setShowColumnPicker(false)}
            >
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  columnPickerButton: {
    padding: theme.spacing.xs,
  },
  itemCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  itemCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginRight: theme.spacing.sm,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
    marginVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  loadMoreText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  instructionsText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    flex: 1,
  },
  dragIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.primary,
    marginHorizontal: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  dragIndicatorText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.sm,
  },
  cancelDrag: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
    paddingHorizontal: theme.spacing.sm,
  },
  tableContainer: {
    flex: 1,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
  },
  headerCell: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
  },
  headerCellText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.white,
  },
  draggingColumn: {
    backgroundColor: theme.colors.accent,
  },
  dropTarget: {
    opacity: 0.8,
  },
  dropIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: theme.colors.warning,
  },
  dataContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
    maxHeight: 500,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dataRowAlt: {
    backgroundColor: theme.colors.background,
  },
  dataCell: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    justifyContent: 'center',
    minHeight: 40,
  },
  dataCellReadOnly: {
    backgroundColor: theme.colors.surfaceHover,
  },
  dataCellEditing: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  dataCellText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  cellInput: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    padding: 0,
    margin: 0,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  modalBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  columnToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  columnToggleLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  modalDoneButton: {
    margin: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  modalDoneButtonText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
});
