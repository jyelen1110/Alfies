const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cijgmmckafmfmmlpvgyi.supabase.co';
const supabaseServiceKey = 'sb_secret_NgMIbQH3SWIhqpUE1-4PBg_6sQ2YJzi';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
  console.log('Checking tenants...');
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name, slug, xero_tenant_id')
    .limit(10);

  if (tenantError) {
    console.error('Error:', tenantError);
    return;
  }

  console.log(`Found ${tenants.length} tenants:`);
  tenants.forEach(t => {
    console.log(`- ${t.name} (${t.slug}) - Xero: ${t.xero_tenant_id ? 'Connected' : 'Not connected'}`);
  });

  if (tenants.length > 0) {
    console.log('\nChecking items for first tenant...');
    const { data: items, error: itemError } = await supabase
      .from('items')
      .select('id, name, xero_item_code, tenant_id')
      .eq('tenant_id', tenants[0].id)
      .limit(10);

    if (itemError) {
      console.error('Error:', itemError);
    } else {
      console.log(`Found ${items.length} items for tenant "${tenants[0].name}"`);
      items.forEach(i => console.log(`- ${i.name} (Xero code: ${i.xero_item_code || 'none'})`));
    }
  }
}

checkData();
