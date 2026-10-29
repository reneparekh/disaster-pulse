# Deploying DISASTER PULSE

## Backend Deployment (Required for API features)

The app needs the Express server running with `GEMINI_API_KEY` for `/api/chat`, `/api/transcribe`, and the hazards feed proxy.

### Option 1: Render (Easiest)
1. Push this repo to GitHub/GitLab
2. Go to [render.com](https://render.com) → New → Blueprint → connect repo (uses `render.yaml`)
3. Set `GEMINI_API_KEY` in environment variables
4. Deploy. Note your URL: `https://disaster-pulse-api.onrender.com`

### Option 2: Railway
1. Push repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Add env var `GEMINI_API_KEY`
4. Generate domain. Note URL.

### Option 3: Fly.io
```bash
fly launch --no-deploy
fly secrets set GEMINI_API_KEY=your_key_here
fly deploy
```

### Option 4: Google Cloud Run
```bash
gcloud run deploy disaster-pulse \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key_here,NODE_ENV=production
```

## Frontend for Web (PWA)
Deploy the built `dist/` to any static host (Vercel, Netlify, Cloudflare Pages). Point API calls to your backend by setting `VITE_API_BASE_URL`.

```bash
echo "VITE_API_BASE_URL=https://your-backend-url.com" > .env.production
npm run build
# upload dist/ to your host
```

## Mobile Apps (Android/iOS)

### Prepare build
```bash
# Set backend URL
echo "VITE_API_BASE_URL=https://your-backend-url.com" > .env.production
npm run build
npx cap sync
```

### Android (Google Play)
```bash
npx cap open android
```
In Android Studio: Build → Generate Signed Bundle/APK → Android App Bundle (.aab). Upload to [Google Play Console](https://play.google.com/console).

### iOS (App Store)
```bash
npx cap open ios
```
In Xcode: set signing team, bundle ID `org.disasterpulse.app`. Product → Archive → Distribute to App Store Connect. Submit for review.

## PWA Install (No Store)
1. Deploy web app to HTTPS
2. Android Chrome: Menu → Install app
3. iOS Safari: Share → Add to Home Screen
