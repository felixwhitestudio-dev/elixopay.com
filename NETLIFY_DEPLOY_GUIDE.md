# 🚀 Netlify Deployment Guide for Elixopay

## Current Issue: Site Not Found
Your site shows "Site not found" because either:
1. The site hasn't been deployed to Netlify yet
2. The custom domain isn't properly connected

## Step-by-Step Deployment Instructions

### Option 1: Deploy via Netlify Dashboard (Easiest)

1. **Go to Netlify**
   - Visit https://app.netlify.com/
   - Sign in with your GitHub account

2. **Create New Site**
   - Click "Add new site" > "Import an existing project"
   - Choose "Deploy with GitHub"
   - Select repository: `felixwhitestudio-dev/elixopay.com`

3. **Configure Build Settings**
   ```
   Build command: (leave empty)
   Publish directory: .
   ```
   - Click "Deploy site"

4. **Add Custom Domain**
   - Go to **Site settings** > **Domain management**
   - Click "Add custom domain"
   - Enter: `elixopay.com`
   - Follow DNS configuration instructions

### Option 2: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
netlify deploy --prod
```

## DNS Configuration for elixopay.com

You need to configure DNS at your domain registrar:

### A Record (for root domain)
```
Type: A
Name: @
Value: 75.2.60.5
```

### CNAME Record (for www)
```
Type: CNAME
Name: www
Value: [your-netlify-site-name].netlify.app
```

### Alternative: Use Netlify DNS
Transfer your domain's DNS to Netlify for automatic configuration.

## Verification Steps

After deployment and DNS setup:

1. **Check Netlify Dashboard**
   - Ensure site status shows "Published"
   - Check domain status shows "Primary domain configured"

2. **Test URLs**
   - https://elixopay.com (should work)
   - https://www.elixopay.com (should work)
   - https://[your-site].netlify.app (should work)

3. **Wait for DNS Propagation**
   - DNS changes can take 24-48 hours
   - Check status: https://dnschecker.org/

## Quick Deploy Button

Add this to your README.md:

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/felixwhitestudio-dev/elixopay.com)

## Troubleshooting

### "Site not found" error
- **Cause**: Site not deployed or domain not connected
- **Fix**: Complete deployment steps above

### "Page not found" for specific pages
- **Cause**: Missing redirect rules
- **Fix**: Already configured in `netlify.toml`

### SSL Certificate issues
- **Cause**: DNS not propagated or misconfigured
- **Fix**: Wait 24-48 hours, verify DNS settings

### Mixed content warnings
- **Cause**: HTTP resources on HTTPS page
- **Fix**: Ensure all resources use HTTPS

## Environment Variables

Set these in Netlify Dashboard > Site settings > Environment variables:

```
NODE_ENV=production
```

## Continuous Deployment

Once connected:
- Every push to `main` branch = automatic deployment
- Pull requests = deploy previews
- Rollback available in Netlify dashboard

## Support

If issues persist:
1. Check Netlify deploy logs
2. Verify DNS at your registrar
3. Contact Netlify support: https://www.netlify.com/support/

---

**Next Step**: Go to https://app.netlify.com/ and follow Option 1 above! 🚀
