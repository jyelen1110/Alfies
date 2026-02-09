import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

const supabaseUrl = 'https://cijgmmckafmfmmlpvgyi.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface XeroItem {
  itemCode: string;
  itemName: string;
  salesDescription: string;
  salesUnitPrice: number;
  status: string;
}

async function main() {
  // Read CSV file
  const csvPath = process.argv[2] || 'C:\\Users\\yelen\\OneDrive\\Desktop\\InventoryItems-20260209.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');

  // Parse CSV
  const lines = csvContent.split('\n').filter(line => line.trim() && !line.match(/^,+$/));
  const headers = lines[0].split(',').map(h => h.replace(/^\*/, '').trim());

  console.log('Headers:', headers);

  const items: XeroItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.match(/^,+$/)) continue;

    // Handle CSV with possible quoted fields
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const itemCode = values[0];
    const itemName = values[1];
    const salesDescription = values[3];
    const salesUnitPrice = parseFloat(values[4]) || 0;
    const status = values[7];

    if (!itemCode || !status) continue;

    items.push({
      itemCode,
      itemName,
      salesDescription,
      salesUnitPrice,
      status
    });
  }

  console.log(`Parsed ${items.length} items from CSV`);

  // Filter active items only
  const activeItems = items.filter(item => item.status === 'Active');
  console.log(`Active items: ${activeItems.length}`);

  // Get supplier ID for Alfie's Food Co
  const { data: suppliers, error: supplierError } = await supabase
    .from('suppliers')
    .select('id, name, tenant_id')
    .ilike('name', '%alfie%');

  if (supplierError || !suppliers || suppliers.length === 0) {
    console.error('Could not find Alfie\'s supplier:', supplierError);
    process.exit(1);
  }

  console.log('Found suppliers:', suppliers);
  const supplier = suppliers[0];
  const tenantId = supplier.tenant_id;
  const supplierId = supplier.id;

  console.log(`Using supplier: ${supplier.name} (${supplierId})`);
  console.log(`Tenant ID: ${tenantId}`);

  // First, mark all existing items for this supplier as inactive
  const { error: deactivateError } = await supabase
    .from('items')
    .update({ status: 'inactive' })
    .eq('supplier_id', supplierId);

  if (deactivateError) {
    console.error('Error deactivating existing items:', deactivateError);
  } else {
    console.log('Deactivated all existing items for this supplier');
  }

  // Now upsert the active items from CSV
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const item of activeItems) {
    const name = item.itemName;
    const sku = item.itemCode;

    // Check if item exists by SKU
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('sku', sku)
      .single();

    if (existing) {
      // Update existing item
      const { error } = await supabase
        .from('items')
        .update({
          name,
          xero_item_code: sku,  // Store ItemCode as xero_item_code
          wholesale_price: item.salesUnitPrice,
          status: 'active'
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`Error updating ${sku}:`, error.message);
        errors++;
      } else {
        updated++;
      }
    } else {
      // Create new item
      const { error } = await supabase
        .from('items')
        .insert({
          tenant_id: tenantId,
          supplier_id: supplierId,
          name,
          sku,
          xero_item_code: sku,  // Store ItemCode as xero_item_code
          wholesale_price: item.salesUnitPrice,
          status: 'active'
        });

      if (error) {
        console.error(`Error creating ${sku}:`, error.message);
        errors++;
      } else {
        created++;
      }
    }
  }

  console.log(`\nResults:`);
  console.log(`  Created: ${created}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Total active items in DB: ${created + updated}`);
}

main().catch(console.error);
