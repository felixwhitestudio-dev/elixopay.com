# คู่มือการติดตั้งระบบเพื่อความปลอดภัย (Secure Production Deployment Guide)

คู่มือนี้จะอธิบายขั้นตอนการติดตั้ง Elixopay โดยใช้สถาปัตยกรรมแบบ Container ที่มีความปลอดภัยและสอดคล้องกับข้อกำหนดใบอนุญาตทางการเงิน

## สถาปัตยกรรม (Architecture)

- **โซนสาธารณะ (Public Zone)**: Nginx Reverse Proxy (เชื่อมต่อกับอินเทอร์เน็ตได้)
- **โซนแอปพลิเคชัน (App Zone)**: Node.js Backend (เครือข่ายภายใน)
- **โซนข้อมูล (Data Zone)**: PostgreSQL (เครือข่ายปิดตาย ห้ามเข้าถึงจากภายนอก)

## สิ่งที่ต้องเตรียม (Prerequisites)

- เครื่อง Server (VPS) ระบบปฏิบัติการ Ubuntu 20.04/22.04 ใหม่
- สิทธิ์ Root (เข้าใช้งานผ่าน SSH)
- โดเมนที่ชี้มายัง IP ของเครื่อง Server (แนะนำเพื่อให้ติดตั้ง SSL ได้)

## ขั้นตอนการติดตั้ง (Deployment Steps)

1.  **เชื่อมต่อเข้า Server ผ่าน SSH**:
    ```bash
    ssh root@your-server-ip
    ```

2.  **ดาวน์โหลดและรันสคริปต์ติดตั้ง**:
    ```bash
    # ดึงโค้ดโปรเจกต์มา (หรือก๊อปปี้สคริปต์ไปวาง)
    git clone https://github.com/felixwhitestudio-dev/elixopay.com.git /tmp/elixopay
    cd /tmp/elixopay/backend/scripts
    
    # อัพเดทสิทธิ์ให้รันได้
    chmod +x deploy-secure.sh
    
    # เริ่มต้นการติดตั้ง
    sudo ./deploy-secure.sh
    ```

3.  **ตรวจสอบสถานะ**:
    ```bash
    docker ps
    ufw status verbose
    ```

## การจัดการหลังติดตั้ง (Post-Deployment)

### การตั้งค่า SSL (HTTPS)
ไฟล์ `docker-compose.prod.yml` เตรียมพื้นที่สำหรับ SSL ไว้แล้ว คุณควรติดตั้ง Certbot บน **Host** หรือใช้ Container สำหรับ Certbot เพื่อขอใบรับรองและ Map เข้าไปใน Volume ของ Nginx

### การสำรองข้อมูล (Data Backup)
ข้อมูลฐานข้อมูลจะถูกเก็บไว้ใน Docker volume ชื่อ `pgdata`
วิธีสำรองข้อมูล:
```bash
docker run --rm -v pgdata:/volume -v $(pwd):/backup alpine tar -czf /backup/db_backup.tar.gz /volume
```
