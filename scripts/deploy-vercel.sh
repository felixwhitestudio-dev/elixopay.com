#!/bin/bash
# สคริปต์นี้จะ push โค้ดไปที่ GitHub branch main เพื่อให้ Vercel deploy อัตโนมัติ

# 1. เพิ่มไฟล์ทั้งหมดที่เปลี่ยนแปลง
cd /Users/felixonthecloud/Elixopay

git add .

# 2. commit พร้อมข้อความ timestamp
now=$(date '+%Y-%m-%d %H:%M:%S')
git commit -m "Auto deploy: $now"

# 3. push ไปที่ branch main
# (ถ้าใช้ branch อื่น เช่น production ให้เปลี่ยน main เป็นชื่อ branch นั้น)
git push origin main

echo "โค้ดถูก push ไปที่ GitHub แล้ว รอ Vercel deploy อัตโนมัติได้เลย!"