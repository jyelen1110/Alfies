// Product and Customer matching utilities
import { Item, User } from '../types';

export type MatchConfidence = 'exact' | 'high' | 'low' | 'none';

export interface ProductMatchResult {
  item: Item | null;
  confidence: MatchConfidence;
  matchedBy: 'barcode' | 'name' | null;
}

export interface CustomerMatchResult {
  user: User | null;
  confidence: MatchConfidence;
  matchedBy: 'business_name' | 'contact_name' | 'partial' | null;
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 and 1 (1 being exact match)
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.85; // High match for containment
  }

  // Levenshtein distance calculation
  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
}

/**
 * Normalize product name for comparison
 */
function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize barcode by removing spaces and leading zeros
 */
function normalizeBarcode(barcode: string): string {
  return barcode.replace(/\s+/g, '').replace(/^0+/, '').trim();
}

/**
 * Match a product by barcode or name against the items catalog
 */
export function matchProduct(
  barcode: string,
  productName: string,
  items: Item[]
): ProductMatchResult {
  if (!items || items.length === 0) {
    return { item: null, confidence: 'none', matchedBy: null };
  }

  const normalizedBarcode = normalizeBarcode(barcode);
  const normalizedName = normalizeProductName(productName);

  // 1. Try exact barcode match first
  if (normalizedBarcode) {
    const barcodeMatch = items.find((item) => {
      if (!item.barcode) return false;
      return normalizeBarcode(item.barcode) === normalizedBarcode;
    });

    if (barcodeMatch) {
      return { item: barcodeMatch, confidence: 'exact', matchedBy: 'barcode' };
    }
  }

  // 2. Try normalized name contains match
  if (normalizedName) {
    for (const item of items) {
      const itemName = normalizeProductName(item.name);

      // Check if names are equal or contain each other
      if (itemName === normalizedName) {
        return { item, confidence: 'high', matchedBy: 'name' };
      }

      if (itemName.includes(normalizedName) || normalizedName.includes(itemName)) {
        return { item, confidence: 'high', matchedBy: 'name' };
      }
    }
  }

  // 3. Try fuzzy name match (>80% similarity)
  if (normalizedName) {
    let bestMatch: Item | null = null;
    let bestSimilarity = 0;

    for (const item of items) {
      const similarity = stringSimilarity(normalizedName, item.name);
      if (similarity > bestSimilarity && similarity >= 0.8) {
        bestMatch = item;
        bestSimilarity = similarity;
      }
    }

    if (bestMatch) {
      return { item: bestMatch, confidence: 'low', matchedBy: 'name' };
    }
  }

  // No match found
  return { item: null, confidence: 'none', matchedBy: null };
}

/**
 * Match a customer by name against the users list
 */
export function matchCustomer(
  customerName: string,
  users: User[]
): CustomerMatchResult {
  if (!customerName || !users || users.length === 0) {
    return { user: null, confidence: 'none', matchedBy: null };
  }

  const normalizedName = customerName.toLowerCase().trim();

  // 1. Try exact business_name match
  const businessMatch = users.find(
    (u) => u.business_name?.toLowerCase().trim() === normalizedName
  );
  if (businessMatch) {
    return { user: businessMatch, confidence: 'exact', matchedBy: 'business_name' };
  }

  // 2. Try exact contact_name match
  const contactMatch = users.find(
    (u) => u.contact_name?.toLowerCase().trim() === normalizedName
  );
  if (contactMatch) {
    return { user: contactMatch, confidence: 'exact', matchedBy: 'contact_name' };
  }

  // 3. Try exact full_name match
  const fullNameMatch = users.find(
    (u) => u.full_name?.toLowerCase().trim() === normalizedName
  );
  if (fullNameMatch) {
    return { user: fullNameMatch, confidence: 'exact', matchedBy: 'contact_name' };
  }

  // 4. Try partial match (contains)
  for (const user of users) {
    const businessName = user.business_name?.toLowerCase().trim() || '';
    const contactName = user.contact_name?.toLowerCase().trim() || '';
    const fullName = user.full_name?.toLowerCase().trim() || '';

    if (
      businessName.includes(normalizedName) ||
      normalizedName.includes(businessName) ||
      contactName.includes(normalizedName) ||
      normalizedName.includes(contactName) ||
      fullName.includes(normalizedName) ||
      normalizedName.includes(fullName)
    ) {
      return { user, confidence: 'high', matchedBy: 'partial' };
    }
  }

  // 5. Try fuzzy match
  let bestMatch: User | null = null;
  let bestSimilarity = 0;

  for (const user of users) {
    const similarities = [
      stringSimilarity(normalizedName, user.business_name || ''),
      stringSimilarity(normalizedName, user.contact_name || ''),
      stringSimilarity(normalizedName, user.full_name || ''),
    ];
    const maxSimilarity = Math.max(...similarities);

    if (maxSimilarity > bestSimilarity && maxSimilarity >= 0.7) {
      bestMatch = user;
      bestSimilarity = maxSimilarity;
    }
  }

  if (bestMatch) {
    return { user: bestMatch, confidence: 'low', matchedBy: 'partial' };
  }

  return { user: null, confidence: 'none', matchedBy: null };
}
