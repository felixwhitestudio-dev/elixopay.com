# 🚀 Elixopay Backend - Quick Start

## ✅ สิ่งที่ทำเสร็จแล้ว

### 🔧 Backend Server
- ✅ Express.js server พร้อม CORS configuration
- ✅ JWT Authentication (demo@elixopay.com)
- ✅ API Routes (auth, payments, users, api-keys, webhooks, partners, admin)
- ✅ Middleware (auth, error handler, logger, validators)
- ✅ รองรับทั้ง localhost และ Railway.app

### 📝 ไฟล์ที่สร้างแล้ว
- `server.js` - Main server file
- `package.json` - Dependencies และ scripts
- `Procfile` - Railway start command
- `railway.json` - Railway configuration
- `.env.production` - Production environment template
- `.gitignore` - Git ignore rules
- `RAILWAY_DEPLOYMENT.md` - คู่มือ deploy

## 🏃 การรัน Backend

### Development (Local)
```bash
cd /Users/felixonthecloud/Elixopay/backend
node server.js
```

Server จะรันที่: **http://localhost:3000**

### ทดสอบ Endpoints

1. **Health Check**
```bash
curl http://localhost:3000/health
```

2. **API Info**
```bash
curl http://localhost:3000/
```

3. **Login (Demo Account)**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@elixopay.com","password":"demo123"}'
```

## 🌐 Frontend Access

เปิด browser ที่: **http://localhost:8080/login.html**

**Demo Credentials:**
- Email: `demo@elixopay.com`
- Password: อะไรก็ได้ (ใช้งานได้ทุกรหัสผ่านสำหรับ demo)

## 🔄 สถานะปัจจุบัน

### Running Services
- ✅ Backend Server: http://localhost:3000 (Node.js)
- ✅ Frontend Server: http://localhost:8080 (Python HTTP Server)

### ตรวจสอบสถานะ
```bash
# Check backend
lsof -ti:3000

# Check frontend
lsof -ti:8080
```

### Stop Services
```bash
# Stop backend
kill $(lsof -ti:3000)

# Stop frontend
kill $(lsof -ti:8080)
```

## 📦 Deploy to Railway.app

### ขั้นตอนสั้น ๆ:

1. **Push to GitHub**
```bash
cd /Users/felixonthecloud/Elixopay/backend
git init
git add .
git commit -m "Ready for Railway deployment"
git remote add origin <your-repo-url>
git push -u origin main
```

2. **Deploy on Railway**
- ไปที่ https://railway.app
- เชื่อม GitHub repository
- เพิ่ม Environment Variables (ดูใน `.env.production`)
- Deploy!

3. **ได้ URL เช่น:**
```
https://elixopay-production.up.railway.app
```

📚 **คู่มือฉบับเต็ม:** อ่านที่ `RAILWAY_DEPLOYMENT.md`

## 🔐 Security Notes

### สำหรับ Production:
1. เปลี่ยน `JWT_SECRET` เป็นค่าสุ่มที่ปลอดภัย
2. ตั้งค่า `NODE_ENV=production`
3. เปลี่ยน default password
4. เปิดใช้งาน rate limiting
5. เพิ่ม database จริง (PostgreSQL)

### Generate JWT Secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📊 API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/register` - Register
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/logout` - Logout

### Payments
- `GET /api/v1/payments` - List payments
- `POST /api/v1/payments` - Create payment
- `GET /api/v1/payments/:id` - Get payment details

### Users
- `GET /api/v1/users/profile` - Get profile
- `PUT /api/v1/users/profile` - Update profile
- `GET /api/v1/users/stats` - Get statistics

### API Keys
- `GET /api/v1/api-keys` - List API keys
- `POST /api/v1/api-keys` - Create API key
- `DELETE /api/v1/api-keys/:id` - Revoke API key

## 🐛 Troubleshooting

### Backend ไม่ทำงาน?
```bash
# ดู logs
tail -f server.log

# หรือรันแบบดู output
node server.js
```

### Port ถูกใช้งานอยู่?
```bash
# หา process ที่ใช้ port 3000
lsof -ti:3000 | xargs kill
```

### CORS Error?
- ตรวจสอบว่าเข้าผ่าน http://localhost:8080 ไม่ใช่ file://
- ดู allowed origins ใน `server.js`

## 📞 Support

- 📖 Documentation: อ่านใน `/backend/RAILWAY_DEPLOYMENT.md`
- 🐛 Issues: สร้าง issue ใน GitHub
- 💬 Questions: ถามได้เลย!

## 🎉 Next Steps

1. ✅ Backend server รันได้แล้ว
2. ✅ Frontend ใช้งานได้แล้ว
3. 🚀 พร้อม deploy ไป Railway.app
4. 🔜 เพิ่ม PostgreSQL database
5. 🔜 เพิ่ม payment gateway integration
6. 🔜 เพิ่ม email notifications

---

**สถานะ:** ✅ Backend พร้อมใช้งาน และพร้อม deploy!
