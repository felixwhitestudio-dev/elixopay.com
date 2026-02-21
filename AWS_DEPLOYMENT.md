# คู่มือการติดตั้ง Elixopay บน AWS (3-Tier Architecture)

โครงสร้างของโปรเจกต์ได้ถูกแยกออกเป็น `public-site` และ `app-server` เรียบร้อยแล้วเพื่อรองรับบนระบบ Architecture แบบ 3 เซิร์ฟเวอร์บน AWS ตามที่คุณต้องการ นี่คือขั้นตอนการนำขึ้นระบบจริงสำหรับแต่ละเซิร์ฟเวอร์

## โครงสร้างโปรเจกต์ที่อัปเดตใหม่
- **/public-site/**: เก็บไฟล์ HTML/CSS/JS สำหรับหน้าเว็บสาธารณะ (Server 1)
- **/app-server/**: เก็บโค้ด Backend API (Node.js/Express) และไฟล์ของแอปพลิเคชันหลังบ้านในแฟ้ม `/public` (Server 2)
- **Database**: ฐานข้อมูลที่เชื่อมต่อผ่านไฟล์ `.env` (Server 3)

---

## ☁️ Server 1: Public Web (Amazon S3 + CloudFront)
หน้าเว็บพวก Landing Page, About Us, Pricing ไม่มีข้อมูลสำคัญ ปลอดภัยที่สุดและราคาถูกที่สุดคือการใช้ S3 Hosting + CloudFront CDN

1. **สร้าง AWS S3 Bucket**
   - สร้าง Bucket ใหม่โดยตั้งชื่อตรงกับโดเมน (เช่น `www.elixopay.com`)
   - ไปที่แท็บ Properties เปิดใช้ **Static website hosting** (ตั้งค่า `index.html` เป็น Index document และ `404.html` เป็น Error document)
   - ปลดบล็อก **Block Public Access** ทั้งหมด ในแท็บ Permissions
   - ใส่ Bucket Policy เพื่ออนุญาตให้สิทธิ์คนนอกเข้าถึงไฟล์ใน Bucket

2. **อัปโหลดไฟล์**
   - นำไฟล์ทั้งหมด **ภายในแฟ้ม `/public-site`** อัปโหลดขึ้น S3 Bucket

3. **เชื่อมต่อ AWS CloudFront (CDN) และ SSL**
   - ไปที่ CloudFront กด Create Distribution เลือก Origin เป็น S3 Bucket ที่พึ่งสร้าง
   - ใช้ AWS Certificate Manager (ACM) สร้าง SSL/HTTPS Certificate สำหรับโดเมนของคุณ
   - ตั้งค่า Alternate Domain Names เป็นชื่อเว็บไซต์ (เช่น `www.elixopay.com`)
   - เลือก Viewer Protocol Policy เป็น **Redirect HTTP to HTTPS**

---

## 🖥️ Server 2: Application Server (Amazon EC2 / Elastic Beanstalk)
ให้บริการ Logic ต่างๆ, ระบบหลังบ้าน (Dashboard), การประมวลผลธุรกรรม

1. **สร้างและตั้งค่า EC2 Instance**
   - แนะนำให้ใช้ Ubuntu Server 22.04 LTS เป็นขุมพลังหลัก
   - ใน Security Group ให้ตั้งค่า:
     - Allow Port 80 (HTTP) จาก 0.0.0.0/0
     - Allow Port 443 (HTTPS) จาก 0.0.0.0/0
     - Allow Port 22 (SSH) เฉพาะจาก IP ของแอดมินเท่านั้น

2. **นำโปรเจกต์ขึ้น EC2**
   - นำแฟ้ม **/app-server** ไปรันบน EC2
   - การลง Dependencies ปัจจุบัน:
     ```bash
     cd app-server
     npm install
     ```
   - ตั้งค่าตัวแปรในไฟล์ `.env` ให้ชี้หา Database ใหม่ (Server 3) และกำหนด `FRONTEND_ALLOWED_ORIGINS` เป็น URL ของคุณ
   
3. **ใช้ PM2 ในการรันแอปพลิเคชันอย่างเสถียร**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "elixopay-app"
   ```

4. **ตั้งค่า Reverse Proxy ด้วย Nginx**
   - ลง Nginx และโยง Port 80/443 ไปที่ Port 3000 ของ Node.js 
   - ตอนนี้ Express ของเราถูกตั้งให้ Redirect ผู้ใช้ที่เข้า URL ราก (`/`) ไปยัง `/login.html` แล้ว ดังนั้นผู้ใช้แค่เข้าแอปก็พร้อมใช้งานทันที

---

## 🗄️ Server 3: Database Server (Amazon RDS)
แยกการตั้งค่าฐานข้อมูลให้พ้นจากเซิร์ฟเวอร์สาธารณะทั้งหมด

1. **สร้าง Database บน AWS RDS**
   - เลือก Engine (PostgreSQL หรือ MySQL) 
   - สร้างแบบ **Private** คือค่า **Public Access = NO** (ไม่มีวันเปิดให้ระบบอื่นภายนอกเข้าถึงได้)

2. **ตั้งค่าความปลอดภัย Security Group อย่างเด็ดขาด**
   - ให้สิทธิ์ Inbound Rules ใน Port ของ DB (เช่น 5432) เฉพาะ **Private IP Address / Security Group ของ EC2 Server 2** เท่านั้น

3. **เชื่อมต่อจาก Server 2**
   - ฐานข้อมูลนี้จะทำหน้าที่เป็นหัวใจการเก็บรักษาข้อมูลลูกค้ายืนยันความปลอดภัยให้กับผู้ใช้งาน Server 2 ที่ถูกส่งมาจาก Load Balancer อีกทอดหนึ่ง
   - เข้า EC2 Server 2 แก้ไขไฟล์ `/app-server/.env` นำ Endpoint ของ RDS ใส่เข้าไป
