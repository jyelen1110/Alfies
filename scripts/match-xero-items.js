const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase config
const supabaseUrl = 'https://cijgmmckafmfmmlpvgyi.supabase.co';
const supabaseKey = 'sb_secret_NgMIbQH3SWIhqpUE1-4PBg_6sQ2YJzi';

const supabase = createClient(supabaseUrl, supabaseKey);

// Parse CSV
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === ',,,,,,,') continue; // Skip empty lines

    const values = line.split(',');
    if (!values[0] || values[0].startsWith('*')) continue; // Skip if no ItemCode

    items.push({
      itemCode: values[0],
      itemName: values[1],
      purchasesDescription: values[2],
      salesDescription: values[3],
      salesUnitPrice: parseFloat(values[4]) || 0,
      salesAccount: values[5],
      salesTaxRate: values[6],
      status: values[7]
    });
  }

  return items;
}

// Normalize string for matching
function normalize(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim();
}

// Calculate similarity score
function similarity(str1, str2) {
  const s1 = normalize(str1);
  const s2 = normalize(str2);

  if (s1 === s2) return 1.0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Simple word overlap
  const words1 = s1.split(' ');
  const words2 = s2.split(' ');
  const common = words1.filter(w => words2.includes(w)).length;
  const total = Math.max(words1.length, words2.length);

  return common / total;
}

async function matchItems() {
  console.log('Loading Xero items from CSV...');
  const csvPath = 'C:\\Users\\yelen\\OneDrive\\Desktop\\InventoryItems-20260209.csv';
  const xeroItems = parseCSV(csvPath);
  console.log(`Found ${xeroItems.length} items in Xero CSV`);

  console.log('\nFetching existing items from database...');
  const { data: dbItems, error } = await supabase
    .from('items')
    .select('id, name, sku, wholesale_price, xero_item_code, xero_account_code, status, tenant_id')
    .order('name');

  if (error) {
    console.error('Error fetching items:', error);
    return;
  }

  console.log(`Found ${dbItems.length} items in database`);

  // Match items
  const matches = [];
  const unmatched = [];

  for (const dbItem of dbItems) {
    let bestMatch = null;
    let bestScore = 0;

    for (const xeroItem of xeroItems) {
      const nameScore = similarity(dbItem.name, xeroItem.itemName);
      const descScore = similarity(dbItem.name, xeroItem.salesDescription);
      const score = Math.max(nameScore, descScore);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = xeroItem;
      }
    }

    if (bestScore >= 0.6) { // 60% similarity threshold
      matches.push({
        dbItem,
        xeroItem: bestMatch,
        score: bestScore,
        priceMatch: Math.abs(dbItem.wholesale_price - bestMatch.salesUnitPrice) < 0.01
      });
    } else {
      unmatched.push(dbItem);
    }
  }

  // Generate report
  console.log('\n' + '='.repeat(80));
  console.log('MATCHING REPORT');
  console.log('='.repeat(80));
  console.log(`\nMatched: ${matches.length} items`);
  console.log(`Unmatched: ${unmatched.length} items`);

  // Save detailed report
  const report = {
    summary: {
      totalDbItems: dbItems.length,
      totalXeroItems: xeroItems.length,
      matched: matches.length,
      unmatched: unmatched.length,
      generatedAt: new Date().toISOString()
    },
    matches: matches.map(m => ({
      db_id: m.dbItem.id,
      db_name: m.dbItem.name,
      db_price: m.dbItem.wholesale_price,
      db_xero_code: m.dbItem.xero_item_code,
      xero_code: m.xeroItem.itemCode,
      xero_name: m.xeroItem.itemName,
      xero_price: m.xeroItem.salesUnitPrice,
      xero_account: m.xeroItem.salesAccount,
      xero_status: m.xeroItem.status,
      match_score: m.score.toFixed(2),
      price_match: m.priceMatch ? 'Yes' : 'No'
    })),
    unmatched: unmatched.map(item => ({
      id: item.id,
      name: item.name,
      price: item.wholesale_price
    }))
  };

  const reportPath = path.join(__dirname, 'xero-match-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);

  // Print sample matches
  console.log('\n' + '='.repeat(80));
  console.log('SAMPLE MATCHES (Top 20)');
  console.log('='.repeat(80));
  console.log('\nDB Name → Xero Code | Xero Name | Score | Price Match');
  console.log('-'.repeat(80));

  matches.slice(0, 20).forEach(m => {
    console.log(`${m.dbItem.name.substring(0, 40).padEnd(40)} → ${m.xeroItem.itemCode} | ${m.xeroItem.itemName.substring(0, 30)} | ${(m.score * 100).toFixed(0)}% | ${m.priceMatch ? '✓' : '✗'}`);
  });

  if (unmatched.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('UNMATCHED ITEMS (Sample)');
    console.log('='.repeat(80));
    unmatched.slice(0, 10).forEach(item => {
      console.log(`- ${item.name}`);
    });
  }

  console.log('\n' + '='.repeat(80));
}

matchItems().catch(console.error);
