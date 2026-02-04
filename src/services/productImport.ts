// Product Import Service
// Imports products from the static catalog into Supabase

import { supabase } from '../lib/supabase';
import { PRODUCTS, SUPPLIERS, ProductData } from '../data/productCatalog';

interface ImportResult {
  success: boolean;
  suppliersCreated: number;
  productsCreated: number;
  productsUpdated: number;
  errors: string[];
}

interface SupplierMap {
  [name: string]: string; // supplier name -> supplier id
}

export async function importProductCatalog(tenantId: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    suppliersCreated: 0,
    productsCreated: 0,
    productsUpdated: 0,
    errors: [],
  };

  try {
    // Step 1: Create or fetch suppliers
    const supplierMap = await ensureSuppliers(tenantId, result);
    if (!supplierMap) {
      return result;
    }

    // Step 2: Import products
    await importProducts(tenantId, supplierMap, result);

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

async function ensureSuppliers(tenantId: string, result: ImportResult): Promise<SupplierMap | null> {
  const supplierMap: SupplierMap = {};

  // First, fetch existing suppliers for this tenant
  const { data: existingSuppliers, error: fetchError } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('tenant_id', tenantId);

  if (fetchError) {
    result.errors.push(`Failed to fetch existing suppliers: ${fetchError.message}`);
    return null;
  }

  // Build map of existing suppliers
  existingSuppliers?.forEach((s) => {
    supplierMap[s.name] = s.id;
  });

  // Create missing suppliers
  for (const supplier of SUPPLIERS) {
    if (!supplierMap[supplier.name]) {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          tenant_id: tenantId,
          name: supplier.name,
          orders_email: '',
          contact_name: '',
          contact_phone: '',
          delivery_fee: 0,
          min_order: 0,
          cutoff_time: '17:00',
          delivery_days: ['Monday', 'Wednesday', 'Friday'],
          status: 'active',
        })
        .select('id')
        .single();

      if (error) {
        result.errors.push(`Failed to create supplier "${supplier.name}": ${error.message}`);
      } else if (data) {
        supplierMap[supplier.name] = data.id;
        result.suppliersCreated++;
      }
    }
  }

  return supplierMap;
}

async function importProducts(
  tenantId: string,
  supplierMap: SupplierMap,
  result: ImportResult
): Promise<void> {
  // Fetch existing items to check for duplicates (by barcode or name)
  const { data: existingItems, error: fetchError } = await supabase
    .from('items')
    .select('id, barcode, name')
    .eq('tenant_id', tenantId);

  if (fetchError) {
    result.errors.push(`Failed to fetch existing items: ${fetchError.message}`);
    return;
  }

  const existingBarcodeMap: { [barcode: string]: string } = {};
  const existingNameMap: { [name: string]: string } = {};
  existingItems?.forEach((item) => {
    if (item.barcode) {
      existingBarcodeMap[item.barcode] = item.id;
    }
    existingNameMap[item.name] = item.id;
  });

  // Generate a batch ID for this import
  const batchId = `import-${Date.now()}`;

  // Process products in batches to avoid overwhelming the database
  const batchSize = 50;
  for (let i = 0; i < PRODUCTS.length; i += batchSize) {
    const batch = PRODUCTS.slice(i, i + batchSize);
    await processBatch(tenantId, supplierMap, existingBarcodeMap, existingNameMap, batch, batchId, result);
  }
}

function isValidCategory(category?: string): boolean {
  if (!category) return false;
  const vague = ['product', 'products', 'variety', 'item', 'items', 'other', 'misc', 'miscellaneous'];
  return !vague.includes(category.toLowerCase());
}

async function processBatch(
  tenantId: string,
  supplierMap: SupplierMap,
  existingBarcodeMap: { [barcode: string]: string },
  existingNameMap: { [name: string]: string },
  products: ProductData[],
  batchId: string,
  result: ImportResult
): Promise<void> {
  const toInsert: any[] = [];
  const toUpdate: { id: string; data: any }[] = [];

  for (const product of products) {
    const supplierId = supplierMap[product.supplier];
    if (!supplierId) {
      result.errors.push(`Supplier not found for product "${product.name}": ${product.supplier}`);
      continue;
    }

    // Calculate carton price
    const cartonPrice = Math.round(product.wholesale_price * product.carton_size * 100) / 100;

    // Determine country of origin (only for Packaged Nuts from Alfie's)
    let countryOfOrigin: string | undefined;
    if (product.category === 'Packaged Nuts' && product.supplier === "Alfie's Food Co.") {
      countryOfOrigin = 'Australia';
    }

    // Clean category (leave blank if vague)
    const category = isValidCategory(product.category) ? product.category : undefined;

    const itemData = {
      tenant_id: tenantId,
      name: product.name,
      category: category,
      country_of_origin: countryOfOrigin,
      size: product.size,
      carton_size: product.carton_size,
      wholesale_price: product.wholesale_price,
      carton_price: cartonPrice,
      rrp: product.rrp,
      barcode: product.barcode || null,
      supplier_id: supplierId,
      status: 'active',
      import_batch_id: batchId,
    };

    // Check for existing item by barcode first, then by name
    let existingId: string | undefined;
    if (product.barcode && existingBarcodeMap[product.barcode]) {
      existingId = existingBarcodeMap[product.barcode];
    } else if (existingNameMap[product.name]) {
      existingId = existingNameMap[product.name];
    }

    if (existingId) {
      toUpdate.push({ id: existingId, data: itemData });
    } else {
      toInsert.push(itemData);
    }
  }

  // Insert new products
  if (toInsert.length > 0) {
    const { error } = await supabase.from('items').insert(toInsert);
    if (error) {
      result.errors.push(`Failed to insert products: ${error.message}`);
    } else {
      result.productsCreated += toInsert.length;
    }
  }

  // Update existing products
  for (const { id, data } of toUpdate) {
    const { error } = await supabase
      .from('items')
      .update({
        name: data.name,
        category: data.category,
        country_of_origin: data.country_of_origin,
        size: data.size,
        carton_size: data.carton_size,
        wholesale_price: data.wholesale_price,
        carton_price: data.carton_price,
        rrp: data.rrp,
        barcode: data.barcode,
        supplier_id: data.supplier_id,
        import_batch_id: data.import_batch_id,
      })
      .eq('id', id);

    if (error) {
      result.errors.push(`Failed to update product ${data.name}: ${error.message}`);
    } else {
      result.productsUpdated++;
    }
  }
}

// Export count for UI display
export function getProductCatalogCount(): { products: number; suppliers: number } {
  return {
    products: PRODUCTS.length,
    suppliers: SUPPLIERS.length,
  };
}
