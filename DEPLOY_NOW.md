# 🚀 Deploy Now: Elixopay Client Demo

Everything is configured! Follow these steps to get your demo live in 5 minutes.

## Step 1: Push Code to GitHub

You need your code on GitHub to use Vercel and Render.

```bash
# Initialize git if you haven't (run in project root)
git init
git add .
git commit -m "Ready for deploy: Configured Vercel and Render"

# Add your repository (if not already added)
# git remote add origin https://github.com/YOUR_USERNAME/elixopay.git

# Push
git push -u origin main
```

## Step 2: Deploy Backend (Render)

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository `elixopay`.
4. It will detect `render.yaml` automatically (or select **"Build from render.yaml"** if asked).
5. Click **Apply** or **Create Web Service**.
6. **Wait for it to build.** Once done, copy the URL (e.g., `https://elixopay-backend.onrender.com`).

> **Note:** Render will automatically provision a PostgreSQL database for you because of `render.yaml`.

## Step 3: Deploy Frontend (Vercel)

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import `elixopay` repository.
3. **Configure Configuration:**
   - **Framework Preset:** Other (or leave default)
   - **Root Directory:** `./`
4. **Environment Variables:**
   - Add `API_BASE_URL` with the value from Render (e.g., `https://elixopay-backend.onrender.com`).
   *Note: Our `api-config.js` is set to auto-detect, but adding this ensures clarity.*
5. Click **Deploy**.

## Step 4: Final Connect

1. Once Vercel is done, your site is live!
2. Open the Vercel URL.
3. Try logging in with:
   - Email: `demo@elixopay.com`
   - Password: `Password123`

## Troubleshooting

- **Database Error?** Check Render logs. The migration should run automatically on start.
- **Frontend can't connect?** Make sure you are using the `https` URL from Render.
