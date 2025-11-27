# วิธี Deploy Backend ลง Vultr แบบ Manual

## ปัญหา: SSH Password ไม่ใช้งาน

รหัสผ่านจาก Vultr อาจไม่ถูกต้อง แก้โดย:

### 1. Reset Root Password ใน Vultr Console

1. ไปที่ Vultr Dashboard → คลิกที่ server (45.76.161.48)
2. กด "Server Details" → "Settings" → หา "Root Password"
3. กด **"Reset Root Password"** เพื่อสร้างรหัสผ่านใหม่
4. คัดลอกรหัสผ่านใหม่ที่ได้

หรือ

### 2. ใช้ Console Browser จาก Vultr (แนะนำ - ง่ายที่สุด)

1. ไปที่ Vultr Dashboard
2. คลิกที่ server ของคุณ
3. กดปุ่ม **"View Console"** ที่มุมขวาบน
4. จะเปิด Browser Console ให้ login ได้เลย (ไม่ต้องใช้ SSH)
5. Login: `root` + รหัสผ่านจาก Vultr
6. Run คำสั่งข้างล่างใน Console

---

## คำสั่ง Deploy ใน Server (ใช้ใน Vultr Console)

ทำทีละขั้นตอน:

### Step 1: Update ระบบ
```bash
apt update && apt upgrade -y
```

### Step 2: ติดตั้ง Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git postgresql postgresql-contrib nginx
node --version  # ตรวจสอบ version
```

### Step 3: Setup PostgreSQL Database
```bash
sudo -u postgres psql << 'EOF'
CREATE DATABASE elixopay;
CREATE USER elixopay_user WITH PASSWORD 'Elixo2024SecurePass';
GRANT ALL PRIVILEGES ON DATABASE elixopay TO elixopay_user;
ALTER DATABASE elixopay OWNER TO elixopay_user;
\q
EOF
```

### Step 4: Clone โปรเจค
```bash
cd /opt
git clone https://github.com/felixwhitestudio-dev/elixopay.com.git
cd /opt/elixopay.com/backend
npm install
```

### Step 5: สร้าง Environment File
```bash
cat > .env << 'ENVEOF'
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=elixopay
DB_USER=elixopay_user
DB_PASSWORD=Elixo2024SecurePass
DB_SSL=false

# JWT (จะ generate ใหม่ในขั้นตอนถัดไป)
JWT_SECRET=temp
JWT_REFRESH_SECRET=temp
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# CORS & Cookies
FRONTEND_URL=https://elixopay.com
FRONTEND_ALLOWED_ORIGINS=https://elixopay.com,https://www.elixopay.com
COOKIE_SAMESITE=Lax
MAX_SESSIONS_PER_USER=10
ALLOW_RAILWAY_WILDCARD=false

# Security
ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MS=1800000

# Server
SERVER_URL=http://45.76.161.48

# Admin
ADMIN_EMAIL=admin@elixopay.com
ADMIN_PASSWORD=Admin123!@#
ADMIN_VERIFY=true
ENVEOF
```

### Step 6: Generate JWT Secrets
```bash
JWT_SEC=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_REF=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# Update .env with real secrets
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SEC/" .env
sed -i "s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$JWT_REF/" .env
```

### Step 7: Run Migrations & Seed Admin
```bash
npm run migrate
npm run seed:admin
```

### Step 8: Setup PM2
```bash
npm install -g pm2
pm2 start server.js --name elixopay-backend --env production
pm2 startup systemd -u root --hp /root
pm2 save
pm2 status  # ตรวจสอบว่า running
```

### Step 9: Setup Nginx Reverse Proxy
```bash
cat > /etc/nginx/sites-available/elixopay << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/elixopay /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

---

## ทดสอบว่า Backend ทำงาน

จากเครื่องของคุณ (Mac) ใน Terminal:

```bash
# 1. Test Health Check
curl http://45.76.161.48/health

# 2. Test Login
curl -X POST http://45.76.161.48/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@elixopay.com","password":"Admin123!@#"}' \
  -v
```

ถ้าได้ response กลับมา แปลว่าสำเร็จ! 🎉

---

## ถ้าต้องการดู Logs

```bash
pm2 logs elixopay-backend
pm2 status
```

---

## ขั้นตอนถัดไป

1. ✅ Deploy backend (ทำแล้ว)
2. ⏭️ อัปเดต Frontend `js/api-config.js`:
   - เปลี่ยน `PROD_BASE` เป็น `http://45.76.161.48`
3. ⏭️ Deploy frontend ใหม่บน Netlify
4. 🔒 ติดตั้ง SSL ด้วย Certbot (ถ้าต้องการ HTTPS)

---

## คำสั่งที่มีประโยชน์

```bash
# Restart backend
pm2 restart elixopay-backend

# ดู logs แบบ realtime
pm2 logs elixopay-backend --lines 100

# Stop backend
pm2 stop elixopay-backend

# Update code จาก GitHub
cd /opt/elixopay.com && git pull origin main
cd backend && npm install
pm2 restart elixopay-backend
```
