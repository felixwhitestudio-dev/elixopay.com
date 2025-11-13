# Elixopay - Payment Gateway

![Elixopay](favicon.svg)

Payment Gateway ที่ปลอดภัยที่สุดสำหรับธุรกิจไทย ด้วยความปลอดภัยระดับธนาคารและเทคโนโลยีที่ทันสมัยที่สุด

## 🚀 คุณสมบัติ

- ✅ **ปลอดภัยสูงสุด**: PCI DSS Level 1, ISO 27001, SOC 2 Type II
- 💳 **รองรับหลายช่องทาง**: บัตรเครดิต/เดบิต, PromptPay, Mobile Banking, E-Wallet
- 🌍 **Cross-border Payment**: รองรับ 135+ สกุลเงิน
- ⚡ **API ทันสมัย**: RESTful API พร้อม SDK 6 ภาษา
- 📊 **Dashboard แบบ Real-time**: ติดตามธุรกรรมและรายงานแบบทันที
- 🤝 **Partner Program**: โปรแกรมพาร์ทเนอร์พร้อมระบบค่าคอมมิชชั่น

## 📁 โครงสร้างเว็บไซต์

### หน้าหลัก
- `index.html` - หน้าแรก Landing Page
- `pricing.html` - แพ็กเกจและราคา
- `docs.html` - เอกสาร API Documentation
- `security.html` - ข้อมูลด้านความปลอดภัย

### หน้าสำหรับผู้ใช้
- `login.html` - เข้าสู่ระบบ
- `signup.html` - สมัครสมาชิก
- `dashboard.html` - แดชบอร์ดผู้ใช้

### หน้าพาร์ทเนอร์
- `partners.html` - โปรแกรมพาร์ทเนอร์
- `partner-dashboard.html` - แดชบอร์ดพาร์ทเนอร์
- `admin-dashboard.html` - แดชบอร์ดแอดมิน (จัดการค่าคอมมิชชั่น)

### หน้าข้อมูล
- `about.html` - เกี่ยวกับเรา
- `usecases.html` - กรณีศึกษา
- `blog.html` - บล็อกและแหล่งความรู้
- `contact.html` - ติดต่อเรา
- `help.html` - ศูนย์ช่วยเหลือ/FAQ
- `status.html` - สถานะระบบ

### หน้ากฎหมาย
- `terms.html` - ข้อกำหนดการใช้งาน
- `privacy.html` - นโยบายความเป็นส่วนตัว

### หน้าพิเศษ
- `404.html` - หน้า Error 404

## 🛠️ เทคโนโลジี

- **Frontend**: HTML5, Tailwind CSS 3.x
- **Icons**: Heroicons (via Tailwind)
- **Fonts**: Inter (Google Fonts)
- **Code Highlighting**: Highlight.js 11.9.0
- **Design Pattern**: Stripe-inspired aesthetic

## 🎨 Design System

### สี
- **Primary Gradient**: `#635BFF` → `#9B8EFF`
- **Success**: `#10b981`
- **Warning**: `#f59e0b`
- **Error**: `#ef4444`
- **Info**: `#6366f1`

### Typography
- **Font Family**: Inter
- **Weights**: 300 (Light), 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold), 800 (Extra-bold)

### Components
- **Border Radius**: `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px), `rounded-full`
- **Shadows**: `shadow-lg`, `shadow-xl`
- **Transitions**: `transition-all duration-300`

## 🚦 การรันเว็บไซต์

### วิธีที่ 1: Python HTTP Server (แนะนำ)
```bash
cd Elixopay
python3 -m http.server 8000
```
เปิดเบราว์เซอร์ที่: `http://localhost:8000`

### วิธีที่ 2: PHP Built-in Server
```bash
cd Elixopay
php -S localhost:8000
```

### วิธีที่ 3: Live Server (VS Code Extension)
1. ติดตั้ง Live Server extension
2. คลิกขวาที่ `index.html`
3. เลือก "Open with Live Server"

## 📊 สถิติเว็บไซต์

- **จำนวนหน้า**: 19 หน้า
- **Component**: 50+ components
- **Responsive**: ✅ Mobile, Tablet, Desktop
- **Accessibility**: WCAG 2.1 Level AA compliant
- **Performance**: Optimized for Core Web Vitals

## 🔒 ความปลอดภัย

### มาตรฐานที่ใช้
- PCI DSS Level 1
- ISO 27001
- SOC 2 Type II
- TLS 1.3
- AES-256 Encryption

### Security Headers
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer-Policy

ไฟล์: `.htaccess` และ `SECURITY_README.md`

## 🤝 Partner Program

### ระดับค่าคอมมิชชั่น
1. **Starter** (10%): 0-9 ลูกค้า
2. **Professional** (20%): 10-49 ลูกค้า + โบนัส ฿5,000
3. **Enterprise** (30%): 50+ ลูกค้า + โบนัส ฿10,000

### แอดมินสามารถปรับค่าคอมมิชชั่นได้ที่
`admin-dashboard.html` > Commission Settings

## 📱 Features ที่โดดเด่น

### ✨ Interactive Components
- Mobile responsive navigation
- Accordion FAQ
- Search & Filter (Blog, Help Center)
- Form validation
- Toast notifications
- Modal dialogs
- Tabs & Pills navigation

### 🎯 Dashboard Features
- Overview statistics
- Transaction history
- API key management
- Settings & Profile
- Export reports
- Webhook configuration

### 🔔 Status Page
- Real-time system status
- 90-day uptime chart
- Incident history
- Performance metrics
- Email notifications

## 📚 Documentation

เอกสาร API ฉบับสมบูรณ์อยู่ที่ `docs.html` ประกอบด้วย:
- Authentication
- Create Payment
- Get Payment
- List Payments
- Webhooks
- Error Codes

รองรับ SDK ใน 6 ภาษา:
- PHP
- Node.js
- Python
- Ruby
- Java
- .NET

## 🌐 SEO & Meta Tags

ทุกหน้ามี:
- ✅ Title tags
- ✅ Meta descriptions
- ✅ Open Graph tags
- ✅ Favicon (SVG)
- ✅ Canonical URLs
- ✅ Structured data ready

## 📞 ติดต่อ

- **Email**: support@elixopay.com
- **Phone**: +66 2 123 4567
- **Address**: 123 อาคารแกรนด์ทาวเวอร์, ถนนสาทร, กรุงเทพฯ 10500

## 📄 License

© 2568 Elixopay. สงวนลิขสิทธิ์.

---

**Built with ❤️ for Thai businesses**
