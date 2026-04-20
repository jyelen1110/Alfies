import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Alfies - Wholesale Ordering Made Simple</title>
    <meta name="description" content="Alfies is a wholesale ordering platform operated by Jason Yelen. Submit and track supplier orders, generate invoices, and sync with Xero and Gmail.">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #1a2332;
            background: linear-gradient(180deg, #f0f7ff 0%, #ffffff 40%);
            min-height: 100vh;
        }
        .container { max-width: 960px; margin: 0 auto; padding: 40px 20px; }
        header { text-align: center; padding: 60px 20px 40px; }
        .logo-mark {
            width: 72px;
            height: 72px;
            margin: 0 auto 20px;
            background: #1565A0;
            color: white;
            border-radius: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            font-weight: 700;
        }
        h1 { color: #1565A0; font-size: 42px; margin-bottom: 12px; letter-spacing: -0.02em; }
        .tagline { font-size: 20px; color: #4a5568; margin-bottom: 32px; }
        .cta {
            display: inline-block;
            background: #1565A0;
            color: white;
            padding: 14px 32px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: background 0.15s;
        }
        .cta:hover { background: #0d4e85; }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 24px;
            margin: 60px 0;
        }
        .feature {
            background: white;
            padding: 28px;
            border-radius: 14px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            border: 1px solid #e8eef5;
        }
        .feature h3 { color: #1565A0; font-size: 18px; margin-bottom: 10px; }
        .feature p { color: #4a5568; font-size: 15px; }
        .section {
            background: white;
            padding: 40px;
            border-radius: 14px;
            margin: 32px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            border: 1px solid #e8eef5;
        }
        h2 { color: #1565A0; font-size: 24px; margin-bottom: 16px; }
        p.section-text { color: #4a5568; margin-bottom: 14px; }
        ul { margin: 12px 0 12px 24px; color: #4a5568; }
        ul li { margin-bottom: 6px; }
        .owner-card {
            background: #f0f7ff;
            padding: 24px;
            border-radius: 12px;
            margin-top: 24px;
        }
        .owner-card strong { color: #1565A0; }
        .owner-card a { color: #1565A0; }
        footer {
            text-align: center;
            padding: 40px 20px;
            color: #718096;
            font-size: 14px;
            border-top: 1px solid #e8eef5;
            margin-top: 40px;
        }
        footer a { color: #1565A0; margin: 0 12px; text-decoration: none; }
        footer a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo-mark">A</div>
            <h1>Alfies</h1>
            <p class="tagline">Wholesale Ordering Made Simple</p>
            <a class="cta" href="/">Sign in to the app</a>
        </header>

        <div class="features">
            <div class="feature">
                <h3>Streamlined Ordering</h3>
                <p>Submit and track orders across multiple suppliers in one place. Browse catalogues, set delivery dates, and approve orders in seconds.</p>
            </div>
            <div class="feature">
                <h3>Automated Invoicing</h3>
                <p>Generate invoices the moment an order is approved and export them to Xero with a single tap. No manual data entry.</p>
            </div>
            <div class="feature">
                <h3>Gmail Integration</h3>
                <p>Optionally connect Gmail (read-only) so incoming order emails from customers are parsed and matched to your catalogue automatically.</p>
            </div>
        </div>

        <div class="section">
            <h2>About Alfies</h2>
            <p class="section-text">Alfies is a wholesale ordering application operated by Jason Yelen. It is designed for small food wholesalers and their customers to replace messy email and spreadsheet workflows with a structured ordering, approval, and invoicing pipeline.</p>
            <p class="section-text">The platform uses industry-standard integrations to reduce duplicate data entry:</p>
            <ul>
                <li><strong>Xero</strong> for invoice management and accounting sync</li>
                <li><strong>Google (Gmail)</strong> for optional email-based order intake (read-only access to a dedicated inbox)</li>
                <li><strong>Supabase</strong> for secure authentication and storage</li>
            </ul>
            <p class="section-text">Alfies is available on web at <a href="https://easy-ordering.vercel.app">easy-ordering.vercel.app</a> and on iOS and Android via Expo.</p>
        </div>

        <div class="section">
            <h2>Contact & Ownership</h2>
            <p class="section-text">This application is operated by an individual developer and the primary point of contact for support, privacy questions, and data requests.</p>
            <div class="owner-card">
                <p><strong>Operator:</strong> Jason Yelen</p>
                <p><strong>Email:</strong> <a href="mailto:yelenjason@gmail.com">yelenjason@gmail.com</a></p>
                <p><strong>Application:</strong> Alfies (production URL: <a href="https://easy-ordering.vercel.app">easy-ordering.vercel.app</a>)</p>
            </div>
        </div>

        <footer>
            <p>
                <a href="/api/privacy-policy">Privacy Policy</a>
                <a href="/api/terms-of-service">Terms of Service</a>
                <a href="mailto:yelenjason@gmail.com">Contact</a>
            </p>
            <p style="margin-top:12px">&copy; ${new Date().getFullYear()} Jason Yelen. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
}
