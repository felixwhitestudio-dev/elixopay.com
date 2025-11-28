#!/bin/bash

# กำหนดค่าเซิร์ฟเวอร์ Vultr
VULTR_IP="45.76.161.48"
VULTR_USER="root"
VULTR_WEBROOT="/var/www/elixopay"

# อัปโหลดไฟล์ frontend ทั้งหมดไป Vultr
scp -r ./index.html ./about.html ./pricing.html ./contact.html ./usecases.html ./favicon.svg ./js ./styles $VULTR_USER@$VULTR_IP:$VULTR_WEBROOT

# SSH ไป Vultr แล้ว reload nginx
ssh $VULTR_USER@$VULTR_IP "nginx -t && systemctl reload nginx"

echo "Deploy frontend to Vultr completed!"
