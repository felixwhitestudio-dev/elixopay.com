#!/bin/bash

# สคริปต์สำหรับ Push code ขึ้น GitHub
# หลังจากสร้าง Repository บน GitHub แล้ว ให้รันสคริปต์นี้

echo "🚀 Elixopay - Push to GitHub"
echo "================================"
echo ""
echo "⚠️  ก่อนรันสคริปต์นี้:"
echo "1. ไปที่ https://github.com/new"
echo "2. ตั้งชื่อ Repository: elixopay"
echo "3. กด Create repository"
echo "4. Copy ชื่อ username ของคุณ"
echo ""
echo -n "กรอก GitHub Username ของคุณ: "
read GITHUB_USERNAME

echo ""
echo "กำลัง Push code ขึ้น GitHub..."
echo ""

# เพิ่ม remote
git remote add origin https://github.com/$GITHUB_USERNAME/elixopay.git

# Push ขึ้น GitHub
git push -u origin main

echo ""
echo "✅ Push สำเร็จ!"
echo ""
echo "📋 ขั้นตอนถัดไป:"
echo "1. ไปที่ https://vercel.com"
echo "2. Sign up with GitHub"
echo "3. Import project: elixopay"
echo "4. Deploy!"
echo ""
echo "🌐 หลัง Deploy เสร็จ:"
echo "- ไปที่ Vercel Settings → Domains"
echo "- Add domain: elixopay.com"
echo "- ตั้งค่า DNS ใน Squarespace"
echo ""
