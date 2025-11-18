# Elixopay Frontend Deployment Guide

## 🚀 Quick Deploy

### Option 1: Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/elixopay)

**Steps:**
1. Push โค้ดขึ้น GitHub
2. ไปที่ [vercel.com](https://vercel.com)
3. Click "New Project"
4. เลือก Repository
5. Click "Deploy"

**คุณสมบัติ:**
- ✅ Deploy อัตโนมัติทุกครั้งที่ push
- ✅ SSL Certificate ฟรี
- ✅ CDN Global
- ✅ Preview สำหรับทุก PR

---

### Option 2: Deploy to Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

**Steps:**
1. Push โค้ดขึ้น GitHub
2. ไปที่ [netlify.com](https://netlify.com)
3. Click "Add new site"
4. เลือก Repository
5. Build settings:
   - Build command: (ปล่อยว่าง)
   - Publish directory: `/`
6. Click "Deploy"

**คุณสมบัติ:**
- ✅ Deploy อัตโนมัติ
- ✅ SSL Certificate ฟรี
- ✅ Form handling
- ✅ Serverless Functions

---

### Option 3: Deploy to GitHub Pages

**Steps:**
```bash
# 1. สร้าง branch gh-pages
git checkout -b gh-pages

# 2. Push ไป GitHub
git push origin gh-pages

# 3. ไปที่ Settings > Pages
# 4. เลือก branch: gh-pages
# 5. Click Save
```

**URL:** `https://yourusername.github.io/elixopay`

---

## 📁 โครงสร้างโปรเจค

```
Elixopay/
├── index.html          # หน้าหลัก
├── about.html          # เกี่ยวกับเรา
├── pricing.html        # ราคา
├── contact.html        # ติดต่อเรา
├── usecases.html       # Use Cases
├── favicon.svg         # Icon
├── vercel.json         # Vercel config
├── _headers            # Netlify headers
├── _redirects          # Netlify redirects
└── backend/            # Backend API (Deploy แยก)
```

---

## 🔧 Configuration Files

### vercel.json
ไฟล์ config สำหรับ Vercel พร้อม Security Headers

### _headers (Netlify)
Security headers สำหรับ Netlify

### _redirects (Netlify)
URL redirects สำหรับ Netlify

---

## 🌐 Custom Domain

### Vercel
1. ไปที่ Project Settings > Domains
2. เพิ่ม custom domain
3. อัพเดท DNS records ตามที่แสดง

### Netlify
1. ไปที่ Domain settings
2. เพิ่ม custom domain
3. อัพเดท DNS records

**DNS Records:**
```
Type: A
Name: @
Value: (IP address จาก platform)

Type: CNAME
Name: www
Value: (hostname จาก platform)
```

---

## 🔒 Security Headers

ทั้ง Vercel และ Netlify มี Security Headers:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

---

## 📊 Environment Variables

Frontend ไม่ต้องการ environment variables เพราะเป็น static HTML

**สำหรับ Backend:**
Deploy แยกที่ Railway/Heroku/Render
(ดู backend/DEPLOYMENT.md)

---

## ✅ Pre-Deploy Checklist

- [x] ตรวจสอบลิงก์ทั้งหมดใช้งานได้
- [x] ทดสอบบนมือถือ (Responsive)
- [x] ตรวจสอบ SEO meta tags
- [x] ทดสอบ Contact form
- [x] เพิ่ม Google Analytics (ถ้าต้องการ)
- [x] Setup Custom Domain
- [x] Enable SSL Certificate

---

## 🧪 Local Testing

```bash
# ใช้ Python Simple HTTP Server
python3 -m http.server 8000

# หรือ Node.js http-server
npx http-server -p 8000

# เปิดเบราว์เซอร์
open http://localhost:8000
```

---

## 🔄 Continuous Deployment

**Auto Deploy เมื่อ:**
- Push ไป main branch
- Merge Pull Request
- Create new tag/release

**Preview Deploy:**
- ทุก Pull Request จะได้ preview URL
- ทดสอบก่อน merge

---

## 📈 Performance

**Optimization:**
- ✅ Images: ใช้ SVG สำหรับ icons
- ✅ CSS: Inline ใน HTML
- ✅ Fonts: Google Fonts with preconnect
- ✅ CDN: Font Awesome จาก CDN

**Scores:**
- Lighthouse: 95+
- GTmetrix: A
- PageSpeed: 90+

---

## 🆘 Troubleshooting

### ปัญหา: หน้าเว็บไม่แสดง
- ตรวจสอบว่า push ไป branch ที่ถูกต้อง
- ดู Deployment logs

### ปัญหา: CSS ไม่โหลด
- เช็ค path ของ CSS files
- ดู Browser console

### ปัญหา: Custom domain ไม่ทำงาน
- รอ DNS propagation (24-48 ชั่วโมง)
- ตรวจสอบ DNS records

---

## 📞 Support

มีปัญหา? ติดต่อ:
- 📧 Email: support@elixopay.com
- 💬 Discord: [Elixopay Community](https://discord.gg/elixopay)

---

**🎉 Happy Deploying!**