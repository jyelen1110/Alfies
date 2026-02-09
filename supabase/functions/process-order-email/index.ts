import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Attachment {
  filename: string;
  contentType: string;
  content: string; // base64
}

interface EmailPayload {
  sender: string;
  subject: string;
  receivedDate: string;
  messageId: string;
  attachments: Attachment[];
  tenantId: string;
}

interface ParsedOrderData {
  supplierName: string;
  items: ParsedOrderItem[];
}

interface ParsedOrderItem {
  name: string;
  code?: string;
  sku?: string;
  quantity: number;
  unit?: string;
  unit_price?: number;
}

const orderParsePrompt = `You are an order data extractor. Extract order information from the provided document (purchase order, order confirmation, CSV, etc).

Return a JSON object with:
1. "supplierName": The supplier/vendor name (look for company name, "From:", "Supplier:", header, or letterhead)
2. "items": Array of order line items

Each item should have:
- name (required): product/item name
- code: product code/SKU if present
- sku: alternative SKU field
- quantity (required): quantity ordered as number
- unit: unit of measure (e.g., "each", "kg", "carton")
- unit_price: price per unit as number if present

Return ONLY valid JSON, no other text. Example:
{
  "supplierName": "ABC Supplies Pty Ltd",
  "items": [
    {"name": "Product A", "code": "ABC123", "quantity": 10, "unit": "each", "unit_price": 5.99}
  ]
}

If this is not an order document or you cannot extract order items, return:
{"supplierName": "", "items": []}`

async function parseAttachmentWithClaude(
  attachment: Attachment,
  anthropicKey: string
): Promise<ParsedOrderData> {
  const isImage = attachment.contentType.startsWith('image/') ||
                  attachment.contentType === 'application/pdf'

  let response

  if (isImage || attachment.contentType === 'application/pdf') {
    // For PDF/images, use vision model
    const mediaType = attachment.contentType === 'application/pdf'
      ? 'application/pdf'
      : attachment.contentType

    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: orderParsePrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: attachment.content,
                }
              },
              {
                type: 'text',
                text: `Extract the supplier name and all order line items from this document (${attachment.filename}). Return as JSON.`
              }
            ]
          }
        ],
      }),
    })
  } else {
    // For CSV/Excel text content, decode and send as text
    let textContent: string
    try {
      textContent = atob(attachment.content)
    } catch {
      textContent = attachment.content
    }

    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: orderParsePrompt,
        messages: [
          {
            role: 'user',
            content: `Extract the supplier name and order line items from this document content (${attachment.filename}):\n\n${textContent}`
          }
        ],
      }),
    })
  }

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Anthropic API error:', errorText)
    throw new Error(`AI parsing failed: ${errorText}`)
  }

  const aiResponse = await response.json()
  console.log(`Claude response for ${attachment.filename}:`, JSON.stringify(aiResponse).substring(0, 500))

  const content = aiResponse.content?.[0]?.text

  if (!content) {
    console.log(`No content in Claude response for ${attachment.filename}`)
    return { supplierName: '', items: [] }
  }

  // Parse JSON from response
  let jsonStr = content.trim()
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  try {
    const parsed = JSON.parse(jsonStr)
    console.log(`Parsed ${parsed.items?.length || 0} items from ${attachment.filename}`)
    return {
      supplierName: parsed.supplierName || '',
      items: (parsed.items || []).filter((item: ParsedOrderItem) => item.name && item.quantity)
    }
  } catch (parseError) {
    console.error(`JSON parse error for ${attachment.filename}:`, parseError, 'Content:', jsonStr.substring(0, 200))
    return { supplierName: '', items: [] }
  }
}

async function findSupplierByName(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  supplierName: string
): Promise<{ id: string; name: string } | null> {
  if (!supplierName) return null

  const searchName = supplierName.toLowerCase().trim()

  // Fetch all active suppliers for the tenant
  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  if (error || !suppliers) {
    console.error('Failed to fetch suppliers:', error)
    return null
  }

  // Try exact match first
  let match = suppliers.find(s => s.name.toLowerCase().trim() === searchName)

  // Try partial match (supplier name contains search or vice versa)
  if (!match) {
    match = suppliers.find(s => {
      const sName = s.name.toLowerCase().trim()
      return sName.includes(searchName) || searchName.includes(sName)
    })
  }

  // Try word-based matching (any significant word matches)
  if (!match) {
    const searchWords = searchName.split(/\s+/).filter(w => w.length > 3)
    match = suppliers.find(s => {
      const sName = s.name.toLowerCase()
      return searchWords.some(word => sName.includes(word))
    })
  }

  return match || null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: EmailPayload = await req.json()
    const { sender, subject, receivedDate, messageId, attachments, tenantId } = payload

    // Validate required fields
    if (!messageId || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: messageId, tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get environment variables
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if email already processed
    const { data: existingImport } = await supabase
      .from('email_order_imports')
      .select('id, order_id')
      .eq('message_id', messageId)
      .single()

    if (existingImport) {
      return new Response(
        JSON.stringify({
          error: 'Email already processed',
          existingOrderId: existingImport.order_id
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse attachments - prioritize CSV (smallest), then XLSX, then PDF
    let supplierName = ''
    let allParsedItems: ParsedOrderItem[] = []

    // Sort attachments: CSV first, then XLSX, then PDF
    const sortedAttachments = [...attachments].sort((a, b) => {
      const order = (att: Attachment) => {
        if (att.filename.toLowerCase().endsWith('.csv')) return 0
        if (att.filename.toLowerCase().endsWith('.xlsx') || att.filename.toLowerCase().endsWith('.xls')) return 1
        return 2
      }
      return order(a) - order(b)
    })

    console.log(`Processing ${sortedAttachments.length} attachments (prioritizing CSV)...`)

    // Only parse until we get items (to avoid rate limits)
    for (const attachment of sortedAttachments) {
      if (allParsedItems.length > 0) {
        console.log(`Already have ${allParsedItems.length} items, skipping ${attachment.filename}`)
        break
      }

      console.log(`Parsing attachment: ${attachment.filename} (${attachment.contentType}, ${attachment.content?.length || 0} bytes)`)
      try {
        const parsed = await parseAttachmentWithClaude(attachment, anthropicKey)
        console.log(`Parsed result: supplier="${parsed.supplierName}", items=${parsed.items.length}`)
        if (parsed.supplierName && !supplierName) {
          supplierName = parsed.supplierName
        }
        allParsedItems = allParsedItems.concat(parsed.items)
      } catch (err) {
        console.error(`Failed to parse ${attachment.filename}:`, err)
      }
    }
    console.log(`Total parsed items: ${allParsedItems.length}`)

    if (allParsedItems.length === 0) {
      // Log failed import
      await supabase.from('email_order_imports').insert({
        tenant_id: tenantId,
        message_id: messageId,
        sender,
        subject,
        received_at: receivedDate,
        status: 'failed',
        error_message: 'No order items could be extracted from attachments',
        raw_data: { attachments: attachments.map(a => a.filename) }
      })

      return new Response(
        JSON.stringify({
          error: 'No order items found in attachments',
          attachments: attachments.map(a => a.filename)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find supplier by name from parsed data
    const supplier = await findSupplierByName(supabase, tenantId, supplierName)

    if (!supplier) {
      await supabase.from('email_order_imports').insert({
        tenant_id: tenantId,
        message_id: messageId,
        sender,
        subject,
        received_at: receivedDate,
        status: 'failed',
        error_message: `Supplier not found: "${supplierName}"`,
        raw_data: { supplierName, parsedItems: allParsedItems }
      })

      return new Response(
        JSON.stringify({
          error: `Supplier not found in database: "${supplierName}"`,
          extractedSupplierName: supplierName
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Match parsed items to existing inventory items
    interface InventoryItem {
      id: string;
      name: string;
      sku: string | null;
      wholesale_price: number | null;
    }

    const { data: inventoryItems, error: itemsError } = await supabase
      .from('items')
      .select('id, name, sku, wholesale_price')
      .eq('tenant_id', tenantId)
      .eq('supplier_id', supplier.id)
      .eq('status', 'active')

    if (itemsError) {
      throw new Error(`Failed to fetch inventory: ${itemsError.message}`)
    }

    const items: InventoryItem[] = inventoryItems || []
    console.log(`Fetched ${items.length} inventory items for supplier ${supplier.name}`)

    const matchedItems: Array<{
      itemId: string;
      name: string;
      quantity: number;
      unit: string;
      unitPrice: number;
    }> = []
    const unmatchedItems: string[] = []

    // Helper function to normalize and extract significant words
    const getSignificantWords = (text: string): string[] => {
      const stopWords = ['and', 'the', 'a', 'an', 'of', 'for', 'with', 'in', 'on', 'to', 'by', 'per', 'each']
      return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')  // Remove special chars
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.includes(w))
    }

    // Calculate word match score (percentage of words that match)
    const calculateMatchScore = (words1: string[], words2: string[]): number => {
      if (words1.length === 0 || words2.length === 0) return 0
      let matches = 0
      for (const w1 of words1) {
        // Check if any word in words2 contains w1 or vice versa
        if (words2.some(w2 => w1.includes(w2) || w2.includes(w1))) {
          matches++
        }
      }
      // Return percentage of words1 that matched
      return matches / words1.length
    }

    console.log(`Total inventory items to match against: ${items.length || 0}`)

    for (const parsed of allParsedItems) {
      // Try to match by SKU/code first, then by name
      const parsedCode = (parsed.code || parsed.sku || '').toLowerCase().trim()
      const parsedName = parsed.name.toLowerCase().trim()
      const parsedWords = getSignificantWords(parsed.name)

      console.log(`\nMatching: "${parsed.name}" (code: ${parsedCode})`)
      console.log(`  Parsed words: [${parsedWords.join(', ')}]`)

      let matchedItem = items.find(inv => {
        const invSku = (inv.sku || '').toLowerCase().trim()
        const invName = inv.name.toLowerCase().trim()

        // Exact SKU match
        if (parsedCode && invSku && parsedCode === invSku) return true
        // Exact name match
        if (parsedName === invName) return true
        // Partial name match (parsed name contained in inventory name or vice versa)
        if (parsedName && invName && (invName.includes(parsedName) || parsedName.includes(invName))) return true

        return false
      })

      if (matchedItem) {
        console.log(`  EXACT MATCH: "${matchedItem.name}" (${matchedItem.sku})`)
      }

      // If no exact match, try fuzzy word matching
      if (!matchedItem && parsedWords.length > 0) {
        let bestScore = 0
        let bestMatch: InventoryItem | null = null

        for (const inv of items || []) {
          const invWords = getSignificantWords(inv.name)
          const score = calculateMatchScore(parsedWords, invWords)
          // Require at least 60% of words to match
          if (score >= 0.6 && score > bestScore) {
            bestScore = score
            bestMatch = inv
            console.log(`  Candidate: "${inv.name}" score=${score.toFixed(2)} words=[${invWords.join(', ')}]`)
          }
        }

        if (bestMatch) {
          console.log(`Fuzzy matched "${parsed.name}" -> "${bestMatch.name}" (score: ${bestScore.toFixed(2)})`)
          matchedItem = bestMatch
        }
      }

      if (matchedItem) {
        matchedItems.push({
          itemId: matchedItem.id,
          name: matchedItem.name,
          quantity: parsed.quantity,
          unit: parsed.unit || 'each',
          unitPrice: parsed.unit_price || matchedItem.wholesale_price || 0
        })
      } else {
        unmatchedItems.push(`${parsed.name} (${parsed.code || parsed.sku || 'no code'})`)
      }
    }

    // If no items matched at all, fail the import
    if (matchedItems.length === 0) {
      await supabase.from('email_order_imports').insert({
        tenant_id: tenantId,
        message_id: messageId,
        sender,
        subject,
        received_at: receivedDate,
        status: 'failed',
        error_message: `No items could be matched. Unmatched: ${unmatchedItems.join(', ')}`,
        raw_data: { supplierName, parsedItems: allParsedItems, unmatchedItems }
      })

      return new Response(
        JSON.stringify({
          error: 'No items could be matched to inventory',
          supplier: supplier.name,
          unmatchedItems,
          matchedCount: 0
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate totals
    const subtotal = matchedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const hasUnmatchedItems = unmatchedItems.length > 0

    // Build notes with unmatched items info
    let orderNotes = `Imported from email: ${subject} (${sender})`
    if (hasUnmatchedItems) {
      orderNotes += `\n\n⚠️ UNMATCHED ITEMS (${unmatchedItems.length}):\n${unmatchedItems.map(item => `• ${item}`).join('\n')}`
    }

    // Create order - use 'pending_approval' status, but include unmatched info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId,
        supplier_id: supplier.id,
        order_date: new Date().toISOString().split('T')[0],
        subtotal,
        total: subtotal,
        status: 'pending_approval',
        notes: orderNotes
      })
      .select()
      .single()

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`)
    }

    // Create order items
    const orderItems = matchedItems.map(item => ({
      order_id: order.id,
      tenant_id: tenantId,
      procurement_item_id: item.itemId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unitPrice,
      total: item.quantity * item.unitPrice
    }))

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (orderItemsError) {
      // Rollback order
      await supabase.from('orders').delete().eq('id', order.id)
      throw new Error(`Failed to create order items: ${orderItemsError.message}`)
    }

    // Log import (partial if there were unmatched items)
    await supabase.from('email_order_imports').insert({
      tenant_id: tenantId,
      message_id: messageId,
      sender,
      subject,
      received_at: receivedDate,
      order_id: order.id,
      status: hasUnmatchedItems ? 'partial' : 'success',
      error_message: hasUnmatchedItems ? `Unmatched items: ${unmatchedItems.join(', ')}` : null,
      raw_data: { supplierName, parsedItems: allParsedItems, matchedItems, unmatchedItems }
    })

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
        supplier: supplier.name,
        itemCount: matchedItems.length,
        total: subtotal,
        hasUnmatchedItems,
        unmatchedItems: hasUnmatchedItems ? unmatchedItems : undefined,
        unmatchedCount: unmatchedItems.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing order email:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
