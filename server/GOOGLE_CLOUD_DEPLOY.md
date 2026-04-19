# ============================================
# Elixopay — Google Cloud Deployment Guide
# ============================================

## สำหรับ Deploy ครั้งแรก

### 1. ติดตั้ง Google Cloud CLI
```bash
# macOS
brew install google-cloud-sdk

# หรือดาวน์โหลดจาก https://cloud.google.com/sdk/docs/install
```

### 2. Login และตั้ง Project
```bash
gcloud auth login
gcloud config set project elixopay-production
gcloud config set compute/region asia-southeast1  # Bangkok region
```

### 3. เปิด APIs ที่จำเป็น
```bash
gcloud services enable \
    compute.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com
```

### 4. สร้าง Cloud SQL (PostgreSQL)
```bash
# สร้าง PostgreSQL instance
gcloud sql instances create elixopay-db \
    --database-version=POSTGRES_15 \
    --tier=db-custom-2-8192 \
    --region=asia-southeast1 \
    --storage-size=20GB \
    --storage-auto-increase \
    --backup-start-time=03:00 \
    --availability-type=zonal

# สร้าง Database
gcloud sql databases create elixopay --instance=elixopay-db

# สร้าง User
gcloud sql users create elixopay \
    --instance=elixopay-db \
    --password=YOUR_SECURE_PASSWORD
```

### 5. สร้าง Redis (Memorystore)
```bash
gcloud redis instances create elixopay-cache \
    --size=1 \
    --region=asia-southeast1 \
    --redis-version=redis_7_0 \
    --tier=basic
```

### 6. สร้าง Artifact Registry (Docker images)
```bash
gcloud artifacts repositories create elixopay \
    --repository-format=docker \
    --location=asia-southeast1 \
    --description="Elixopay API Docker images"
```

### 7. Build & Push Docker Image
```bash
# Configure Docker for Google Cloud
gcloud auth configure-docker asia-southeast1-docker.pkg.dev

# Build image
cd server
docker build -t asia-southeast1-docker.pkg.dev/elixopay-production/elixopay/api:latest .

# Push to Artifact Registry
docker push asia-southeast1-docker.pkg.dev/elixopay-production/elixopay/api:latest
```

### 8. Deploy to Cloud Run
```bash
gcloud run deploy elixopay-api \
    --image=asia-southeast1-docker.pkg.dev/elixopay-production/elixopay/api:latest \
    --region=asia-southeast1 \
    --platform=managed \
    --port=3000 \
    --memory=2Gi \
    --cpu=2 \
    --min-instances=1 \
    --max-instances=5 \
    --set-env-vars="NODE_ENV=production" \
    --set-secrets="DATABASE_URL=elixopay-db-url:latest,JWT_SECRET=elixopay-jwt-secret:latest" \
    --allow-unauthenticated \
    --add-cloudsql-instances=elixopay-production:asia-southeast1:elixopay-db
```

### 9. ตั้ง Custom Domain
```bash
gcloud run domain-mappings create \
    --service=elixopay-api \
    --domain=api.elixopay.com \
    --region=asia-southeast1
```

### 10. Run Database Migrations
```bash
# Connect to Cloud SQL via proxy
gcloud sql connect elixopay-db --user=elixopay

# หรือใช้ Cloud SQL Proxy
cloud-sql-proxy elixopay-production:asia-southeast1:elixopay-db &

# Run Prisma migrate
DATABASE_URL="postgresql://elixopay:PASSWORD@localhost:5432/elixopay" npx prisma migrate deploy
```

---

## สำหรับ Deploy อัปเดท (ครั้งต่อๆ ไป)

```bash
# Build ใหม่
cd server
docker build -t asia-southeast1-docker.pkg.dev/elixopay-production/elixopay/api:latest .

# Push
docker push asia-southeast1-docker.pkg.dev/elixopay-production/elixopay/api:latest

# Deploy อัปเดท
gcloud run deploy elixopay-api \
    --image=asia-southeast1-docker.pkg.dev/elixopay-production/elixopay/api:latest \
    --region=asia-southeast1
```
