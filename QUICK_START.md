# 🎯 Quick Start Guide

## Your Guide Generator is Ready!

### 📍 Access Points

**Guide Generator**: http://localhost:8888/laxy-admin/guide-generator.html
**Decap CMS**: http://localhost:8888/laxy-admin/

### 🤖 AI PDF Generation (3 Steps)

1. **Upload PDF** → Tourism/museum guide document
2. **Select POI Count** → How many points of interest (1-10)
3. **Generate** → AI creates multilingual content in 6 languages

### 🔧 Commands

```bash
# Start dev server
netlify dev

# Verify setup
./scripts/verify-vertex-setup.sh

# Re-run Google Cloud setup
./scripts/setup-gcloud-vertex.sh
```

### 📦 What Was Installed

- **@google-cloud/vertexai** v1.1.0
- **Google Cloud Service Account**: vertex-ai-guide-generator@laxy-guide.iam.gserviceaccount.com
- **Netlify Function**: process-pdf-vertex.cjs
- **AI Model**: Gemini 1.5 Pro

### 🌍 Supported Languages

1. English (en-US)
2. Japanese (ja-JP)
3. Korean (ko-KR)
4. Traditional Chinese (zh-TW)
5. Simplified Chinese (zh-CN)
6. French (fr-FR)

### 🚀 Production Deployment

Add to **Netlify Environment Variables**:

```
VERTEX_AI_PROJECT_ID=laxy-guide
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_SERVICE_ACCOUNT_KEY=<JSON from vertex-ai-key.json as one line>
```

Get one-line JSON:
```bash
cat vertex-ai-key.json | jq -c
```

### 📁 Files Created by Generator

```
src/content/guides/
  └── [guide-id].md

src/content/pois/
  ├── [guide-id]-001.md
  ├── [guide-id]-002.md
  └── [guide-id]-003.md
```

### ⚠️ Important

- ✅ Dev server running on http://localhost:8888
- ✅ Authentication via Decap CMS session
- ✅ All environment variables configured
- ⚠️ **Never commit** vertex-ai-key.json
- ⚠️ **Never commit** .env file

### 🆘 Need Help?

- See: `SETUP_COMPLETE.md` (detailed guide)
- See: `VERTEX_AI_SETUP.md` (technical docs)
- Run: `./scripts/verify-vertex-setup.sh`

---

**Ready to create guides!** 🎉
