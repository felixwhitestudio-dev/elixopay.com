# 🚂 Deploy Elixopay Backend to Railway.app

## 📋 Pre-requisites

1. GitHub account
2. Railway.app account (free tier available)
3. Git initialized in your project

## 🚀 Deployment Steps

### 1. Push Code to GitHub

```bash
cd /Users/felixonthecloud/Elixopay/backend
git init
git add .
git commit -m "Initial backend setup for Railway deployment"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Deploy to Railway

1. Go to [Railway.app](https://railway.app)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Choose your `Elixopay/backend` repository
5. Railway will auto-detect Node.js and deploy

### 3. Configure Environment Variables

In Railway Dashboard > Your Project > Variables, add:

```env
NODE_ENV=production
PORT=3000
API_VERSION=v1

# JWT Secrets (Generate random strings)
JWT_SECRET=<generate-random-32-char-string>
JWT_REFRESH_SECRET=<generate-random-32-char-string>

# Frontend URL (Update after deploying frontend)
FRONTEND_URL=https://elixopay.vercel.app

# Database (Optional - Railway PostgreSQL)
# If you add PostgreSQL service, Railway auto-injects these:
# PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
```

#### 🔐 Generate Secure JWT Secrets:

```bash
# Run in terminal to generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Get Your Railway URL

After deployment, Railway provides a URL like:
```
https://elixopay-production.up.railway.app
```

Copy this URL - you'll need it for frontend configuration.

### 5. Update Frontend Configuration

Update `/js/api-config.js` in your frontend:

```javascript
const PROD_BASE = 'https://your-railway-url.up.railway.app';
```

### 6. Test Your Deployment

Test health endpoint:
```bash
curl https://your-railway-url.up.railway.app/health
```

Test login:
```bash
curl -X POST https://your-railway-url.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@elixopay.com","password":"demo123"}'
```

## 🔧 Railway Configuration Files

- `Procfile` - Defines start command
- `railway.json` - Railway-specific configuration
- `.env.production` - Template for production environment variables

## 📊 Monitoring

- **Logs**: Railway Dashboard > Deployments > Logs
- **Metrics**: Railway Dashboard > Metrics
- **Health Check**: `https://your-url.up.railway.app/health`

## 🔄 Automatic Deploys

Railway automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Update backend"
git push
```

## 💡 Useful Railway Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs

# Open dashboard
railway open
```

## 🐛 Troubleshooting

### Server not starting?
- Check logs in Railway Dashboard
- Verify all environment variables are set
- Ensure `package.json` has correct start script

### CORS errors?
- Add your frontend domain to allowed origins in `server.js`
- Check `FRONTEND_URL` environment variable

### Database connection fails?
- Add PostgreSQL service in Railway
- Verify database environment variables

## 🆓 Railway Free Tier

- $5 free credit per month
- Enough for small projects
- Automatic SSL certificates
- Custom domains supported

## 📚 Resources

- [Railway Documentation](https://docs.railway.app)
- [Railway Node.js Guide](https://docs.railway.app/guides/nodejs)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] Environment variables configured
- [ ] JWT secrets generated
- [ ] Health endpoint working
- [ ] Login endpoint tested
- [ ] Frontend URL updated
- [ ] Custom domain configured (optional)

---

## 🎉 You're all set!

Your backend is now running on Railway.app with:
- ✅ Auto-scaling
- ✅ Free SSL
- ✅ Automatic deployments
- ✅ Built-in monitoring
