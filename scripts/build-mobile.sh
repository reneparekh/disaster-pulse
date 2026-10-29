#!/bin/bash
if [ -z "$VITE_API_BASE_URL" ]; then
  echo "Error: VITE_API_BASE_URL not set"
  echo "Usage: VITE_API_BASE_URL=https://your-backend-url.com ./scripts/build-mobile.sh"
  exit 1
fi

echo "Building with API: $VITE_API_BASE_URL"
echo "VITE_API_BASE_URL=$VITE_API_BASE_URL" > .env.production
npm run build
npx cap sync
echo "Done! Run 'npx cap open android' or 'npx cap open ios'"
