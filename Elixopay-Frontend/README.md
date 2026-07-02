# Elixopay Frontend

Merchant Dashboard & Public Website สำหรับ Elixopay Payment Platform

## Pages

### 🏠 Public Pages
- `index.html` — Landing page
- `about.html` — About
- `pricing.html` — Pricing
- `contact.html` — Contact
- `docs.html` — API Documentation
- `developer.html` — Developer portal
- `get-started.html` — Get started guide
- `usecases.html` — Use cases
- `security.html` — Security info
- `terms.html` — Terms of service
- `privacy.html` — Privacy policy

### 📊 Dashboard Pages (Auth required)
- `dashboard.html` — Main dashboard
- `transactions.html` — Transaction history
- `payout.html` — Payout management
- `api-keys.html` — API key management
- `webhooks.html` — Webhook configuration
- `settings.html` — Account settings
- `billing.html` — Billing & subscriptions

## Development

เปิดไฟล์ HTML ตรงๆ ในเบราว์เซอร์ หรือใช้ live-server:

```bash
# ใช้ Live Server
npx live-server --port=5500

# หรือใช้ Python
python3 -m http.server 5500
```

### API Configuration

แก้ไข `js/api-config.js` เพื่อชี้ไปที่ Elixopay Backend:
- **Dev**: `http://localhost:3000` (auto-detect)
- **Prod**: `https://api.elixopay.com`

## Deploy

Static site — deploy ได้ที่ Netlify, Vercel, Cloudflare Pages, หรือ S3

## License

Proprietary — Elixopay
