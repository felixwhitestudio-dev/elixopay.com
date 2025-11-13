# 🚀 Elixopay Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. เตรียม Environment Variables
- [ ] สร้างไฟล์ `.env.production` พร้อม secrets ใหม่
- [ ] สมัคร Stripe Account และยืนยันธุรกิจ
- [ ] เปลี่ยนจาก Test Keys เป็น Live Keys
- [ ] ตั้งค่า Email SMTP (Gmail, SendGrid, หรือ AWS SES)

### 2. Security Hardening
- [ ] เปลี่ยน CORS จาก `*` เป็น domain จริง
- [ ] เพิ่ม HTTPS-only middleware
- [ ] ตั้ง Rate Limiting ที่เข้มงวดกว่า
- [ ] เปิดใช้ Helmet security headers
- [ ] ซ่อน Error Stack Traces ใน Production

### 3. Database Setup
- [ ] สร้าง Production Database (PostgreSQL)
- [ ] Run migrations บน Production DB
- [ ] Setup Database Backups (ทุกวัน)
- [ ] ตั้งค่า Connection Pool limits

### 4. Server Setup
- [ ] เช่า VPS/Cloud Server
- [ ] ติดตั้ง Node.js, PostgreSQL, Nginx
- [ ] ตั้งค่า Firewall (เปิดแค่ 22, 80, 443)
- [ ] Setup SSH Key Authentication

### 5. Domain & SSL
- [ ] จองโดเมน (.com หรือ .co)
- [ ] ชี้ DNS A Record ไปที่ Server IP
- [ ] ติดตั้ง SSL Certificate (Let's Encrypt)
- [ ] ตั้งค่า Nginx Reverse Proxy

---

## 💰 ราคาโดยประมาณ

### Option A: Startup Budget (~฿1,500/เดือน)
- **Server**: DigitalOcean 2GB RAM ($18/เดือน = ฿630)
- **Database**: Managed PostgreSQL ($15/เดือน = ฿525)
- **Domain**: Namecheap .com (฿400/ปี)
- **SSL**: Let's Encrypt (ฟรี)
- **Email**: SendGrid Free Tier (100 emails/วัน ฟรี)

### Option B: Free/Ultra-Cheap (~฿50/เดือน สำหรับ Testing)
- **Frontend**: Vercel (ฟรี)
- **Backend**: Railway ($5/เดือน) หรือ Render (ฟรี มี sleep)
- **Database**: Supabase (ฟรี tier, 500MB)
- **Domain**: Freenom (ฟรี .tk/.ml) หรือ Namecheap (฿400/ปี)
- **SSL**: Included (ฟรี)

---

## 📦 แนะนำ Cloud Providers

### Backend Hosting

1. **Railway** (แนะนำสำหรับเริ่มต้น)
   - ✅ Deploy ง่ายมาก (Connect GitHub)
   - ✅ Free $5 credit/เดือน
   - ✅ รองรับ PostgreSQL built-in
   - ✅ SSL/Domain ฟรี
   - 💰 $5-20/เดือน
   - 🔗 [railway.app](https://railway.app)

2. **Render**
   - ✅ Free tier มี (มี sleep หลัง 15 นาที)
   - ✅ Deploy ง่าย
   - ✅ SSL ฟรี
   - 💰 Free หรือ $7+/เดือน
   - 🔗 [render.com](https://render.com)

3. **DigitalOcean** (แนะนำสำหรับ Production)
   - ✅ เสถียร
   - ✅ ราคาคุ้มค่า
   - ✅ Managed Database
   - 💰 $6-50/เดือน
   - 🔗 [digitalocean.com](https://www.digitalocean.com)

4. **AWS / GCP** (สำหรับ Enterprise)
   - ⚠️ ซับซ้อน
   - ✅ Scale ได้มาก
   - 💰 $20-1000+/เดือน

### Frontend Hosting

1. **Vercel** (แนะนำ #1)
   - ✅ ฟรี
   - ✅ Auto SSL
   - ✅ CDN Global
   - 🔗 [vercel.com](https://vercel.com)

2. **Netlify**
   - ✅ ฟรี
   - ✅ Deploy ง่าย
   - 🔗 [netlify.com](https://www.netlify.com)

### Database

1. **Supabase** (แนะนำสำหรับเริ่มต้น)
   - ✅ ฟรี 500MB
   - ✅ PostgreSQL
   - ✅ Auto Backups
   - 🔗 [supabase.com](https://supabase.com)

2. **DigitalOcean Managed Database**
   - ✅ Auto Backups
   - ✅ Easy Setup
   - 💰 $15/เดือน
   - 🔗 [digitalocean.com](https://www.digitalocean.com/products/managed-databases)

---

## 🛠️ ขั้นตอนการ Deploy (Railway - แนะนำ)

### 1. สร้าง Production Config

```bash
# สร้าง secrets ใหม่
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. เตรียม Backend

```bash
cd backend
npm install --production
```

### 3. Deploy บน Railway

1. ไปที่ [railway.app](https://railway.app)
2. คลิก "Start a New Project"
3. เลือก "Deploy from GitHub repo"
4. เลือก Elixopay repository
5. เลือก `/backend` folder
6. เพิ่ม Environment Variables จาก `.env.production`
7. คลิก "Deploy"

### 4. Setup Database

1. ใน Railway Dashboard → คลิก "+ New"
2. เลือก "Database" → "PostgreSQL"
3. Copy connection string
4. Update `DATABASE_URL` ใน Environment Variables
5. Run migrations: `npm run migrate`

### 5. Deploy Frontend

1. ไปที่ [vercel.com](https://vercel.com)
2. คลิก "New Project"
3. Import Elixopay repository
4. Root Directory: `/` (ใช้ HTML files โดยตรง)
5. Add Environment Variable: `VITE_API_URL=https://your-backend.railway.app`
6. Deploy

### 6. Setup Domain

**Backend:**
1. Railway → Settings → Generate Domain (ได้ subdomain ฟรี)
2. หรือเพิ่ม Custom Domain

**Frontend:**
1. Vercel → Settings → Domains → Add your domain
2. Update DNS records ตามที่ Vercel บอก

### 7. Update Environment Variables

Update `FRONTEND_URL` ใน Backend env:
```
FRONTEND_URL=https://yourdomain.com
```

Update API URL ใน Frontend files:
```javascript
// แทนที่ http://localhost:3000
const API_URL = 'https://your-backend.railway.app';
```

---

## 🔒 Security Configuration

### 1. แก้ CORS (backend/server.js)

```javascript
// เปลี่ยนจาก
origin: '*'

// เป็น
origin: process.env.FRONTEND_URL
```

### 2. Force HTTPS

```javascript
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
});
```

### 3. Hide Error Details

```javascript
if (process.env.NODE_ENV === 'production') {
  delete error.stack;
}
```

---

## 🧪 Testing Production

### Test API
```bash
curl https://your-backend.railway.app/health
```

### Test Frontend
1. เปิด `https://yourdomain.com`
2. ทดสอบ Login
3. ทดสอบสร้าง Payment (ใช้ Stripe Test Mode ก่อน)

### Test Stripe Webhook
1. Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-backend.railway.app/api/v1/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.failed`

---

## 📊 Monitoring & Maintenance

### Logs
- Railway: Built-in logs
- DigitalOcean: `/var/log/nginx/` และ PM2 logs

### Backups
- Database: Daily auto-backups (Managed DB)
- Code: GitHub repository

### Monitoring
- Railway: Built-in metrics
- Alternative: UptimeRobot (ฟรี) สำหรับ uptime monitoring

---

## 🚨 Common Issues

### Issue 1: CORS Error
**Solution:** ตรวจสอบว่า `FRONTEND_URL` ตรงกับ domain จริง

### Issue 2: Database Connection Failed
**Solution:** ตรวจสอบ connection string และ IP whitelist

### Issue 3: SSL Certificate Error
**Solution:** รอ DNS propagate (24-48 ชั่วโมง)

### Issue 4: Stripe Webhook Failed
**Solution:** ใช้ Stripe CLI test local ก่อน

---

## 📞 Support & Resources

- Elixopay Docs: `/docs.html`
- Stripe Docs: https://stripe.com/docs
- Railway Docs: https://docs.railway.app
- PostgreSQL Docs: https://www.postgresql.org/docs/

---

## ✅ Deployment Checklist

- [ ] Backend deployed
- [ ] Database setup & migrated
- [ ] Frontend deployed
- [ ] Domain configured
- [ ] SSL working
- [ ] Environment variables set
- [ ] CORS configured
- [ ] Stripe webhooks configured
- [ ] Email sending tested
- [ ] Error logging working
- [ ] Backups scheduled
- [ ] Monitoring setup
- [ ] Load testing done

---

**🎉 เมื่อทำครบแล้ว ระบบพร้อม Go Live!**
