/**
 * Email Order Processor
 *
 * Fetches order emails from Apple Mail, extracts attachments,
 * and creates orders via Supabase edge function.
 * Supplier is auto-detected from attachment content.
 *
 * Usage:
 *   npx tsx scripts/process-order-emails.ts
 *
 * Environment variables:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for creating orders
 *   TENANT_ID - Target tenant ID (optional, defaults to first tenant)
 */

import { runAppleScript } from 'run-applescript';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load config
const configPath = path.join(__dirname, 'email-order-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

interface EmailAttachment {
  filename: string;
  contentType: string;
  content: string; // base64
}

interface EmailMessage {
  messageId: string;
  sender: string;
  subject: string;
  receivedDate: string;
  mailbox: string;
  isRead: boolean;
  attachments: EmailAttachment[];
}

interface ProcessResult {
  messageId: string;
  success: boolean;
  orderId?: string;
  supplier?: string;
  error?: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || config.supabaseUrl;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch emails from Apple Mail using AppleScript
 */
async function fetchEmails(): Promise<EmailMessage[]> {
  console.log(`Searching for emails from: ${config.senderFilter}`);

  const scriptPath = path.join(__dirname, 'applescript', 'get-order-emails.applescript');
  const script = fs.readFileSync(scriptPath, 'utf-8');

  try {
    const result = await runAppleScript(script, [config.senderFilter || '', '50']);
    const emails = JSON.parse(result) as EmailMessage[] | { error: string };

    if ('error' in emails) {
      throw new Error(emails.error);
    }

    console.log(`Found ${emails.length} emails with attachments`);
    return emails;
  } catch (error) {
    console.error('Failed to fetch emails:', error);
    return [];
  }
}

/**
 * Check if email was already processed
 */
async function isAlreadyProcessed(messageId: string): Promise<boolean> {
  const { data } = await supabase
    .from('email_order_imports')
    .select('id')
    .eq('message_id', messageId)
    .single();

  return !!data;
}

/**
 * Process a single email
 */
async function processEmail(
  email: EmailMessage,
  tenantId: string
): Promise<ProcessResult> {
  console.log(`\nProcessing: ${email.subject}`);
  console.log(`  From: ${email.sender}`);
  console.log(`  Date: ${email.receivedDate}`);
  console.log(`  Mailbox: ${email.mailbox}`);
  console.log(`  Attachments: ${email.attachments.map(a => a.filename).join(', ')}`);

  // Check if already processed
  if (await isAlreadyProcessed(email.messageId)) {
    return {
      messageId: email.messageId,
      success: false,
      error: 'Already processed',
    };
  }

  // Call edge function to process the email
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/process-order-email`;

  try {
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        sender: email.sender,
        subject: email.subject,
        receivedDate: email.receivedDate,
        messageId: email.messageId,
        attachments: email.attachments,
        tenantId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        messageId: email.messageId,
        success: false,
        error: result.error || `HTTP ${response.status}`,
      };
    }

    return {
      messageId: email.messageId,
      success: true,
      orderId: result.orderId,
      supplier: result.supplier,
    };
  } catch (error) {
    return {
      messageId: email.messageId,
      success: false,
      error: String(error),
    };
  }
}

/**
 * Mark email as processed by moving to processed folder
 */
async function markEmailProcessed(messageId: string, sourceMailbox: string): Promise<void> {
  const scriptPath = path.join(__dirname, 'applescript', 'mark-email-processed.applescript');
  const script = fs.readFileSync(scriptPath, 'utf-8');

  try {
    await runAppleScript(script, [messageId, config.processedFolder, sourceMailbox]);
    console.log(`  Moved to ${config.processedFolder}`);
  } catch (error) {
    console.error(`  Failed to move email:`, error);
  }
}

/**
 * Get default tenant ID (for single-tenant setup)
 */
async function getDefaultTenantId(): Promise<string | null> {
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id')
    .limit(1);

  if (error || !tenants || tenants.length === 0) {
    console.error('Failed to get default tenant:', error);
    return null;
  }

  return tenants[0].id;
}

/**
 * Main processing function
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Email Order Processor');
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Get tenant ID
  const tenantId = process.env.TENANT_ID || await getDefaultTenantId();

  if (!tenantId) {
    console.error('No tenant ID available. Set TENANT_ID env var or ensure tenants table has data.');
    process.exit(1);
  }

  console.log(`Using tenant: ${tenantId}`);

  // Fetch emails
  const emails = await fetchEmails();

  if (emails.length === 0) {
    console.log('\nNo emails to process.');
    return;
  }

  // Process each email
  const results: ProcessResult[] = [];

  for (const email of emails) {
    const result = await processEmail(email, tenantId);
    results.push(result);

    if (result.success) {
      console.log(`  SUCCESS: Order created for ${result.supplier} (${result.orderId})`);
      await markEmailProcessed(email.messageId, email.mailbox);
    } else if (result.error === 'Already processed') {
      console.log(`  SKIPPED: Already processed`);
    } else {
      console.log(`  FAILED: ${result.error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const skipped = results.filter(r => r.error === 'Already processed').length;
  const failed = results.filter(r => !r.success && r.error !== 'Already processed').length;

  console.log(`Total emails: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Skipped (already processed): ${skipped}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed emails:');
    results
      .filter(r => !r.success && r.error !== 'Already processed')
      .forEach(r => console.log(`  - ${r.error}`));
  }

  console.log(`\nCompleted at: ${new Date().toISOString()}`);
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
