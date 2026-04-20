import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Terms of Service - Alfies</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f9fafb;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #1565A0; margin-bottom: 10px; font-size: 28px; }
        .last-updated { color: #666; font-size: 14px; margin-bottom: 30px; }
        h2 { color: #1565A0; margin-top: 30px; margin-bottom: 15px; font-size: 20px; }
        p { margin-bottom: 15px; }
        ul { margin-left: 25px; margin-bottom: 15px; }
        li { margin-bottom: 8px; }
        a { color: #1565A0; }
        .contact { background: #f0f7ff; padding: 20px; border-radius: 8px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Terms of Service</h1>
        <p class="last-updated">Last updated: April 2026</p>

        <p>These Terms of Service ("Terms") govern your access to and use of Alfies ("the Service"), a wholesale ordering application operated by Jason Yelen ("we", "our", or "us"). By creating an account or using the Service you agree to be bound by these Terms. If you do not agree you must not use the Service.</p>

        <h2>1. Eligibility</h2>
        <p>You must be at least 18 years old and authorised to enter contracts on behalf of any business you represent. The Service is intended for wholesale and business ordering, not for consumers under 18.</p>

        <h2>2. Accounts</h2>
        <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us immediately at the email below if you suspect unauthorised access. We may suspend or terminate accounts for misuse, fraud, or breach of these Terms.</p>

        <h2>3. Orders and Invoicing</h2>
        <ul>
            <li>Orders placed through the Service are binding purchase requests to the supplier you select.</li>
            <li>Pricing, delivery times, and availability are provided by suppliers and may change without notice.</li>
            <li>Invoices may be generated and exported to third-party accounting systems such as Xero at your request.</li>
            <li>You are responsible for reviewing orders and invoices before approving or paying them.</li>
        </ul>

        <h2>4. Third-Party Integrations</h2>
        <p>The Service integrates with third-party platforms such as Google (Gmail), Xero, and Supabase. When you connect these integrations you authorise us to access and process data from those services on your behalf, subject to the scopes you approve. We do not control those third-party services and are not liable for their availability, accuracy, or policies.</p>

        <h2>5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
            <li>Use the Service for unlawful, fraudulent, or harmful purposes</li>
            <li>Attempt to gain unauthorised access to other accounts, data, or systems</li>
            <li>Reverse engineer, copy, or resell the Service</li>
            <li>Submit false, misleading, or infringing content</li>
            <li>Interfere with, disrupt, or overload the Service</li>
        </ul>

        <h2>6. Intellectual Property</h2>
        <p>The Service, including its software, design, and content, is owned by Jason Yelen and protected by intellectual property laws. You receive a limited, non-exclusive, non-transferable licence to use the Service for its intended purpose. You retain ownership of any business data you submit, but grant us a licence to process it to operate the Service.</p>

        <h2>7. Fees</h2>
        <p>If any fees apply to your use of the Service they will be disclosed before you incur them. Unless otherwise stated, all fees are non-refundable except where required by law.</p>

        <h2>8. Termination</h2>
        <p>You may stop using the Service at any time. You can delete your account from the Settings page within the app. We may suspend or terminate your access at any time if you breach these Terms or if operation of the Service becomes impractical. Sections that by their nature should survive termination (including ownership, disclaimers, and limitation of liability) will survive.</p>

        <h2>9. Disclaimers</h2>
        <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS, OR THAT DATA WILL BE ACCURATE OR PRESERVED. TO THE EXTENT PERMITTED BY LAW WE DISCLAIM ALL IMPLIED WARRANTIES INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>

        <h2>10. Limitation of Liability</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF THESE TERMS OR THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM OR (B) A$100.</p>

        <h2>11. Indemnity</h2>
        <p>You agree to indemnify and hold us harmless from any claim, loss, or liability arising from your use of the Service, your content, or your breach of these Terms.</p>

        <h2>12. Changes to These Terms</h2>
        <p>We may update these Terms from time to time. Material changes will be notified within the app or by email. Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</p>

        <h2>13. Governing Law</h2>
        <p>These Terms are governed by the laws of Australia. Any dispute will be subject to the non-exclusive jurisdiction of the courts of Australia.</p>

        <div class="contact">
            <h2>Contact</h2>
            <p>Questions about these Terms? Contact the operator:</p>
            <p><strong>Jason Yelen</strong></p>
            <p><strong>Email:</strong> <a href="mailto:yelenjason@gmail.com">yelenjason@gmail.com</a></p>
        </div>
    </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
