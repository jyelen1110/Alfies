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
  customerName: string;
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
1. "customerName": The customer/buyer name (look for business name, company name, "Customer:", "Bill To:", "Ship To:", or header)
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
  "customerName": "ABC Cafe Pty Ltd",
  "items": [
    {"name": "Product A", "code": "ABC123", "quantity": 10, "unit": "each", "unit_price": 5.99}
  ]
}

If this is not an order document or you cannot extract order items, return:
{"customerName": "", "items": []}`

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
                text: `Extract the customer name and all order line items from this document (${attachment.filename}). Return as JSON.`
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
            content: `Extract the customer name and order line items from this document content (${attachment.filename}):\n\n${textContent}`
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
    return { customerName: '', items: [] }
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
      customerName: parsed.customerName || '',
      items: (parsed.items || []).filter((item: ParsedOrderItem) => item.name && item.quantity)
    }
  } catch (parseError) {
    console.error(`JSON parse error for ${attachment.filename}:`, parseError, 'Content:', jsonStr.substring(0, 200))
    return { customerName: '', items: [] }
  }
}

async function findCustomerByName(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  customerName: string
): Promise<{ id: string; business_name: string } | null> {
  if (!customerName) return null

  const searchName = customerName.toLowerCase().trim()
  console.log(`Looking for customer: "${searchName}"`)

  // Fetch all customers (users with role 'user') for the tenant
  const { data: customers, error } = await supabase
    .from('users')
    .select('id, business_name, full_name')
    .eq('tenant_id', tenantId)
    .eq('role', 'user')

  if (error || !customers) {
    console.error('Failed to fetch customers:', error)
    return null
  }

  console.log(`Found ${customers.length} customers to search`)

  // Try exact match on business_name first
  let match = customers.find(c => c.business_name?.toLowerCase().trim() === searchName)

  // Try partial match (customer name contains search or vice versa)
  if (!match) {
    match = customers.find(c => {
      const cName = (c.business_name || c.full_name || '').toLowerCase().trim()
      return cName.includes(searchName) || searchName.includes(cName)
    })
  }

  // Try word-based matching (any significant word matches)
  if (!match) {
    const searchWords = searchName.split(/\s+/).filter(w => w.length > 3)
    match = customers.find(c => {
      const cName = (c.business_name || c.full_name || '').toLowerCase()
      return searchWords.some(word => cName.includes(word))
    })
  }

  if (match) {
    console.log(`Found customer: ${match.business_name} (${match.id})`)
  } else {
    console.log(`No customer found for: "${customerName}"`)
  }

  return match ? { id: match.id, business_name: match.business_name || match.full_name } : null
}

async function getDefaultSupplier(
  supabase: ReturnType<typeof createClient>,
  tenantId: string
): Promise<{ id: string; name: string } | null> {
  // Get the first active supplier for the tenant (your own supplier record)
  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .limit(1)

  if (error || !suppliers || suppliers.length === 0) {
    console.error('Failed to fetch default supplier:', error)
    return null
  }

  console.log(`Using default supplier: ${suppliers[0].name}`)
  return suppliers[0]
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

    // Use INSERT to atomically claim this message_id (UNIQUE constraint prevents duplicates)
    // This prevents race conditions when cron and manual check run simultaneously
    const { data: importRecord, error: insertError } = await supabase
      .from('email_order_imports')
      .insert({
        tenant_id: tenantId,
        message_id: messageId,
        sender,
        subject,
        received_at: receivedDate,
        status: 'processing',  // Mark as processing, will update when done
      })
      .select('id')
      .single()

    if (insertError) {
      // If insert fails due to unique constraint, email is already being processed
      if (insertError.code === '23505') {  // PostgreSQL unique violation
        console.log(`Email ${messageId} already being processed (duplicate)`)
        return new Response(
          JSON.stringify({ error: 'Email already processed or in progress' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.error('Error creating import record:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create import record', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const importId = importRecord.id
    console.log(`Created import record ${importId} for message ${messageId}`)

    // Parse attachments - prioritize CSV (smallest), then XLSX, then PDF
    let customerName = ''
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
        console.log(`Parsed result: customer="${parsed.customerName}", items=${parsed.items.length}`)
        if (parsed.customerName && !customerName) {
          customerName = parsed.customerName
        }
        allParsedItems = allParsedItems.concat(parsed.items)
      } catch (err) {
        console.error(`Failed to parse ${attachment.filename}:`, err)
      }
    }
    console.log(`Total parsed items: ${allParsedItems.length}`)

    if (allParsedItems.length === 0) {
      // Update import record as failed
      await supabase.from('email_order_imports')
        .update({
          status: 'failed',
          error_message: 'No order items could be extracted from attachments',
          raw_data: { attachments: attachments.map(a => a.filename) }
        })
        .eq('id', importId)

      return new Response(
        JSON.stringify({
          error: 'No order items found in attachments',
          attachments: attachments.map(a => a.filename)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get default supplier (your own supplier record)
    const supplier = await getDefaultSupplier(supabase, tenantId)

    if (!supplier) {
      await supabase.from('email_order_imports')
        .update({
          status: 'failed',
          error_message: 'No supplier configured for this tenant',
          raw_data: { customerName, parsedItems: allParsedItems }
        })
        .eq('id', importId)

      return new Response(
        JSON.stringify({ error: 'No supplier configured. Please add a supplier first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Find customer by name from parsed data (optional - order can be created without customer)
    const customer = await findCustomerByName(supabase, tenantId, customerName)
    if (!customer) {
      console.log(`Customer "${customerName}" not found - order will be created without customer_id`)
    }

    // Match parsed items to existing inventory items
    interface InventoryItem {
      id: string;
      name: string;
      sku: string | null;
      wholesale_price: number | null;
      tax_rate: number | null;
      xero_item_code: string | null;
      xero_account_code: string | null;
    }

    const { data: inventoryItems, error: itemsError } = await supabase
      .from('items')
      .select('id, name, sku, wholesale_price, tax_rate, xero_item_code, xero_account_code')
      .eq('tenant_id', tenantId)
      .eq('supplier_id', supplier.id)
      .eq('status', 'active')

    if (itemsError) {
      throw new Error(`Failed to fetch inventory: ${itemsError.message}`)
    }

    const items: InventoryItem[] = inventoryItems || []
    console.log(`Fetched ${items.length} inventory items for supplier ${supplier.name}`)

    // Load item name aliases for fuzzy matching
    interface ItemAlias {
      alias_name: string;
      item_id: string;
    }
    const { data: aliasData } = await supabase
      .from('item_name_aliases')
      .select('alias_name, item_id')
      .eq('tenant_id', tenantId)

    const aliases: ItemAlias[] = aliasData || []
    console.log(`Loaded ${aliases.length} item name aliases`)

    // Create a map of alias_name -> item for fast lookup
    const aliasMap = new Map<string, InventoryItem>()
    for (const alias of aliases) {
      const item = items.find(i => i.id === alias.item_id)
      if (item) {
        aliasMap.set(alias.alias_name.toLowerCase(), item)
      }
    }

    const matchedItems: Array<{
      itemId: string;
      name: string;
      quantity: number;
      unit: string;
      unitPrice: number;
      taxRate: number;
      xeroItemCode: string | null;
      xeroAccountCode: string | null;
    }> = []
    const unmatchedItems: string[] = []

    // Helper function to normalize name for comparison
    const normalizeName = (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[''`]/g, "'")  // Normalize apostrophes
        .replace(/[^a-z0-9\s']/g, ' ')  // Remove special chars except apostrophe
        .replace(/\s+/g, ' ')  // Collapse whitespace
        .trim()
    }

    console.log(`Total inventory items to match against: ${items.length || 0}`)

    for (const parsed of allParsedItems) {
      // Try to match by SKU/code first, then by EXACT name match only
      const parsedCode = (parsed.code || parsed.sku || '').toLowerCase().trim()
      const parsedName = normalizeName(parsed.name)

      console.log(`\nMatching: "${parsed.name}" -> normalized: "${parsedName}" (code: ${parsedCode})`)

      let matchedItem = items.find(inv => {
        const invSku = (inv.sku || '').toLowerCase().trim()
        const invName = normalizeName(inv.name)

        // Exact SKU match (highest priority)
        if (parsedCode && invSku && parsedCode === invSku) {
          console.log(`  SKU MATCH: "${inv.name}" (${invSku})`)
          return true
        }
        // Exact normalized name match only - NO fuzzy matching
        if (parsedName === invName) {
          console.log(`  EXACT NAME MATCH: "${inv.name}"`)
          return true
        }

        return false
      })

      // If no direct match, check aliases
      if (!matchedItem) {
        const aliasMatch = aliasMap.get(parsedName)
        if (aliasMatch) {
          console.log(`  ALIAS MATCH: "${parsed.name}" -> "${aliasMatch.name}"`)
          matchedItem = aliasMatch
        }
      }

      if (matchedItem) {
        if (!matchedItem.xero_item_code) {
          console.log(`  WARNING: Item "${matchedItem.name}" has no Xero Item Code - will fail on export`)
        }
        matchedItems.push({
          itemId: matchedItem.id,
          name: matchedItem.name,
          quantity: parsed.quantity,
          unit: parsed.unit || 'each',
          unitPrice: parsed.unit_price || matchedItem.wholesale_price || 0,
          taxRate: matchedItem.tax_rate || 0,
          xeroItemCode: matchedItem.xero_item_code,
          xeroAccountCode: matchedItem.xero_account_code
        })
      } else {
        console.log(`  NO MATCH FOUND for "${parsed.name}"`)
        unmatchedItems.push(`${parsed.name} x${parsed.quantity} (${parsed.code || parsed.sku || 'no code'})`)
      }
    }

    // If no items matched at all, fail the import
    if (matchedItems.length === 0) {
      await supabase.from('email_order_imports')
        .update({
          status: 'failed',
          error_message: `No items could be matched. Unmatched: ${unmatchedItems.join(', ')}`,
          raw_data: { customerName, parsedItems: allParsedItems, unmatchedItems }
        })
        .eq('id', importId)

      return new Response(
        JSON.stringify({
          error: 'No items could be matched to inventory',
          customer: customer?.business_name || customerName,
          unmatchedItems,
          matchedCount: 0
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate totals with GST
    const subtotal = matchedItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const tax = matchedItems.reduce((sum, item) => {
      const lineTotal = item.quantity * item.unitPrice
      const lineTax = lineTotal * (item.taxRate / 100)
      return sum + lineTax
    }, 0)
    const total = subtotal + tax
    const hasUnmatchedItems = unmatchedItems.length > 0

    console.log(`Order totals: subtotal=${subtotal.toFixed(2)}, tax=${tax.toFixed(2)}, total=${total.toFixed(2)}`)

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
        customer_id: customer?.id || null,
        order_date: new Date().toISOString().split('T')[0],
        subtotal,
        tax,
        total,
        status: 'pending_approval',
        notes: orderNotes
      })
      .select()
      .single()

    if (orderError) {
      throw new Error(`Failed to create order: ${orderError.message}`)
    }

    // Create order items with Xero codes
    const orderItems = matchedItems.map(item => ({
      order_id: order.id,
      tenant_id: tenantId,
      procurement_item_id: item.itemId,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.quantity * item.unitPrice,
      xero_item_code: item.xeroItemCode,
      xero_account_code: item.xeroAccountCode
    }))

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (orderItemsError) {
      // Rollback order
      await supabase.from('orders').delete().eq('id', order.id)
      throw new Error(`Failed to create order items: ${orderItemsError.message}`)
    }

    // Update import record with success (partial if there were unmatched items)
    await supabase.from('email_order_imports')
      .update({
        order_id: order.id,
        status: hasUnmatchedItems ? 'partial' : 'success',
        error_message: hasUnmatchedItems ? `Unmatched items: ${unmatchedItems.join(', ')}` : null,
        raw_data: { customerName, customer: customer?.business_name, parsedItems: allParsedItems, matchedItems, unmatchedItems }
      })
      .eq('id', importId)

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        orderNumber: order.order_number,
        customer: customer?.business_name || null,
        customerId: customer?.id || null,
        itemCount: matchedItems.length,
        subtotal,
        tax,
        total,
        hasUnmatchedItems,
        unmatchedItems: hasUnmatchedItems ? unmatchedItems : undefined,
        unmatchedCount: unmatchedItems.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing order email:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error stack:', errorStack)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage, stack: errorStack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
