# 🚀 Backend Deployment Checklist (Railway)

## ขั้นตอนที่ 1: ตั้งค่า Environment Variables บน Railway

เข้า Railway Project → Variables → เพิ่มตัวแปรเหล่านี้:

### ✅ จำเป็น (Required)
```
NODE_ENV=production
JWT_SECRET=your-random-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
DB_HOST=<from Railway Postgres plugin>
DB_USER=<from Railway Postgres plugin>
DB_PASSWORD=<from Railway Postgres plugin>
DB_NAME=<from Railway Postgres plugin>
DB_PORT=5432
FRONTEND_URL=https://elixopay.com
FRONTEND_ALLOWED_ORIGINS=https://elixopay.com,https://www.elixopay.com
COOKIE_SAMESITE=None
MAX_SESSIONS_PER_USER=10
```

### 🔐 Optional (Security Hardening)
```
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MS=1800000
ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1
LOG_LEVEL=silent
ALLOW_RAILWAY_WILDCARD=false
```

### 👤 Admin Seeding (ถ้าต้องการสร้าง admin อัตโนมัติ)
```
ADMIN_EMAIL=admin@elixopay.com
ADMIN_PASSWORD=StrongPassword123!
ADMIN_NAME=Admin User
ADMIN_VERIFY=true
```

---

## ขั้นตอนที่ 2: Deploy & Restart Backend

1. หลังจากตั้งค่า env vars แล้ว **Redeploy** หรือ **Restart** service
2. รอให้ build + deploy เสร็จ (ดู Logs ว่าขึ้น "Server is running")

---

## ขั้นตอนที่ 3: ตรวจสอบ Backend Health

เปิด browser หรือใช้ curl:
```bash
curl https://<your-backend-url>.railway.app/health
```

ตรวจสอบ JSON response:
```json
{
  "status": "OK",
  "diagnostics": {
    "cookieSameSite": "None",
    "allowedOrigins": ["https://elixopay.com", "https://www.elixopay.com"],
    "allowRailwayWildcard": false,
    "frontendUrl": "https://elixopay.com"
  }
}
```

✅ **ถ้า `allowedOrigins` เป็น array ว่าง** → ยังไม่ได้ตั้ง `FRONTEND_ALLOWED_ORIGINS` หรือ restart ยังไม่เสร็จ

---

## ขั้นตอนที่ 4: ทดสอบ CORS Preflight

ใช้ curl ตรวจสอบ OPTIONS:
```bash
curl -X OPTIONS https://<your-backend-url>.railway.app/api/v1/auth/login \
  -H "Origin: https://elixopay.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

✅ **ควรได้ header:**
```
< HTTP/1.1 204 No Content
< Access-Control-Allow-Origin: https://elixopay.com
< Access-Control-Allow-Credentials: true
< Access-Control-Allow-Methods: GET,POST,PUT,DELETE,PATCH,OPTIONS
```

❌ **ถ้าไม่มี header เหล่านี้** → CORS config ยังไม่ทำงาน (ตรวจ env vars อีกครั้ง)

---

## ขั้นตอนที่ 5: ทดสอบ Login จริง

```bash
curl -X POST https://<your-backend-url>.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://elixopay.com" \
  -d '{"email":"demo@elixopay.com","password":"demo1234"}' \
  -v
```

✅ **ควรได้:**
```
< HTTP/1.1 200 OK
< Set-Cookie: access_token=...; Path=/; HttpOnly; Secure; SameSite=None
< Set-Cookie: refresh_token=...; Path=/; HttpOnly; Secure; SameSite=None
< Set-Cookie: csrf_token=...; Path=/; Secure; SameSite=None
< Access-Control-Allow-Origin: https://elixopay.com
< Access-Control-Allow-Credentials: true
```

---

## ขั้นตอนที่ 6: Seed Admin User (ถ้ายังไม่มี)

ใช้ Railway CLI หรือ Web Console Shell:
```bash
railway run npm run seed:admin
```

หรือถ้าต้องการสุ่มรหัสผ่าน:
```bash
railway variables set ADMIN_EMAIL=admin@elixopay.com
railway run npm run seed:admin
```

จะได้ output:
```json
{
  "action": "inserted",
  "email": "admin@elixopay.com",
  "generatedPassword": "<รหัสสุ่ม 16 ตัว>"
}
```
**เก็บรหัสนี้ทันที** เพราะไม่ได้บันทึกไว้ที่ไหน

---

## ขั้นตอนที่ 7: อัปเดต Frontend API Config

แก้ไฟล์ `js/api-config.js` ตั้ง `PROD_BASE`:
```javascript
const PROD_BASE = 'https://<your-backend-url>.railway.app';
```

Commit + Push → Netlify/Vercel จะ redeploy อัตโนมัติ

---

## ขั้นตอนที่ 8: ทดสอบ Login บน Frontend

1. เปิด https://elixopay.com/login.html
2. กรอก email + password (ใช้ demo@elixopay.com / demo1234 หรือ admin ที่ seed)
3. เปิด DevTools → Network → ดูว่า login POST ตอบ 200 + มี Set-Cookie
4. ตรวจ Application → Cookies → ควรเห็น `access_token`, `refresh_token`, `csrf_token` (ทั้ง 3)

✅ **ถ้าล็อกอินสำเร็จ** → redirect ไปที่ dashboard/admin-dashboard ตาม role

---

## 🐛 Troubleshooting

### ปัญหา: CORS blocked แม้ตั้งค่าแล้ว
- ตรวจว่า restart/redeploy backend เรียบร้อย
- ตรวจว่า origin ตรงกัน (https vs http, www vs non-www)
- ใช้ชั่วคราว `ALLOW_RAILWAY_WILDCARD=true` (แก้ด่วน แต่ลดความปลอดภัย)

### ปัญหา: Cookies ไม่ถูก set
- ต้องเป็น HTTPS (ถ้า SameSite=None)
- ตรวจว่า `COOKIE_SAMESITE=None` ตั้งแล้ว
- ต้องมี `credentials: 'include'` ฝั่ง frontend (ใช้ `apiFetch` ใน api-config.js แล้ว)

### ปัญหา: Admin user ยังไม่มี
- รัน `npm run seed:admin` ผ่าน Railway shell
- หรือใช้ SQL console ใส่โดยตรง (schema.sql มี INSERT แบบตัวอย่าง)

---

## 📋 Quick Reference

| Env Var | ค่าแนะนำ | จำเป็น |
|---------|---------|--------|
| `FRONTEND_URL` | https://elixopay.com | ✅ |
| `FRONTEND_ALLOWED_ORIGINS` | https://elixopay.com,https://www.elixopay.com | ✅ |
| `COOKIE_SAMESITE` | None (cross-domain), Strict (same apex) | ✅ |
| `JWT_SECRET` | random 32+ chars | ✅ |
| `JWT_REFRESH_SECRET` | random 32+ chars | ✅ |
| `MAX_SESSIONS_PER_USER` | 10 | ⚠️ |
| `ADMIN_EMAIL` | admin@yoursite.com | 🔧 |
| `ADMIN_PASSWORD` | <strong> or auto-generated | 🔧 |

---

## 🎉 เมื่อทุกอย่างเสร็จ

- [ ] Backend health ขึ้น OK + diagnostics ถูกต้อง
- [ ] CORS preflight ผ่าน (OPTIONS ตอบ 204 + headers)
- [ ] Login ได้ 200 + Set-Cookie 3 ตัว
- [ ] Admin user seed เรียบร้อย
- [ ] Frontend login redirect ถูกต้อง (user → dashboard, admin → admin-dashboard)
- [ ] Dashboard endpoint `/api/v1/dashboard` ตอบ user + sessions + stats (ถ้า admin)

**พร้อมใช้งานจริง!** 🚀
