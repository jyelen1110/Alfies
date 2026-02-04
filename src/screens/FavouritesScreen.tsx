import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../theme';
import { useOrders } from '../context/OrderContext';
import { Item } from '../types';

export default function FavouritesScreen() {
  const navigation = useNavigation<any>();
  const { state, toggleFavourite, addToCart, getSupplierName, loadAllData, getCartQuantity } = useOrders();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAllData();
    } finally {
      setRefreshing(false);
    }
  }, [loadAllData]);

  // Get favourite items only
  const favouriteItems = useMemo(() => {
    return state.items.filter((item) => item.is_favourite && item.status === 'active');
  }, [state.items]);

  const handleAddToCart = async (item: Item) => {
    await addToCart(item, 1);
  };

  const handleToggleFavourite = async (itemId: string) => {
    await toggleFavourite(itemId);
  };

  if (state.isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  const renderItem = ({ item }: { item: Item }) => {
    const supplierName = getSupplierName(item.supplier_id);
    const cartQty = getCartQuantity(item.id);

    return (
      <View style={styles.itemCard}>
        {/* Image */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.itemImage} />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <Ionicons name="cube-outline" size={32} color={theme.colors.textMuted} />
          </View>
        )}

        {/* Favourite button */}
        <TouchableOpacity
          style={styles.favouriteButton}
          onPress={() => handleToggleFavourite(item.id)}
        >
          <Ionicons name="star" size={18} color={theme.colors.warning} />
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemSupplier}>{supplierName}</Text>

          <View style={styles.itemFooter}>
            <View>
              <Text style={styles.itemPrice}>${item.wholesale_price.toFixed(2)}</Text>
              {item.size && <Text style={styles.itemSize}>{item.size}</Text>}
            </View>

            <TouchableOpacity
              style={[styles.addButton, cartQty > 0 && styles.addButtonActive]}
              onPress={() => handleAddToCart(item)}
            >
              {cartQty > 0 ? (
                <Text style={styles.addButtonTextActive}>{cartQty}</Text>
              ) : (
                <Ionicons name="add" size={20} color={theme.colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {favouriteItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={64} color={theme.colors.border} />
          <Text style={styles.emptyTitle}>No favourites yet</Text>
          <Text style={styles.emptyText}>
            Browse the Item List and tap the star icon to add items to your favourites
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate('ItemList')}
          >
            <Text style={styles.browseButtonText}>Browse Items</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favouriteItems}
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
            />
          }
        />
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
  gridContent: {
    padding: theme.spacing.md,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  itemCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadow.sm,
  },
  itemImage: {
    width: '100%',
    height: 120,
    backgroundColor: theme.colors.background,
  },
  itemImagePlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favouriteButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  itemInfo: {
    padding: theme.spacing.sm,
  },
  itemName: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 4,
    minHeight: 36,
  },
  itemSupplier: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.accent,
  },
  itemSize: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  addButtonTextActive: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  browseButton: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  browseButtonText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.semibold,
    fontSize: theme.fontSize.md,
  },
});
