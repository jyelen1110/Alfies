# Xero Integration Setup

This guide explains how to set up Xero integration for automatic invoice syncing.

## Overview

When Xero is connected:
- Invoices are automatically created in Xero when orders are approved
- Invoices are automatically created in Xero when manual orders are created by owners
- Owners can manually export invoices that weren't auto-synced

## Prerequisites

1. A Xero account with an organization
2. Access to Xero Developer Portal
3. Supabase project with Edge Functions enabled

## Step 1: Create a Xero App

1. Go to [Xero Developer Portal](https://developer.xero.com/app/manage)
2. Click "New App"
3. Fill in the details:
   - **App name**: Alfie's Ordering (or your preferred name)
   - **Integration type**: Web app
   - **Company or application URL**: Your app URL
   - **Redirect URI**: `https://<your-supabase-project>.supabase.co/functions/v1/xero-callback`
4. Click "Create app"
5. Note down the **Client ID** and generate a **Client Secret**

## Step 2: Configure Supabase Secrets

Set the following secrets in your Supabase project:

```bash
# Using Supabase CLI
supabase secrets set XERO_CLIENT_ID=your_client_id
supabase secrets set XERO_CLIENT_SECRET=your_client_secret
supabase secrets set XERO_REDIRECT_URI=https://<your-project>.supabase.co/functions/v1/xero-callback
```

Or via the Supabase Dashboard:
1. Go to Project Settings > Edge Functions
2. Add the secrets under "Secrets"

## Step 3: Deploy Edge Functions

Deploy the Xero Edge Functions to Supabase:

```bash
# From the project root
supabase functions deploy xero-auth
supabase functions deploy xero-callback
supabase functions deploy xero-create-invoice
```

## Step 4: Connect Xero in the App

1. Open the app and log in as an owner
2. Go to Settings
3. Under "Integrations", tap "Connect your Xero account"
4. Log in to Xero and authorize the app
5. Select the organization to connect
6. You'll be redirected back to the app

## How It Works

### Automatic Invoice Sync

When an order is approved (either by approving a customer's order or creating a manual order), the system:

1. Creates an invoice record in the local database
2. Checks if Xero is connected
3. If connected, creates the invoice in Xero via the API
4. Updates the local invoice with the Xero Invoice ID

### Invoice Details

Invoices created in Xero include:
- **Contact**: Customer's business name or full name
- **Invoice Number**: Same as local invoice number
- **Reference**: Order number
- **Line Items**: All order items with quantities and prices
- **Due Date**: 30 days from invoice date (configurable)

### Token Management

- OAuth tokens are stored securely in the `integration_tokens` table
- Tokens are automatically refreshed when expired
- If refresh fails, the user will need to reconnect Xero

## Troubleshooting

### "Xero not connected" error
- Go to Settings and reconnect Xero
- Ensure the OAuth tokens haven't expired

### Invoice not appearing in Xero
- Check the Supabase Edge Function logs for errors
- Verify the Xero API scopes include `accounting.transactions`
- Ensure the contact exists or can be created in Xero

### Authentication errors
- Verify XERO_CLIENT_ID and XERO_CLIENT_SECRET are correct
- Check the redirect URI matches exactly in both Xero app settings and Supabase secrets

## API Scopes Used

The integration requests the following Xero API scopes:
- `openid` - OpenID Connect authentication
- `profile` - User profile information
- `email` - User email
- `accounting.transactions` - Create/read invoices
- `accounting.contacts` - Create/read contacts
- `accounting.settings.read` - Read organization settings
- `offline_access` - Refresh tokens

## Security Considerations

- Client secrets are never exposed to the mobile app
- All API calls go through Supabase Edge Functions
- OAuth state parameter prevents CSRF attacks
- Tokens are stored encrypted in Supabase
