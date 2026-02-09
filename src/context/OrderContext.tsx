import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Supplier, Item, Order, CartItem, Invoice, OrderStatus, User, OrderItem, CustomerSupplier, Tenant } from '../types';
import { createXeroInvoice, checkXeroConnection } from '../services/xero';

interface OrderState {
  suppliers: Supplier[];
  items: Item[];
  orders: Order[];
  cart: CartItem[];
  invoices: Invoice[];
  users: User[];
  customerSuppliers: CustomerSupplier[]; // Customer's connected suppliers/owners
  connectedTenants: Tenant[]; // Tenant info for connected suppliers
  isLoading: boolean;
  error: string | null;
}

type OrderAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SUPPLIERS'; payload: Supplier[] }
  | { type: 'SET_ITEMS'; payload: Item[] }
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'SET_INVOICES'; payload: Invoice[] }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_CUSTOMER_SUPPLIERS'; payload: CustomerSupplier[] }
  | { type: 'SET_CONNECTED_TENANTS'; payload: Tenant[] }
  | { type: 'ADD_ORDER'; payload: Order }
  | { type: 'UPDATE_ORDER'; payload: Order }
  | { type: 'ADD_TO_CART'; payload: CartItem }
  | { type: 'UPDATE_CART_ITEM'; payload: { itemId: string; quantity: number } }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'CLEAR_CART'; payload?: string }
  | { type: 'CLEAR_CART_BY_TENANT'; payload: string }
  | { type: 'TOGGLE_FAVOURITE'; payload: string }
  | { type: 'UPDATE_ITEM'; payload: Item }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'ADD_INVOICE'; payload: Invoice }
  | { type: 'UPDATE_INVOICE'; payload: Invoice }
  | { type: 'CLEAR_ALL' };

const initialState: OrderState = {
  suppliers: [],
  items: [],
  orders: [],
  cart: [],
  invoices: [],
  users: [],
  customerSuppliers: [],
  connectedTenants: [],
  isLoading: true,
  error: null,
};

function orderReducer(state: OrderState, action: OrderAction): OrderState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_SUPPLIERS':
      return { ...state, suppliers: action.payload };
    case 'SET_ITEMS':
      return { ...state, items: action.payload };
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'SET_CART':
      return { ...state, cart: action.payload };
    case 'SET_INVOICES':
      return { ...state, invoices: action.payload };
    case 'SET_USERS':
      return { ...state, users: action.payload };
    case 'SET_CUSTOMER_SUPPLIERS':
      return { ...state, customerSuppliers: action.payload };
    case 'SET_CONNECTED_TENANTS':
      return { ...state, connectedTenants: action.payload };
    case 'ADD_ORDER':
      return { ...state, orders: [action.payload, ...state.orders] };
    case 'UPDATE_ORDER':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.payload.id ? action.payload : o
        ),
      };
    case 'ADD_TO_CART': {
      const existingIndex = state.cart.findIndex(
        (c) => c.item_id === action.payload.item_id
      );
      if (existingIndex >= 0) {
        const newCart = [...state.cart];
        newCart[existingIndex].quantity += action.payload.quantity;
        return { ...state, cart: newCart };
      }
      return { ...state, cart: [...state.cart, action.payload] };
    }
    case 'UPDATE_CART_ITEM': {
      if (action.payload.quantity <= 0) {
        return {
          ...state,
          cart: state.cart.filter((c) => c.item_id !== action.payload.itemId),
        };
      }
      return {
        ...state,
        cart: state.cart.map((c) =>
          c.item_id === action.payload.itemId
            ? { ...c, quantity: action.payload.quantity }
            : c
        ),
      };
    }
    case 'REMOVE_FROM_CART':
      return {
        ...state,
        cart: state.cart.filter((c) => c.item_id !== action.payload),
      };
    case 'CLEAR_CART':
      if (action.payload) {
        return {
          ...state,
          cart: state.cart.filter((c) => c.item.supplier_id !== action.payload),
        };
      }
      return { ...state, cart: [] };
    case 'CLEAR_CART_BY_TENANT':
      return {
        ...state,
        cart: state.cart.filter((c) => c.item.tenant_id !== action.payload),
      };
    case 'TOGGLE_FAVOURITE':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload
            ? { ...item, is_favourite: !item.is_favourite }
            : item
        ),
      };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.payload.id ? action.payload : item
        ),
      };
    case 'ADD_ITEM':
      return {
        ...state,
        items: [action.payload, ...state.items],
      };
    case 'ADD_INVOICE':
      return { ...state, invoices: [action.payload, ...state.invoices] };
    case 'UPDATE_INVOICE':
      return {
        ...state,
        invoices: state.invoices.map((i) =>
          i.id === action.payload.id ? action.payload : i
        ),
      };
    case 'CLEAR_ALL':
      return { ...initialState, isLoading: false };
    default:
      return state;
  }
}

interface OrderContextType {
  state: OrderState;
  // Data loading
  loadAllData: () => Promise<void>;
  loadUsers: () => Promise<void>;
  // Cart operations
  addToCart: (item: Item, quantity: number) => Promise<void>;
  updateCartQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: (supplierId?: string) => Promise<void>;
  clearCartByTenant: (tenantId: string) => Promise<void>;
  // Item operations
  toggleFavourite: (itemId: string) => Promise<void>;
  updateItem: (item: Item) => Promise<void>;
  createItem: (item: Omit<Item, 'id' | 'tenant_id' | 'created_at'>) => Promise<Item | null>;
  // Order operations
  createOrder: (order: Omit<Order, 'id' | 'tenant_id' | 'created_at'>) => Promise<Order | null>;
  createOrderForCustomer: (customerId: string, order: Omit<Order, 'id' | 'tenant_id' | 'created_at'>) => Promise<Order | null>;
  updateOrderStatus: (orderId: string, status: OrderStatus, approverId?: string) => Promise<void>;
  updateOrder: (orderId: string, updates: Partial<Order>) => Promise<Order | null>;
  updateOrderItems: (orderId: string, items: any[]) => Promise<boolean>;
  deleteOrder: (orderId: string) => Promise<boolean>;
  // Invoice operations
  loadInvoices: () => Promise<void>;
  generateInvoice: (order: Order) => Promise<Invoice | null>;
  approveOrderWithInvoice: (orderId: string, approverId: string) => Promise<{ order: Order; invoice: Invoice } | null>;
  exportToXero: (invoiceId: string) => Promise<boolean>;
  // Utility
  getSupplierName: (supplierId: string) => string;
  getTenantName: (tenantId: string) => string;
  getCartTotal: () => number;
  getCartQuantity: (itemId: string) => number;
  getPendingApprovalCount: () => number;
  // Multi-supplier support
  createOrderForTenant: (tenantId: string, order: Omit<Order, 'id' | 'tenant_id' | 'created_at'>) => Promise<Order | null>;
}

const OrderContext = createContext<OrderContextType | null>(null);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(orderReducer, initialState);
  const { user, tenant } = useAuth();

  useEffect(() => {
    if (user && tenant) {
      loadAllData();
    } else {
      dispatch({ type: 'CLEAR_ALL' });
    }
  }, [user?.id, tenant?.id]);

  const loadAllData = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // For customers, first load their supplier relationships
      if (user?.role === 'user') {
        await loadCustomerSuppliers();
      }
      await Promise.all([
        loadSuppliers(),
        loadItems(),
        loadOrders(),
        loadCart(),
        loadInvoices(),
        loadUsers(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load data' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Load customer's connected supplier relationships
  const loadCustomerSuppliers = async () => {
    if (!user) return;

    // Load customer_suppliers with tenant info
    const { data: relationships, error } = await supabase
      .from('customer_suppliers')
      .select(`
        *,
        tenant:tenants(id, name, slug, settings)
      `)
      .eq('customer_id', user.id)
      .eq('status', 'active');

    if (error) {
      console.error('Error loading customer suppliers:', error);
      return;
    }

    const customerSuppliers = relationships || [];
    dispatch({ type: 'SET_CUSTOMER_SUPPLIERS', payload: customerSuppliers });

    // Extract connected tenants
    const tenants = customerSuppliers
      .map((cs: any) => cs.tenant)
      .filter((t: Tenant | null): t is Tenant => t !== null);
    dispatch({ type: 'SET_CONNECTED_TENANTS', payload: tenants });
  };

  const loadSuppliers = async () => {
    if (!tenant && !user) return;

    let query = supabase
      .from('suppliers')
      .select('*')
      .eq('status', 'active')
      .order('name');

    // For owners/masters, filter by their tenant
    // For customers, RLS handles visibility to connected suppliers
    if (user?.role === 'owner' || user?.is_master) {
      query = query.eq('tenant_id', tenant?.id);
    }
    // Customers: no tenant filter - RLS returns all connected suppliers

    const { data, error } = await query;

    if (error) {
      console.error('Error loading suppliers:', error);
      return;
    }
    dispatch({ type: 'SET_SUPPLIERS', payload: data || [] });
  };

  const loadItems = async () => {
    if (!tenant && !user) return;
    const PAGE_SIZE = 1000;
    let allItems: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('items')
        .select('*')
        .eq('status', 'active')
        .order('name')
        .range(from, to);

      // For owners/masters, filter by their tenant
      // For customers, RLS handles visibility to connected supplier items
      if (user?.role === 'owner' || user?.is_master) {
        query = query.eq('tenant_id', tenant?.id);
      }
      // Customers: no tenant filter - RLS returns items from all connected suppliers

      const { data, error } = await query;

      if (error) {
        console.error('Error loading items:', error);
        return;
      }

      if (data && data.length > 0) {
        allItems = [...allItems, ...data];
        hasMore = data.length === PAGE_SIZE;
        page++;
      } else {
        hasMore = false;
      }
    }

    dispatch({ type: 'SET_ITEMS', payload: allItems });
  };

  const loadOrders = async () => {
    if (!tenant) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*, items:order_items(*)')
      .eq('tenant_id', tenant.id)
      .order('order_date', { ascending: false })
      .range(0, 999);

    if (error) {
      console.error('Error loading orders:', error);
      return;
    }
    dispatch({ type: 'SET_ORDERS', payload: data || [] });
  };

  const loadCart = async () => {
    if (!user) return;

    // For customers, load cart items from all connected suppliers
    // For owners, load only their tenant's cart items
    let query = supabase
      .from('cart_items')
      .select('*, item:items(*)')
      .eq('user_id', user.id);

    // For owners, filter by their tenant
    if ((user.role === 'owner' || user.is_master) && tenant) {
      query = query.eq('tenant_id', tenant.id);
    }
    // For customers, load all their cart items (from any tenant)

    const { data, error } = await query;

    if (error) {
      console.error('Error loading cart:', error);
      return;
    }
    dispatch({ type: 'SET_CART', payload: data || [] });
  };

  const loadInvoices = async () => {
    if (!tenant) return;
    const { data, error } = await supabase
      .from('invoices')
      .select('*, supplier:suppliers(id, name), items:invoice_items(*)')
      .eq('tenant_id', tenant.id)
      .order('invoice_date', { ascending: false })
      .range(0, 999);

    if (error) {
      console.error('Error loading invoices:', error);
      return;
    }
    dispatch({ type: 'SET_INVOICES', payload: data || [] });
  };

  const loadUsers = async () => {
    if (!tenant) return;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('business_name');

    if (error) {
      console.error('Error loading users:', error);
      return;
    }
    dispatch({ type: 'SET_USERS', payload: data || [] });
  };

  // Cart operations
  const addToCart = async (item: Item, quantity: number) => {
    if (!user) return;

    const existingCartItem = state.cart.find((c) => c.item_id === item.id);
    if (existingCartItem) {
      await updateCartQuantity(item.id, existingCartItem.quantity + quantity);
      return;
    }

    // For customers, use the item's tenant_id (the supplier's tenant)
    // For owners, use their own tenant
    const cartTenantId = user.role === 'user' ? item.tenant_id : tenant?.id;
    if (!cartTenantId) return;

    const { data, error } = await supabase
      .from('cart_items')
      .insert({
        tenant_id: cartTenantId,
        user_id: user.id,
        item_id: item.id,
        quantity,
      })
      .select('*, item:items(*)')
      .single();

    if (error) {
      console.error('Error adding to cart:', error);
      return;
    }
    dispatch({ type: 'ADD_TO_CART', payload: data });
  };

  const updateCartQuantity = async (itemId: string, quantity: number) => {
    if (!user) return;
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    const { error } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('item_id', itemId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating cart quantity:', error);
      return;
    }
    dispatch({ type: 'UPDATE_CART_ITEM', payload: { itemId, quantity } });
  };

  const removeFromCart = async (itemId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('item_id', itemId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error removing from cart:', error);
      return;
    }
    dispatch({ type: 'REMOVE_FROM_CART', payload: itemId });
  };

  const clearCart = async (supplierId?: string) => {
    if (!user) return;

    let query = supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id);

    // For owners, also filter by tenant
    if ((user.role === 'owner' || user.is_master) && tenant) {
      query = query.eq('tenant_id', tenant.id);
    }

    if (supplierId) {
      const supplierItemIds = state.cart
        .filter((c) => c.item.supplier_id === supplierId)
        .map((c) => c.item_id);
      if (supplierItemIds.length === 0) return;
      query = query.in('item_id', supplierItemIds);
    }

    const { error } = await query;
    if (error) {
      console.error('Error clearing cart:', error);
      return;
    }
    dispatch({ type: 'CLEAR_CART', payload: supplierId });
  };

  // Clear cart items for a specific tenant (used by customers after placing order with a supplier)
  const clearCartByTenant = async (tenantId: string) => {
    if (!user) return;

    const tenantItemIds = state.cart
      .filter((c) => c.item.tenant_id === tenantId)
      .map((c) => c.item_id);
    if (tenantItemIds.length === 0) return;

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)
      .in('item_id', tenantItemIds);

    if (error) {
      console.error('Error clearing cart by tenant:', error);
      return;
    }
    dispatch({ type: 'CLEAR_CART_BY_TENANT', payload: tenantId });
  };

  // Item operations
  const toggleFavourite = async (itemId: string) => {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;

    const { error } = await supabase
      .from('items')
      .update({ is_favourite: !item.is_favourite })
      .eq('id', itemId);

    if (error) {
      console.error('Error toggling favourite:', error);
      return;
    }
    dispatch({ type: 'TOGGLE_FAVOURITE', payload: itemId });
  };

  const updateItem = async (item: Item) => {
    const { error } = await supabase
      .from('items')
      .update({
        name: item.name,
        category: item.category,
        country_of_origin: item.country_of_origin,
        size: item.size,
        carton_size: item.carton_size,
        purchase_price: item.purchase_price,
        wholesale_price: item.wholesale_price,
        carton_price: item.carton_price,
        rrp: item.rrp,
        barcode: item.barcode,
        tax_rate: item.tax_rate,
        xero_account_code: item.xero_account_code,
        xero_item_code: item.xero_item_code,
        status: item.status,
        image_url: item.image_url,
        image_path: item.image_path,
      })
      .eq('id', item.id);

    if (error) {
      console.error('Error updating item:', error);
      return;
    }
    dispatch({ type: 'UPDATE_ITEM', payload: item });
  };

  const createItem = async (item: Omit<Item, 'id' | 'tenant_id' | 'created_at'>): Promise<Item | null> => {
    if (!tenant) return null;

    const { data: newItem, error } = await supabase
      .from('items')
      .insert({
        tenant_id: tenant.id,
        name: item.name,
        supplier_id: item.supplier_id,
        category: item.category,
        country_of_origin: item.country_of_origin,
        size: item.size,
        carton_size: item.carton_size,
        purchase_price: item.purchase_price,
        wholesale_price: item.wholesale_price || 0,
        carton_price: item.carton_price,
        rrp: item.rrp,
        barcode: item.barcode,
        tax_rate: item.tax_rate,
        xero_account_code: item.xero_account_code,
        xero_item_code: item.xero_item_code,
        status: item.status || 'active',
        image_url: item.image_url,
        image_path: item.image_path,
        is_favourite: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating item:', error);
      return null;
    }

    dispatch({ type: 'ADD_ITEM', payload: newItem });
    return newItem;
  };

  // Order operations
  const createOrder = async (order: Omit<Order, 'id' | 'tenant_id' | 'created_at'>): Promise<Order | null> => {
    if (!tenant || !user) return null;

    const { items, ...orderData } = order;

    // Owners auto-approve, users need approval
    const status: OrderStatus = user.role === 'owner' ? 'approved' : 'pending_approval';

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        ...orderData,
        tenant_id: tenant.id,
        created_by: user.id,
        status,
        approved_by: user.role === 'owner' ? user.id : null,
        approved_at: user.role === 'owner' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return null;
    }

    if (items && items.length > 0) {
      const orderItems = items.map((item) => ({
        order_id: newOrder.id,
        tenant_id: tenant.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
        xero_item_code: item.xero_item_code || null,
        xero_account_code: item.xero_account_code || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
      }
    }

    const completeOrder = { ...newOrder, items: items || [] };
    dispatch({ type: 'ADD_ORDER', payload: completeOrder });
    return completeOrder;
  };

  // Create order on behalf of a customer (auto-approved for owners)
  const createOrderForCustomer = async (
    customerId: string,
    order: Omit<Order, 'id' | 'tenant_id' | 'created_at'>
  ): Promise<Order | null> => {
    if (!tenant || !user) return null;

    const { items, ...orderData } = order;

    // Orders created for customers by owners are auto-approved
    const status: OrderStatus = 'approved';

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        ...orderData,
        tenant_id: tenant.id,
        created_by: customerId, // The customer on whose behalf the order is created
        status,
        approved_by: user.id, // The owner who created/approved
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order for customer:', orderError);
      return null;
    }

    if (items && items.length > 0) {
      const orderItems = items.map((item) => ({
        order_id: newOrder.id,
        tenant_id: tenant.id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
        xero_item_code: item.xero_item_code || null,
        xero_account_code: item.xero_account_code || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
      }
    }

    const completeOrder = { ...newOrder, items: items || [] };
    dispatch({ type: 'ADD_ORDER', payload: completeOrder });

    // Generate invoice for the order and sync to Xero
    const invoice = await generateInvoice(completeOrder);
    if (invoice) {
      // Try to sync to Xero (non-blocking)
      syncInvoiceToXero(completeOrder.id, invoice.id);
    }

    return completeOrder;
  };

  // Helper function to sync invoice to Xero (non-blocking with delay)
  const syncInvoiceToXero = async (orderId: string, invoiceId: string) => {
    if (!tenant) return;

    try {
      // Check if Xero is connected
      const xeroStatus = await checkXeroConnection(tenant.id);
      if (!xeroStatus.connected) {
        console.log('Xero not connected, marking as export_failed');
        // Mark as export_failed so it shows in the list with retry option
        await supabase.from('invoices').update({
          status: 'export_failed',
        }).eq('id', invoiceId);
        await loadInvoices();
        return;
      }

      console.log('Starting Xero sync for invoice:', invoiceId);

      // Create invoice in Xero (Edge Function handles everything including PDF)
      const result = await createXeroInvoice(orderId, invoiceId);

      if (result.success) {
        console.log('Invoice synced to Xero:', result.xero_invoice_id);
        // Wait 5 seconds then reload invoices to get updated data from database
        setTimeout(async () => {
          console.log('Reloading invoices after Xero sync...');
          await loadInvoices();
        }, 5000);
      } else {
        console.warn('Failed to sync invoice to Xero:', result.error);
        // Mark as export failed in database
        await supabase.from('invoices').update({
          status: 'export_failed',
        }).eq('id', invoiceId);
        // Reload to reflect the failed status
        await loadInvoices();
      }
    } catch (error) {
      console.error('Error syncing to Xero:', error);
      // Mark as export failed on error
      await supabase.from('invoices').update({
        status: 'export_failed',
      }).eq('id', invoiceId);
      await loadInvoices();
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus, approverId?: string) => {
    const updateData: any = { status };
    if (status === 'approved' && approverId) {
      updateData.approved_by = approverId;
      updateData.approved_at = new Date().toISOString();
    }
    if (status === 'sent') {
      updateData.sent_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order status:', error);
      return;
    }

    const order = state.orders.find((o) => o.id === orderId);
    if (order) {
      dispatch({ type: 'UPDATE_ORDER', payload: { ...order, ...updateData } });
    }
  };

  const deleteOrder = async (orderId: string): Promise<boolean> => {
    await supabase.from('order_items').delete().eq('order_id', orderId);
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) {
      console.error('Error deleting order:', error);
      return false;
    }
    dispatch({ type: 'SET_ORDERS', payload: state.orders.filter((o) => o.id !== orderId) });
    return true;
  };

  const updateOrder = async (orderId: string, updates: Partial<Order>): Promise<Order | null> => {
    const { items: _items, ...orderUpdates } = updates as any;

    const { data, error } = await supabase
      .from('orders')
      .update(orderUpdates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('Error updating order:', error);
      return null;
    }

    const existingOrder = state.orders.find((o) => o.id === orderId);
    const updatedOrder = { ...existingOrder, ...data, items: existingOrder?.items || [] };
    dispatch({ type: 'UPDATE_ORDER', payload: updatedOrder });
    return updatedOrder;
  };

  const updateOrderItems = async (orderId: string, items: any[]): Promise<boolean> => {
    if (!tenant) return false;

    // Delete existing order items
    await supabase.from('order_items').delete().eq('order_id', orderId);

    // Insert new order items
    const orderItems = items.map((item) => ({
      order_id: orderId,
      tenant_id: tenant.id,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
      xero_item_code: item.xero_item_code || null,
      xero_account_code: item.xero_account_code || null,
    }));

    const { error } = await supabase.from('order_items').insert(orderItems);

    if (error) {
      console.error('Error updating order items:', error);
      return false;
    }

    // Update the order in state with new items
    const existingOrder = state.orders.find((o) => o.id === orderId);
    if (existingOrder) {
      const updatedOrder = { ...existingOrder, items: orderItems };
      dispatch({ type: 'UPDATE_ORDER', payload: updatedOrder });
    }

    return true;
  };

  // Invoice operations
  const generateInvoice = async (order: Order): Promise<Invoice | null> => {
    if (!tenant) return null;

    const invoiceNumber = `INV-${order.order_number || order.id.substring(0, 8)}`;

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        tenant_id: tenant.id,
        supplier_id: order.supplier_id,
        order_id: order.id,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        subtotal: order.subtotal || order.total,
        tax: order.tax || 0,
        total: order.total,
        status: 'pending',
        match_status: 'matched',
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error generating invoice:', invoiceError);
      return null;
    }

    // Create invoice items from order items
    if (order.items && order.items.length > 0) {
      const invoiceItems = order.items.map((item) => ({
        invoice_id: invoice.id,
        tenant_id: tenant.id,
        order_item_id: item.id,
        description: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
      }));

      await supabase.from('invoice_items').insert(invoiceItems);
    }

    dispatch({ type: 'ADD_INVOICE', payload: invoice });
    return invoice;
  };

  // Approve order and generate invoice in one transaction
  const approveOrderWithInvoice = async (orderId: string, approverId: string): Promise<{ order: Order; invoice: Invoice } | null> => {
    // First update the order status to approved
    const updateData = {
      status: 'approved' as OrderStatus,
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      console.error('Error approving order:', error);
      return null;
    }

    // Get the full order with items for invoice generation
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) {
      console.error('Order not found:', orderId);
      return null;
    }

    const approvedOrder = { ...order, ...updateData };
    dispatch({ type: 'UPDATE_ORDER', payload: approvedOrder });

    // Generate invoice for the approved order
    const invoice = await generateInvoice(approvedOrder);
    if (!invoice) {
      console.error('Failed to generate invoice for order:', orderId);
      // Order is approved but invoice failed - still return the order
      return { order: approvedOrder, invoice: null as any };
    }

    // Sync to Xero (non-blocking)
    syncInvoiceToXero(orderId, invoice.id);

    return { order: approvedOrder, invoice };
  };

  const exportToXero = async (invoiceId: string): Promise<boolean> => {
    // Find the invoice and its order
    const invoice = state.invoices.find(i => i.id === invoiceId);
    if (!invoice || !invoice.order_id) {
      console.error('Invoice or order not found');
      throw new Error('Invoice or order not found');
    }

    // Use the Xero service to create the invoice
    const result = await createXeroInvoice(invoice.order_id, invoiceId);
    if (!result.success) {
      console.error('Failed to export to Xero:', result.error);
      // Mark as export failed
      dispatch({
        type: 'UPDATE_INVOICE',
        payload: {
          ...invoice,
          status: 'export_failed',
        },
      });
      await supabase.from('invoices').update({
        status: 'export_failed',
      }).eq('id', invoiceId);
      throw new Error(result.error || 'Failed to export to Xero');
    }

    // Reload invoices from database to get latest data (including pdf_storage_path set by Edge Function)
    await loadInvoices();

    return true;
  };

  // Legacy exportToXero function (keeping for backward compatibility)
  const exportToXeroLegacy = async (invoiceId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('invoices')
      .update({
        xero_invoice_id: `XERO-${invoiceId.substring(0, 8)}`,
        exported_at: new Date().toISOString(),
        status: 'exported',
      })
      .eq('id', invoiceId);

    if (error) {
      console.error('Error exporting to Xero:', error);
      return false;
    }

    const invoice = state.invoices.find((i) => i.id === invoiceId);
    if (invoice) {
      dispatch({
        type: 'UPDATE_INVOICE',
        payload: {
          ...invoice,
          xero_invoice_id: `XERO-${invoiceId.substring(0, 8)}`,
          exported_at: new Date().toISOString(),
          status: 'exported',
        },
      });
    }
    return true;
  };

  // Create order for a specific tenant (used by customers ordering from multiple suppliers)
  const createOrderForTenant = async (
    tenantId: string,
    order: Omit<Order, 'id' | 'tenant_id' | 'created_at'>
  ): Promise<Order | null> => {
    if (!user) return null;

    const { items, ...orderData } = order;

    // Customer orders are pending approval
    const status: OrderStatus = 'pending_approval';

    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        ...orderData,
        tenant_id: tenantId, // Use the supplier's tenant
        created_by: user.id,
        status,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order for tenant:', orderError);
      return null;
    }

    if (items && items.length > 0) {
      const orderItems = items.map((item) => ({
        order_id: newOrder.id,
        tenant_id: tenantId,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
        xero_item_code: item.xero_item_code || null,
        xero_account_code: item.xero_account_code || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
      }
    }

    const completeOrder = { ...newOrder, items: items || [] };
    dispatch({ type: 'ADD_ORDER', payload: completeOrder });
    return completeOrder;
  };

  // Utility
  const getSupplierName = (supplierId: string): string => {
    const supplier = state.suppliers.find((s) => s.id === supplierId);
    return supplier?.name || 'Unknown Supplier';
  };

  const getTenantName = (tenantId: string): string => {
    // First check connected tenants (for customers)
    const connectedTenant = state.connectedTenants.find((t) => t.id === tenantId);
    if (connectedTenant) return connectedTenant.name;
    // Fall back to current tenant
    if (tenant?.id === tenantId) return tenant.name;
    return 'Unknown Supplier';
  };

  const getCartTotal = (): number => {
    return state.cart.reduce(
      (sum, c) => sum + (c.item?.wholesale_price || 0) * c.quantity,
      0
    );
  };

  const getCartQuantity = (itemId: string): number => {
    const cartItem = state.cart.find((c) => c.item_id === itemId);
    return cartItem?.quantity || 0;
  };

  const getPendingApprovalCount = (): number => {
    return state.orders.filter((o) => o.status === 'pending_approval').length;
  };

  return (
    <OrderContext.Provider
      value={{
        state,
        loadAllData,
        loadUsers,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        clearCartByTenant,
        toggleFavourite,
        updateItem,
        createItem,
        createOrder,
        createOrderForCustomer,
        updateOrderStatus,
        updateOrder,
        updateOrderItems,
        deleteOrder,
        loadInvoices,
        generateInvoice,
        approveOrderWithInvoice,
        exportToXero,
        getSupplierName,
        getTenantName,
        getCartTotal,
        getCartQuantity,
        getPendingApprovalCount,
        createOrderForTenant,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within OrderProvider');
  }
  return context;
}
