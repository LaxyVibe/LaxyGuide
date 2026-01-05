# Firebase Deployment Guide

## Overview
This project is deployed on Firebase, using Firebase Hosting for the frontend and Firebase Functions (Cloud Run) for backend services.

## Live URLs

- **Production Site**: https://laxy-guide-dev.web.app
- **CMS Admin**: https://laxy-guide-dev.web.app/laxy-admin/
- **Guide Generator**: https://laxy-guide-dev.web.app/laxy-admin/guide-generator.html

## Architecture

### Frontend
- **Framework**: React + Vite
- **Hosting**: Firebase Hosting
- **Build Output**: `dist/`

### Backend Functions
- **PDF Processing**: `processPdfVertex` - AI-powered guide generation from PDFs
- **Authentication**: `auth` - GitHub OAuth for Decap CMS
- **Runtime**: Node.js 20
- **Platform**: Cloud Run (via Firebase Functions v2)

### Services Used
- **Vertex AI**: Gemini 2.0 Flash for content generation
- **GitHub API**: Content management via Decap CMS
- **Cloudinary**: Media storage

## Development

### Prerequisites
```bash
# Install dependencies
npm install

# Login to Firebase
firebase login
```

### Local Development
```bash
# Terminal 1: Start Firebase Functions emulator
firebase emulators:start

# Terminal 2: Start Vite dev server
npm run dev
```

Access locally:
- Frontend: http://localhost:5173
- CMS: http://localhost:5173/laxy-admin/
- Functions: http://127.0.0.1:5001/laxy-guide-dev/us-central1/

### Environment Variables

#### Functions (.env in functions/ directory)
```bash
VERTEX_AI_PROJECT_ID=laxy-guide
VERTEX_AI_LOCATION=us-central1
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
```

## Deployment

### Full Deployment
```bash
# Build frontend
npm run build

# Build functions
cd functions && npm run build && cd ..

# Deploy everything
firebase deploy
```

### Partial Deployment
```bash
# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:processPdfVertex
```

## GitHub OAuth Setup

### 1. Create OAuth App
1. Go to https://github.com/settings/developers
2. Create new OAuth App with:
   - **Homepage URL**: `https://laxy-guide-dev.web.app`
   - **Callback URL**: `https://auth-kwy6rt2iqq-uc.a.run.app`

### 2. Configure Credentials
Add to `functions/.env`:
```bash
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

## IAM Permissions

The Cloud Run service account needs Vertex AI access:
```bash
gcloud projects add-iam-policy-binding laxy-guide \
  --member="serviceAccount:434671355332-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

## Project Structure

```
.
├── functions/              # Firebase Functions
│   ├── src/
│   │   └── index.ts       # PDF processing & auth endpoints
│   └── .env               # Environment variables
├── public/                # Static assets
│   └── laxy-admin/        # CMS interface
├── src/                   # React application
├── dist/                  # Build output (hosting)
├── firebase.json          # Firebase configuration
└── .firebaserc           # Firebase project config
```

## Monitoring

### View Logs
```bash
# Real-time function logs
firebase functions:log --follow

# View in console
https://console.firebase.google.com/project/laxy-guide-dev/functions
```

### Cloud Run Metrics
View function performance:
https://console.cloud.google.com/run?project=laxy-guide-dev

## Cost Management

### Current Configuration
- **Functions timeout**: 540s (9 minutes)
- **Memory**: 2GB
- **Max instances**: 10

### Expected Costs (Blaze Plan)
- **Firebase Hosting**: Free (10GB/month)
- **Cloud Functions**: ~$0-5/month (within free tier)
- **Vertex AI**: ~$1-10/month (depends on usage)

**Total**: ~$5-15/month for moderate usage

### Free Tier Limits
- 2M function invocations/month
- 400K GB-seconds/month
- 200K CPU-seconds/month

## Troubleshooting

### Function timeout
Increase in `functions/src/index.ts`:
```typescript
export const processPdfVertex = onRequest({
  timeoutSeconds: 540,  // Adjust as needed
  memory: "2GiB",
  // ...
})
```

### CORS issues
CORS is enabled with `cors: true` in function options.

### Permission errors
Ensure service account has `roles/aiplatform.user` on the `laxy-guide` project.

### Cache issues
```bash
# Clear Firebase hosting cache
firebase hosting:channel:delete cache

# Hard refresh browser (Cmd+Shift+R)
```

## Support

- Firebase Console: https://console.firebase.google.com/project/laxy-guide-dev
- Cloud Console: https://console.cloud.google.com/home/dashboard?project=laxy-guide-dev
- Repository: https://github.com/LaxyVibe/LaxyLiteGuidePWA
