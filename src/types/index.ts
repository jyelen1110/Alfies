// User types - simplified two-role system
export type UserRole = 'owner' | 'user';

export interface User {
  id: string;
  email: string;
  full_name: string;
  tenant_id: string;
  role: UserRole;
  is_master?: boolean;
  // Customer profile fields
  customer_id?: string; // Owner-assigned customer ID
  business_name?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  accounts_email?: string;
  delivery_address?: string;
  delivery_instructions?: string;
}

// Tenant access for master users
export interface TenantAccess {
  id: string;
  user_id: string;
  tenant_id: string;
  access_level: 'full' | 'read_only';
  created_at: string;
}

// Customer-Supplier relationship (multi-supplier support)
export interface CustomerSupplier {
  id: string;
  customer_id: string;
  supplier_tenant_id: string;
  status: 'active' | 'pending' | 'inactive';
  invited_at: string;
  accepted_at?: string;
  created_at: string;
  // Joined data
  tenant?: Tenant;
}

// Invitation types
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface UserInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: UserRole;
  token: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  accepted_at?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  settings: TenantSettings;
}

export interface TenantSettings {
  currency: string;
  timezone: string;
  date_format: string;
  tax_rate: number;
}

// Supplier types
export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  orders_email: string;
  contact_name?: string;
  contact_phone?: string;
  product_count: number;
  delivery_fee: number;
  free_delivery_min?: number;
  min_order: number;
  cutoff_time: string;
  delivery_days: string[];
  next_delivery?: string;
  status: string;
  created_at?: string;
}

// Item types
export interface Item {
  id: string;
  tenant_id: string;
  sku?: string;
  name: string;
  category?: string;
  country_of_origin?: string;
  size?: string;
  carton_size?: number;
  purchase_price?: number;
  wholesale_price: number;
  carton_price?: number;
  rrp?: number;
  barcode?: string;
  tax_rate?: number;
  xero_account_code?: string;
  xero_item_code?: string;
  supplier_id: string;
  status: 'active' | 'inactive' | 'sold_out';
  image_url?: string;
  image_path?: string; // Device-uploaded image in Supabase Storage
  is_favourite?: boolean;
  import_batch_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Cart types
export interface CartItem {
  id: string;
  tenant_id: string;
  user_id: string;
  item_id: string;
  item: Item;
  quantity: number;
  created_at?: string;
}

// Order types
export type OrderStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'delivered' | 'cancelled';

export interface OrderItem {
  id?: string;
  order_id?: string;
  tenant_id?: string;
  procurement_item_id?: string;
  code?: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total?: number;
  received_quantity?: number;
  xero_item_code?: string;
  xero_account_code?: string;
  created_at?: string;
}

export interface Order {
  id: string;
  tenant_id: string;
  supplier_id: string;
  location_id?: string;
  order_number?: string;
  order_date: string;
  requested_delivery_date?: string;
  actual_delivery_date?: string;
  subtotal?: number;
  tax?: number;
  delivery_fee?: number;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  notes?: string;
  sent_at?: string;
  created_by?: string;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
}

// Invoice types
export type InvoiceStatus = 'pending' | 'exported' | 'export_failed' | 'paid';

export interface Invoice {
  id: string;
  tenant_id: string;
  supplier_id: string;
  order_id?: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  match_status: 'matched' | 'matched_with_variance' | 'unmatched';
  variance_amount?: number;
  file_url?: string;
  xero_invoice_id?: string;
  exported_at?: string;
  pdf_storage_path?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  supplier?: { id: string; name: string };
  order?: { id: string };
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  tenant_id: string;
  procurement_item_id?: string;
  order_item_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at?: string;
}

// Constants
export const CATEGORIES = [
  'All',
  'Nut Butters',
  'Packaged Nuts',
  'Fruit Snacks',
  'Fruit Bars',
  'Beverages',
  'Hot Sauces',
  'Biscuits',
  'Crackers',
  'Condiments',
  'Sauces',
  'Pasta Sauces',
  'Pasta',
  'Jerky',
  'Pickles',
  'Dressings',
  'Snacks',
  'Muesli & Granola',
  'Protein Bars',
  'Snack Bars',
  'Pet Treats',
  'Confectionery',
  'Seasonings',
  'Spreads',
  'Personal Care',
  'Smallgoods',
  'Vegetables',
  'Fruit',
  'Dairy',
  'Frozen',
  'Other',
] as const;

export const UNITS = [
  'kg', 'g', 'L', 'mL', 'each', 'bunch', 'pack', 'box', 'case', 'carton', 'dozen', 'bottle', 'can', 'jar', 'bag', 'tray', 'pallet'
] as const;

export const formatCutoffTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};
