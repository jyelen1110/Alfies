import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple structure for parsed items
interface ParsedItem {
  name: string;
  barcode?: string;
  sku?: string;
  category?: string;
  wholesale_price?: number;
  rrp?: number;
  carton_size?: number;
  size?: string;
  country_of_origin?: string;
}

const systemPrompt = `You are a product data extractor. Extract product information from the provided document.
Return a JSON array of products with these fields (use null for missing fields):
- name (required): product name
- barcode: product barcode/EAN/UPC
- sku: product SKU/code
- category: product category
- wholesale_price: wholesale/trade price as number
- rrp: retail price as number
- carton_size: units per carton as number
- size: product size/weight (e.g., "250g", "500ml")
- country_of_origin: country of origin

Return ONLY valid JSON array, no other text. Example:
[{"name": "Product A", "barcode": "123456789", "wholesale_price": 5.99}]`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { fileContent, fileType, pageNumber } = await req.json()

    // Get Anthropic API key from environment
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured. Please set ANTHROPIC_API_KEY.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For PDF/images, use vision model
    // For text/CSV content, use text model
    const isImageContent = fileType === 'image' || fileType === 'pdf-image'

    let response
    if (isImageContent) {
      // Use Claude Vision for image/PDF page
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
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: fileContent,
                  }
                },
                {
                  type: 'text',
                  text: `Extract all product information from this document (page ${pageNumber || 1}). Return as JSON array.`
                }
              ]
            }
          ],
        }),
      })
    } else {
      // Use Claude for text/spreadsheet content
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
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: `Parse this document content and extract product information:\n\n${fileContent}`
            }
          ],
        }),
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', errorText)
      return new Response(
        JSON.stringify({ error: 'AI processing failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const aiResponse = await response.json()
    const content = aiResponse.content?.[0]?.text

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'No response from AI', items: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try to parse the JSON from the response
    let items: ParsedItem[] = []
    try {
      // Remove any markdown code blocks if present
      let jsonStr = content.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      items = JSON.parse(jsonStr)

      // Filter out items without names
      items = items.filter(item => item.name && item.name.trim())
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      return new Response(
        JSON.stringify({
          error: 'Failed to parse AI response',
          rawResponse: content,
          items: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        items,
        pageNumber: pageNumber || 1
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
