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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { useOrders } from '../context/OrderContext';
import { Item, Supplier, CATEGORIES } from '../types';

export default function ShopScreen() {
  const {
    state,
    addToCart,
    updateCartQuantity,
    toggleFavourite,
    getCartQuantity,
    getSupplierName,
    getCartTotal,
    loadAllData,
  } = useOrders();

  const navigation = useNavigation<any>();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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

  // Item stats for filters
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

  // Cart totals
  const cartItemCount = state.cart.reduce((sum, c) => sum + c.quantity, 0);
  const cartTotal = getCartTotal();

  // Handlers
  const handleAddToCart = useCallback(
    (item: Item) => {
      addToCart(item, 1);
    },
    [addToCart]
  );

  const handleUpdateQuantity = useCallback(
    (itemId: string, delta: number) => {
      const currentQty = getCartQuantity(itemId);
      const newQty = currentQty + delta;
      updateCartQuantity(itemId, newQty);
    },
    [getCartQuantity, updateCartQuantity]
  );

  const handleToggleFavourite = useCallback(
    (itemId: string) => {
      toggleFavourite(itemId);
    },
    [toggleFavourite]
  );

  const clearFilters = () => {
    setSelectedSupplierId(null);
    setSelectedCategory(null);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedSupplierId || selectedCategory || searchQuery;

  const toggleSort = () => {
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
    const quantity = getCartQuantity(item.id);
    const inCart = quantity > 0;

    return (
      <View style={styles.itemCard}>
        {/* Image */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.itemImage} />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <Ionicons name="cube-outline" size={28} color={theme.colors.textMuted} />
          </View>
        )}

        {/* Favourite star */}
        <TouchableOpacity
          style={styles.favouriteButton}
          onPress={() => handleToggleFavourite(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={item.is_favourite ? 'star' : 'star-outline'}
            size={18}
            color={item.is_favourite ? theme.colors.warning : theme.colors.textMuted}
          />
        </TouchableOpacity>

        {/* Info */}
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemSupplier} numberOfLines={1}>
          {getSupplierName(item.supplier_id)}
        </Text>

        {/* Price */}
        <View style={styles.itemPriceRow}>
          <Text style={styles.itemPrice}>${item.wholesale_price.toFixed(2)}</Text>
          {item.size && <Text style={styles.itemUnit}> / {item.size}</Text>}
        </View>

        {/* Add / Quantity control */}
        {inCart ? (
          <View style={styles.quantityControl}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleUpdateQuantity(item.id, -1)}
            >
              <Ionicons name="remove" size={16} color={theme.colors.accent} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleUpdateQuantity(item.id, 1)}
            >
              <Ionicons name="add" size={16} color={theme.colors.accent} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addButton} onPress={() => handleAddToCart(item)}>
            <Ionicons name="add" size={18} color={theme.colors.white} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
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

      {/* Cart summary bar */}
      {state.cart.length > 0 && (
        <View style={styles.cartBar}>
          <View style={styles.cartBarInfo}>
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
            </View>
            <Text style={styles.cartBarTotal}>${cartTotal.toFixed(2)}</Text>
          </View>
          <TouchableOpacity
            style={styles.viewCartButton}
            onPress={() => navigation.navigate('Cart')}
          >
            <Text style={styles.viewCartText}>View Cart</Text>
            <Ionicons name="arrow-forward" size={18} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      )}
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
    flexShrink: 0,
    minHeight: 44,
    marginBottom: theme.spacing.sm,
  },
  supplierChipsContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
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
    flexShrink: 0,
    minHeight: 44,
    marginBottom: theme.spacing.md,
  },
  categoryPillsContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
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
  favouriteButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
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
    marginBottom: theme.spacing.sm,
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

  // Add button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.xs,
  },
  addButtonText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.white,
  },

  // Quantity control
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  quantityButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm + 2,
  },
  quantityText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
    minWidth: 24,
    textAlign: 'center',
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

  // Cart bar
  cartBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadow.lg,
  },
  cartBarInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  cartBadge: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.full,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs + 2,
  },
  cartBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.white,
  },
  cartBarTotal: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  viewCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm,
  },
  viewCartText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
});
