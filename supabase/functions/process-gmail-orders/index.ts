import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')

interface GmailConnection {
  id: string
  tenant_id: string
  email: string
  access_token: string
  refresh_token: string
  token_expiry: string
  filter_sender?: string
  filter_to?: string
  filter_subject?: string
  filter_label?: string
}

async function refreshAccessToken(connection: GmailConnection): Promise<string | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      console.error('Failed to refresh token:', await response.text())
      return null
    }

    const tokens = await response.json()
    return tokens.access_token
  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  connection: GmailConnection
): Promise<string | null> {
  const expiry = new Date(connection.token_expiry)
  const now = new Date()

  // If token expires in less than 5 minutes, refresh it
  if (expiry.getTime() - now.getTime() < 5 * 60 * 1000) {
    const newToken = await refreshAccessToken(connection)
    if (newToken) {
      // Update in database
      await supabase
        .from('gmail_connections')
        .update({
          access_token: newToken,
          token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id)
      return newToken
    }
    return null
  }

  return connection.access_token
}

async function fetchEmails(accessToken: string, connection: GmailConnection): Promise<any[]> {
  // Build query based on filters
  // Note: Gmail API returns both read and unread emails by default
  const queryParts: string[] = [
    'has:attachment',
    '-label:Processed-Orders'  // Exclude already processed emails
  ]

  if (connection.filter_sender) {
    queryParts.push(`from:${connection.filter_sender}`)
  }

  if (connection.filter_to) {
    queryParts.push(`to:${connection.filter_to}`)
  }

  if (connection.filter_subject) {
    queryParts.push(`subject:${connection.filter_subject}`)
  }

  if (connection.filter_label && connection.filter_label !== 'INBOX') {
    queryParts.push(`label:${connection.filter_label}`)
  }

  const query = encodeURIComponent(queryParts.join(' '))

  const listResponse = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!listResponse.ok) {
    console.error('Failed to list messages:', await listResponse.text())
    return []
  }

  const listData = await listResponse.json()
  const messages = listData.messages || []

  const fullMessages = []
  for (const msg of messages) {
    const msgResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (msgResponse.ok) {
      fullMessages.push(await msgResponse.json())
    }
  }

  return fullMessages
}

function getHeader(headers: any[], name: string): string {
  const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())
  return header?.value || ''
}

async function getAttachment(accessToken: string, messageId: string, attachmentId: string): Promise<string | null> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) return null
  const data = await response.json()
  return data.data // base64 encoded
}

function extractAttachments(message: any): { partId: string; filename: string; mimeType: string; attachmentId: string }[] {
  const attachments: any[] = []

  function traverse(parts: any[]) {
    for (const part of parts || []) {
      if (part.filename && part.body?.attachmentId) {
        const filename = part.filename.toLowerCase()
        const mimeType = part.mimeType || ''
        if (filename.endsWith('.csv') || filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.pdf') ||
            mimeType.includes('csv') || mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('pdf')) {
          attachments.push({
            partId: part.partId,
            filename: part.filename,
            mimeType: part.mimeType,
            attachmentId: part.body.attachmentId,
          })
        }
      }
      if (part.parts) traverse(part.parts)
    }
  }

  traverse(message.payload?.parts || [])
  // Check top-level too
  if (message.payload?.body?.attachmentId && message.payload?.filename) {
    attachments.push({
      partId: '0',
      filename: message.payload.filename,
      mimeType: message.payload.mimeType,
      attachmentId: message.payload.body.attachmentId,
    })
  }

  return attachments
}

async function addLabelToMessage(accessToken: string, messageId: string, labelName: string): Promise<void> {
  // Get or create label
  const labelsResponse = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/labels',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!labelsResponse.ok) return

  const labelsData = await labelsResponse.json()
  let label = labelsData.labels?.find((l: any) => l.name === labelName)

  if (!label) {
    // Create label
    const createResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: labelName }),
      }
    )
    if (createResponse.ok) {
      label = await createResponse.json()
    }
  }

  if (label) {
    // Add label to message
    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ addLabelIds: [label.id] }),
      }
    )
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all active Gmail connections
    const { data: connections, error: connError } = await supabase
      .from('gmail_connections')
      .select('id, tenant_id, email, access_token, refresh_token, token_expiry, filter_sender, filter_to, filter_subject, filter_label')
      .eq('is_active', true)

    if (connError) {
      throw new Error(`Failed to fetch connections: ${connError.message}`)
    }

    const results: any[] = []

    for (const connection of connections || []) {
      console.log(`Processing emails for ${connection.email}`)

      const accessToken = await getValidAccessToken(supabase, connection)
      if (!accessToken) {
        console.error(`Failed to get access token for ${connection.email}`)
        await supabase
          .from('gmail_connections')
          .update({ last_error: 'Failed to refresh access token', updated_at: new Date().toISOString() })
          .eq('id', connection.id)
        continue
      }

      const messages = await fetchEmails(accessToken, connection)
      console.log(`Found ${messages.length} messages for ${connection.email} (filters: from=${connection.filter_sender || 'any'}, to=${connection.filter_to || 'any'}, subject=${connection.filter_subject || 'any'}, label=${connection.filter_label || 'INBOX'})`)

      let emailIndex = 0
      for (const message of messages) {
        // Add delay between emails to avoid rate limits (except first one)
        if (emailIndex > 0) {
          console.log('Waiting 3 seconds before next email to avoid rate limits...')
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
        emailIndex++

        const messageId = message.id
        const headers = message.payload?.headers || []
        const subject = getHeader(headers, 'Subject')
        const from = getHeader(headers, 'From')
        const date = getHeader(headers, 'Date')

        // Check if already processed
        const { data: existing } = await supabase
          .from('email_order_imports')
          .select('id')
          .eq('message_id', messageId)
          .single()

        if (existing) {
          console.log(`Skipping already processed: ${messageId}`)
          continue
        }

        // Get attachments
        const attachmentMeta = extractAttachments(message)
        if (attachmentMeta.length === 0) continue

        const attachments = []
        for (const meta of attachmentMeta) {
          const content = await getAttachment(accessToken, messageId, meta.attachmentId)
          if (content) {
            // Gmail returns URL-safe base64, convert to standard
            const standardBase64 = content.replace(/-/g, '+').replace(/_/g, '/')
            console.log(`Attachment: ${meta.filename} (${meta.mimeType}) - ${standardBase64.length} chars base64`)
            attachments.push({
              filename: meta.filename,
              contentType: meta.mimeType,
              content: standardBase64,
            })
          } else {
            console.log(`Failed to get content for: ${meta.filename}`)
          }
        }

        if (attachments.length === 0) continue

        // Call the order processing function
        const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-order-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            sender: from,
            subject,
            receivedDate: new Date(date).toISOString(),
            messageId,
            attachments,
            tenantId: connection.tenant_id,
          }),
        })

        const processResult = await processResponse.json()
        console.log(`process-order-email response (${processResponse.status}):`, JSON.stringify(processResult))

        if (processResponse.ok && processResult.success) {
          const partialMsg = processResult.hasUnmatchedItems
            ? ` (${processResult.unmatchedCount} unmatched items)`
            : ''
          console.log(`SUCCESS: Order created for ${processResult.supplier}${partialMsg}`)
          // Add label to mark as processed
          await addLabelToMessage(accessToken, messageId, 'Processed-Orders')
          results.push({
            messageId,
            success: true,
            orderId: processResult.orderId,
            hasUnmatchedItems: processResult.hasUnmatchedItems,
            unmatchedItems: processResult.unmatchedItems
          })
        } else {
          const errorMsg = processResult.error || processResult.details || `HTTP ${processResponse.status}`
          console.log(`FAILED: ${errorMsg}`)
          if (processResult.stack) {
            console.log(`Stack: ${processResult.stack}`)
          }
          if (processResult.details) {
            console.log(`Details: ${processResult.details}`)
          }
          results.push({ messageId, success: false, error: errorMsg, details: processResult.details })
        }
      }

      // Update last sync time
      await supabase
        .from('gmail_connections')
        .update({ last_sync_at: new Date().toISOString(), last_error: null })
        .eq('id', connection.id)
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
