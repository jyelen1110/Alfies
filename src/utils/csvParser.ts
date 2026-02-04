// CSV Parser for order imports
// Expected format: Date,OrderNumber,CustomerName,Barcode,,ProductName,Quantity,0

export interface ParsedOrderLine {
  date: string;
  orderNumber: string;
  customerName: string;
  barcode: string;
  productName: string;
  quantity: number;
  lineIndex: number;
}

export interface ParsedCSVResult {
  success: boolean;
  lines: ParsedOrderLine[];
  orderNumber: string;
  customerName: string;
  date: string;
  error?: string;
}

/**
 * Normalize date from DD/MM/YYYY to YYYY-MM-DD
 */
export function normalizeDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];

  // Check if it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Parse DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Normalize barcode by removing spaces
 */
function normalizeBarcode(barcode: string): string {
  return barcode.replace(/\s+/g, '').trim();
}

/**
 * Parse CSV content into structured order lines
 */
export function parseOrderCSV(content: string): ParsedCSVResult {
  if (!content || content.trim().length === 0) {
    return {
      success: false,
      lines: [],
      orderNumber: '',
      customerName: '',
      date: '',
      error: 'Empty CSV file',
    };
  }

  const lines = content.trim().split('\n');

  if (lines.length === 0) {
    return {
      success: false,
      lines: [],
      orderNumber: '',
      customerName: '',
      date: '',
      error: 'No data in CSV file',
    };
  }

  const parsedLines: ParsedOrderLine[] = [];
  let orderNumber = '';
  let customerName = '';
  let date = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split by comma, handling potential edge cases
    const columns = line.split(',');

    if (columns.length < 7) {
      continue; // Skip malformed lines
    }

    const [dateCol, orderNumCol, customerCol, barcodeCol, , productCol, quantityCol] = columns;

    // Skip header row if present
    if (dateCol.toLowerCase() === 'date' || orderNumCol.toLowerCase() === 'ordernumber') {
      continue;
    }

    const quantity = parseInt(quantityCol, 10);
    if (isNaN(quantity) || quantity <= 0) {
      continue; // Skip lines with invalid quantity
    }

    // Capture order-level info from first valid line
    if (!orderNumber && orderNumCol) {
      orderNumber = orderNumCol.trim();
    }
    if (!customerName && customerCol) {
      customerName = customerCol.trim();
    }
    if (!date && dateCol) {
      date = normalizeDate(dateCol.trim());
    }

    parsedLines.push({
      date: normalizeDate(dateCol.trim()),
      orderNumber: orderNumCol.trim(),
      customerName: customerCol.trim(),
      barcode: normalizeBarcode(barcodeCol || ''),
      productName: productCol?.trim() || '',
      quantity,
      lineIndex: i,
    });
  }

  if (parsedLines.length === 0) {
    return {
      success: false,
      lines: [],
      orderNumber: '',
      customerName: '',
      date: '',
      error: 'No valid order lines found in CSV',
    };
  }

  return {
    success: true,
    lines: parsedLines,
    orderNumber,
    customerName,
    date,
  };
}
