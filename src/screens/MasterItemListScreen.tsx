import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import { Item, Supplier, CATEGORIES } from '../types';

interface EditItemModalProps {
  visible: boolean;
  item: Item | null;
  supplierName: string;
  suppliers: Supplier[];
  isNew?: boolean;
  onClose: () => void;
  onSave: (item: Item) => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'sold_out', label: 'Sold Out' },
] as const;

function EditItemModal({ visible, item, supplierName, suppliers, isNew, onClose, onSave }: EditItemModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    country_of_origin: '',
    size: '',
    carton_size: '',
    purchase_price: '',
    wholesale_price: '',
    carton_price: '',
    rrp: '',
    barcode: '',
    tax_rate: '',
    xero_account_code: '',
    xero_item_code: '',
    status: 'active' as 'active' | 'inactive' | 'sold_out',
    image_url: '',
    supplier_id: '',
  });

  // Update form when item changes
  useMemo(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        category: item.category || '',
        country_of_origin: item.country_of_origin || '',
        size: item.size || '',
        carton_size: item.carton_size?.toString() || '',
        purchase_price: item.purchase_price?.toString() || '',
        wholesale_price: item.wholesale_price?.toString() || '',
        carton_price: item.carton_price?.toString() || '',
        rrp: item.rrp?.toString() || '',
        barcode: item.barcode || '',
        tax_rate: item.tax_rate?.toString() || '10',
        xero_account_code: item.xero_account_code || '',
        xero_item_code: item.xero_item_code || '',
        status: item.status || 'active',
        image_url: item.image_url || '',
        supplier_id: item.supplier_id || '',
      });
    } else if (isNew) {
      // Reset form for new item
      setFormData({
        name: '',
        category: '',
        country_of_origin: '',
        size: '',
        carton_size: '',
        purchase_price: '',
        wholesale_price: '',
        carton_price: '',
        rrp: '',
        barcode: '',
        tax_rate: '10',
        xero_account_code: '',
        xero_item_code: '',
        status: 'active',
        image_url: '',
        supplier_id: suppliers.length > 0 ? suppliers[0].id : '',
      });
    }
  }, [item, isNew, suppliers]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!isNew && !item) return;

    // Validate required fields for new items
    if (isNew && !formData.name) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    if (isNew && !formData.supplier_id) {
      Alert.alert('Error', 'Please select a supplier');
      return;
    }

    const updatedItem: Item = {
      ...(item || {}),
      id: item?.id || '',
      tenant_id: item?.tenant_id || '',
      supplier_id: formData.supplier_id || item?.supplier_id || '',
      name: formData.name,
      category: formData.category || undefined,
      country_of_origin: formData.country_of_origin || undefined,
      size: formData.size || undefined,
      carton_size: formData.carton_size ? parseInt(formData.carton_size) : undefined,
      purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : undefined,
      wholesale_price: formData.wholesale_price ? parseFloat(formData.wholesale_price) : 0,
      carton_price: formData.carton_price ? parseFloat(formData.carton_price) : undefined,
      rrp: formData.rrp ? parseFloat(formData.rrp) : undefined,
      barcode: formData.barcode || undefined,
      tax_rate: formData.tax_rate ? parseInt(formData.tax_rate) : undefined,
      xero_account_code: formData.xero_account_code || undefined,
      xero_item_code: formData.xero_item_code || undefined,
      status: formData.status,
      image_url: formData.image_url || undefined,
      is_favourite: item?.is_favourite || false,
    } as Item;
    onSave(updatedItem);
  };

  if (!item && !isNew) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{isNew ? 'Add Item' : 'Edit Item'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Basic Info Section */}
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={formData.name}
              onChangeText={(v) => updateField('name', v)}
              placeholder="Item name"
            />

            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelect}>
              <TouchableOpacity
                style={[styles.categoryOption, !formData.category && styles.categoryOptionActive]}
                onPress={() => updateField('category', '')}
              >
                <Text style={[styles.categoryOptionText, !formData.category && styles.categoryOptionTextActive]}>
                  None
                </Text>
              </TouchableOpacity>
              {CATEGORIES.filter(c => c !== 'All').map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryOption, formData.category === cat && styles.categoryOptionActive]}
                  onPress={() => updateField('category', cat)}
                >
                  <Text style={[styles.categoryOptionText, formData.category === cat && styles.categoryOptionTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Country of Origin</Text>
            <TextInput
              style={styles.textInput}
              value={formData.country_of_origin}
              onChangeText={(v) => updateField('country_of_origin', v)}
              placeholder="e.g., Australia"
            />

            <Text style={styles.inputLabel}>Supplier</Text>
            {isNew ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelect}>
                {suppliers.map((supplier) => (
                  <TouchableOpacity
                    key={supplier.id}
                    style={[styles.categoryOption, formData.supplier_id === supplier.id && styles.categoryOptionActive]}
                    onPress={() => updateField('supplier_id', supplier.id)}
                  >
                    <Text style={[styles.categoryOptionText, formData.supplier_id === supplier.id && styles.categoryOptionTextActive]}>
                      {supplier.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.textInput, styles.readOnlyInput]}>
                <Text style={styles.readOnlyText}>{supplierName}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Status</Text>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.statusOption, formData.status === option.value && styles.statusOptionActive]}
                  onPress={() => updateField('status', option.value)}
                >
                  <Text style={[styles.statusOptionText, formData.status === option.value && styles.statusOptionTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Size & Packaging Section */}
            <Text style={styles.sectionTitle}>Size & Packaging</Text>

            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>Size</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.size}
                  onChangeText={(v) => updateField('size', v)}
                  placeholder="e.g., 500g"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>Carton Size</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.carton_size}
                  onChangeText={(v) => updateField('carton_size', v)}
                  placeholder="Units per carton"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Barcode</Text>
            <TextInput
              style={styles.textInput}
              value={formData.barcode}
              onChangeText={(v) => updateField('barcode', v)}
              placeholder="EAN/UPC barcode"
              keyboardType="number-pad"
            />

            {/* Pricing Section */}
            <Text style={styles.sectionTitle}>Pricing</Text>

            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>Purchase Price</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.purchase_price}
                  onChangeText={(v) => updateField('purchase_price', v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>Wholesale Price</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.wholesale_price}
                  onChangeText={(v) => updateField('wholesale_price', v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.rowInputs}>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>Carton Price</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.carton_price}
                  onChangeText={(v) => updateField('carton_price', v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>RRP</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.rrp}
                  onChangeText={(v) => updateField('rrp', v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Tax Rate (%)</Text>
            <TextInput
              style={styles.textInput}
              value={formData.tax_rate}
              onChangeText={(v) => updateField('tax_rate', v)}
              placeholder="10"
              keyboardType="number-pad"
            />

            {/* Xero Integration Section */}
            <Text style={styles.sectionTitle}>Xero Integration</Text>

            <Text style={styles.inputLabel}>Xero Account Code</Text>
            <TextInput
              style={styles.textInput}
              value={formData.xero_account_code}
              onChangeText={(v) => updateField('xero_account_code', v)}
              placeholder="e.g., 200"
            />

            <Text style={styles.inputLabel}>Xero Item Code</Text>
            <TextInput
              style={styles.textInput}
              value={formData.xero_item_code}
              onChangeText={(v) => updateField('xero_item_code', v)}
              placeholder="Xero item code"
            />

            {/* Image Section */}
            <Text style={styles.sectionTitle}>Image</Text>

            <Text style={styles.inputLabel}>Image URL</Text>
            <TextInput
              style={styles.textInput}
              value={formData.image_url}
              onChangeText={(v) => updateField('image_url', v)}
              placeholder="https://example.com/image.jpg"
              autoCapitalize="none"
            />

            {/* Spacer for scroll */}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function MasterItemListScreen() {
  const {
    state,
    getSupplierName,
    loadAllData,
    updateItem,
    createItem,
  } = useOrders();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'category'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAllData();
    } finally {
      setRefreshing(false);
    }
  }, [loadAllData]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    const filtered = state.items.filter((item) => {
      const matchesSupplier = !selectedSupplierId || item.supplier_id === selectedSupplierId;
      const matchesCategory =
        !selectedCategory || selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.barcode && item.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSupplier && matchesSearch && matchesCategory && item.status === 'active';
    });

    // Sort items
    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = (a.wholesale_price || 0) - (b.wholesale_price || 0);
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
      }
      return sortAsc ? comparison : -comparison;
    });
  }, [state.items, selectedSupplierId, selectedCategory, searchQuery, sortBy, sortAsc]);

  // Group items by category for summary
  const itemStats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const bySupplier: Record<string, number> = {};

    state.items.forEach((item) => {
      if (item.status === 'active') {
        const category = item.category || 'Uncategorized';
        byCategory[category] = (byCategory[category] || 0) + 1;
        bySupplier[item.supplier_id] = (bySupplier[item.supplier_id] || 0) + 1;
      }
    });

    return { byCategory, bySupplier, total: state.items.filter(i => i.status === 'active').length };
  }, [state.items]);

  const handleEditItem = (item: Item) => {
    setIsCreatingNew(false);
    setEditingItem(item);
    setShowEditModal(true);
  };

  const handleSaveItem = async (updatedItem: Item) => {
    if (isCreatingNew) {
      // Create new item
      const result = await createItem(updatedItem);
      if (result) {
        setShowEditModal(false);
        setEditingItem(null);
        setIsCreatingNew(false);
      } else {
        Alert.alert('Error', 'Failed to create item. Please try again.');
      }
    } else {
      // Update existing item
      await updateItem(updatedItem);
      setShowEditModal(false);
      setEditingItem(null);
    }
  };

  const clearFilters = () => {
    setSelectedSupplierId(null);
    setSelectedCategory(null);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedSupplierId || selectedCategory || searchQuery;

  const toggleSort = () => {
    // Cycle through: name asc -> name desc -> price asc -> price desc -> category asc -> category desc
    if (sortBy === 'name' && sortAsc) {
      setSortAsc(false);
    } else if (sortBy === 'name' && !sortAsc) {
      setSortBy('price');
      setSortAsc(true);
    } else if (sortBy === 'price' && sortAsc) {
      setSortAsc(false);
    } else if (sortBy === 'price' && !sortAsc) {
      setSortBy('category');
      setSortAsc(true);
    } else if (sortBy === 'category' && sortAsc) {
      setSortAsc(false);
    } else {
      setSortBy('name');
      setSortAsc(true);
    }
  };

  const getSortLabel = () => {
    const labels = { name: 'Name', price: 'Price', category: 'Category' };
    return `${labels[sortBy]} ${sortAsc ? '↑' : '↓'}`;
  };

  // Handle adding a new item
  const handleAddNewItem = useCallback(() => {
    if (state.suppliers.length === 0) {
      Alert.alert('No Suppliers', 'Please add a supplier first before creating items.');
      return;
    }
    setEditingItem(null);
    setIsCreatingNew(true);
    setShowEditModal(true);
  }, [state.suppliers]);

  // Loading state
  if (state.isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  // Render a single item card
  const renderItem = ({ item }: { item: Item }) => {
    const supplierName = getSupplierName(item.supplier_id);

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => handleEditItem(item)}
        activeOpacity={0.7}
      >
        {/* Image */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.itemImage} />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <Ionicons name="cube-outline" size={28} color={theme.colors.textMuted} />
          </View>
        )}

        {/* Info */}
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemSupplier} numberOfLines={1}>{supplierName}</Text>

        {/* Price */}
        <View style={styles.itemPriceRow}>
          <Text style={styles.itemPrice}>${item.wholesale_price.toFixed(2)}</Text>
          {item.size && <Text style={styles.itemUnit}> / {item.size}</Text>}
        </View>

        {/* Category badge */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{item.category}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with stats and import button */}
      <View style={styles.headerRow}>
        {/* Stats bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{itemStats.total}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Object.keys(itemStats.byCategory).length}</Text>
            <Text style={styles.statLabel}>Categories</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{state.suppliers.length}</Text>
            <Text style={styles.statLabel}>Suppliers</Text>
          </View>
        </View>

        {/* Add button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddNewItem}
        >
          <Ionicons name="add" size={20} color={theme.colors.white} />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items by name or barcode..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Supplier chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.supplierChipsContainer}
        style={styles.supplierChipsScroll}
      >
        <TouchableOpacity
          style={[styles.supplierChip, !selectedSupplierId && styles.supplierChipActive]}
          onPress={() => setSelectedSupplierId(null)}
        >
          <Ionicons
            name="storefront-outline"
            size={14}
            color={!selectedSupplierId ? theme.colors.white : theme.colors.text}
          />
          <Text
            style={[
              styles.supplierChipText,
              !selectedSupplierId && styles.supplierChipTextActive,
            ]}
          >
            All Suppliers
          </Text>
        </TouchableOpacity>
        {state.suppliers.map((supplier: Supplier) => (
          <TouchableOpacity
            key={supplier.id}
            style={[
              styles.supplierChip,
              selectedSupplierId === supplier.id && styles.supplierChipActive,
            ]}
            onPress={() =>
              setSelectedSupplierId(
                selectedSupplierId === supplier.id ? null : supplier.id
              )
            }
          >
            <Text
              style={[
                styles.supplierChipText,
                selectedSupplierId === supplier.id && styles.supplierChipTextActive,
              ]}
              numberOfLines={1}
            >
              {supplier.name} ({itemStats.bySupplier[supplier.id] || 0})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryPillsContainer}
        style={styles.categoryPillsScroll}
      >
        {CATEGORIES.map((category) => {
          const isActive =
            category === 'All' ? !selectedCategory || selectedCategory === 'All' : selectedCategory === category;
          const count = category === 'All' ? itemStats.total : (itemStats.byCategory[category] || 0);
          return (
            <TouchableOpacity
              key={category}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(category === 'All' ? null : category)}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  isActive && styles.categoryPillTextActive,
                ]}
              >
                {category} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
        </Text>
        <View style={styles.resultsActions}>
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Ionicons name="close-circle-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.sortButton} onPress={toggleSort}>
            <Ionicons name="swap-vertical" size={16} color={theme.colors.primary} />
            <Text style={styles.sortButtonText}>{getSortLabel()}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Items grid */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={theme.colors.border} />
            <Text style={styles.emptyText}>No items found</Text>
            <Text style={styles.emptySubtext}>
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Items will appear here once added'}
            </Text>
          </View>
        }
      />

      {/* Edit Item Modal */}
      <EditItemModal
        visible={showEditModal}
        item={editingItem}
        supplierName={editingItem ? getSupplierName(editingItem.supplier_id) : ''}
        suppliers={state.suppliers}
        isNew={isCreatingNew}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
          setIsCreatingNew(false);
        }}
        onSave={handleSaveItem}
      />
    </View>
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
    backgroundColor: theme.colors.background,
  },

  // Header row
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },

  // Stats bar
  statsBar: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadow.sm,
  },

  // Add button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.xs,
    ...theme.shadow.sm,
  },
  addButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.white,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.border,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadow.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: theme.spacing.sm + 2,
    paddingHorizontal: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },

  // Supplier chips
  supplierChipsScroll: {
    flexGrow: 0,
    marginBottom: theme.spacing.sm,
  },
  supplierChipsContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  supplierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    minHeight: 36,
  },
  supplierChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  supplierChipText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    maxWidth: 150,
    marginLeft: theme.spacing.xs,
  },
  supplierChipTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },

  // Category pills
  categoryPillsScroll: {
    flexGrow: 0,
    marginBottom: theme.spacing.md,
  },
  categoryPillsContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryPill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  categoryPillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  categoryPillText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  categoryPillTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },

  // Results header
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  resultsCount: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  resultsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  clearButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sortButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },

  // Grid
  gridContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 100,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },

  // Item card
  itemCard: {
    width: '48.5%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  itemImage: {
    width: '100%',
    height: 100,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
  },
  itemImagePlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    lineHeight: 18,
    marginBottom: 2,
  },
  itemSupplier: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: theme.spacing.xs,
  },
  itemPrice: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
  itemUnit: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceHover,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: theme.colors.textSecondary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
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
    maxHeight: '90%',
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
    padding: theme.spacing.lg,
    maxHeight: '70%',
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: theme.spacing.xs,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  halfInput: {
    flex: 1,
  },
  readOnlyInput: {
    backgroundColor: theme.colors.surfaceHover,
    justifyContent: 'center',
  },
  readOnlyText: {
    color: theme.colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statusOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  statusOptionActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  statusOptionText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  statusOptionTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  textInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categorySelect: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  categoryOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryOptionActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  categoryOptionText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  categoryOptionTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
  },
  saveButton: {
    flex: 2,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.white,
  },
});
