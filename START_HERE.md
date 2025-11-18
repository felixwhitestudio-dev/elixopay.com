# 🚀 Elixopay - Quick Start Guide

## วิธีเปิดโปรเจกต์

### ตัวเลือก 1: ใช้ Backend ในเครื่อง (แนะนำสำหรับพัฒนา)

```bash
npm run dev
```

คำสั่งนี้จะเปิด:
- **Backend API** → http://localhost:3000
- **Frontend** → http://localhost:8080

### ตัวเลือก 2: ใช้ Backend จาก Railway (ไม่ต้องรัน backend)

```bash
npm run dev:remote
```

คำสั่งนี้จะเปิดแค่:
- **Frontend** → http://localhost:8080
- **Backend** → https://elixopay-production.up.railway.app (อยู่บน Railway)

จากนั้นเปิด: `http://localhost:8080/login.html?api=remote`

---

## 🔐 บัญชีทดสอบ

### Local Backend:
- **Email:** `demo@elixopay.com`
- **Password:** `demo1234`

### Railway Backend:
- ใช้บัญชีที่สร้างไว้บน production หรือสร้างใหม่ที่หน้า signup

---

## 🎯 เปลี่ยน API Backend แบบไว

เพิ่ม `?api=remote` หรือ `?api=local` ใน URL:

```
# ใช้ Railway backend
http://localhost:8080/login.html?api=remote

# ใช้ Local backend
http://localhost:8080/login.html?api=local
```

หรือตั้งค่าถาวรใน Console:
```javascript
// ใช้ Railway
localStorage.setItem('api_base_url', 'https://elixopay-production.up.railway.app')

// ใช้ Local
localStorage.setItem('api_base_url', 'http://localhost:3000')
```

---

## 🔧 คำสั่งอื่นๆ

```bash
# รัน backend + frontend (local)
npm run dev:local

# รัน backend อย่างเดียว
npm run dev:backend

# รัน frontend อย่างเดียว (ใช้ Railway)
npm run dev:frontend

# รัน migrations
npm --prefix backend run migrate
```

## 🌐 URLs สำคัญ

### Local:
- Frontend: http://localhost:8080
- Backend API: http://localhost:3000/api/v1
- Health Check: http://localhost:3000/health

### Production (Railway):
- Backend API: https://elixopay-production.up.railway.app/api/v1
- Health Check: https://elixopay-production.up.railway.app/health

---

**สนุกกับการพัฒนา! 🎉**
