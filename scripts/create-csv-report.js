const fs = require('fs');
const path = require('path');

// Read the JSON report
const reportPath = path.join(__dirname, 'xero-match-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

// Create CSV
const csvLines = [
  'DB Item Name,DB Price,Current Xero Code,Matched Xero Code,Xero Name,Xero Price,Xero Account,Xero Status,Match Score,Price Match'
];

report.matches.forEach(m => {
  const line = [
    `"${m.db_name.replace(/"/g, '""')}"`,
    m.db_price,
    m.db_xero_code || '',
    m.xero_code,
    `"${m.xero_name.replace(/"/g, '""')}"`,
    m.xero_price,
    m.xero_account,
    m.xero_status,
    m.match_score,
    m.price_match
  ].join(',');
  csvLines.push(line);
});

const csvPath = path.join(__dirname, 'xero-match-report.csv');
fs.writeFileSync(csvPath, csvLines.join('\n'));

console.log(`CSV report created: ${csvPath}`);
console.log(`\nSummary:`);
console.log(`- Total items matched: ${report.matches.length}`);
console.log(`- Perfect matches (100%): ${report.matches.filter(m => m.match_score === '1.00').length}`);
console.log(`- Price matches: ${report.matches.filter(m => m.price_match === 'Yes').length}`);
console.log(`- Items with existing Xero code: ${report.matches.filter(m => m.db_xero_code).length}`);
console.log(`- Items needing Xero code: ${report.matches.filter(m => !m.db_xero_code).length}`);
