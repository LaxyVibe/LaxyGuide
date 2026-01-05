# Vertex AI PDF Processing Setup

This guide explains how to set up Google Cloud Vertex AI for automated guide generation from PDFs.

## Prerequisites

- Google Cloud CLI (`gcloud`) installed
- Access to Google Cloud project: `laxy-guide` (Project ID)
- Project Number: `683838849728`

## Setup Steps

### 1. Run the Setup Script

```bash
chmod +x scripts/setup-gcloud-vertex.sh
./scripts/setup-gcloud-vertex.sh
```

This script will:
- Enable required Google Cloud APIs (Vertex AI, Storage, IAM)
- Create a service account for Vertex AI
- Grant necessary permissions
- Generate a service account key file (`vertex-ai-key.json`)

### 2. Install Dependencies

```bash
npm install
```

This will install the `@google-cloud/vertexai` package.

### 3. Configure Environment Variables

#### For Local Development (.env):

Create a `.env` file in the project root (this file is gitignored):

```env
VERTEX_AI_PROJECT_ID=laxy-guide
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_SERVICE_ACCOUNT_KEY=<paste the entire content of vertex-ai-key.json as a single line JSON string>
```

To convert the key file to a single line:
```bash
cat vertex-ai-key.json | jq -c
```

#### For Netlify Deployment:

Go to Netlify Dashboard → Site Settings → Environment Variables and add:

1. `VERTEX_AI_PROJECT_ID` = `laxy-guide`
2. `VERTEX_AI_LOCATION` = `us-central1`
3. `VERTEX_AI_SERVICE_ACCOUNT_KEY` = `<paste vertex-ai-key.json content as single-line JSON>`

### 4. Secure the Key File

⚠️ **IMPORTANT**: The `vertex-ai-key.json` file contains sensitive credentials.

- DO NOT commit it to git (already in .gitignore)
- Store it securely (password manager, secrets vault)
- Rotate keys periodically for security

## How It Works

### User Flow:

1. **Upload PDF**: User uploads a tour guide/museum PDF document
2. **AI Analysis**: PDF is sent to Vertex AI (Gemini 1.5 Pro)
3. **Content Generation**: AI extracts key points and generates:
   - Guide titles in 6 languages (en-US, ja-JP, ko-KR, zh-TW, zh-CN, fr-FR)
   - POI titles in all languages
   - Detailed markdown content for each POI in all languages
4. **Form Population**: Generated content auto-fills the form
5. **Review & Submit**: User reviews/edits and submits to GitHub

### Architecture:

```
PDF Upload (Browser)
    ↓
Netlify Function (process-pdf-vertex.cjs)
    ↓
Vertex AI API (Gemini 1.5 Pro)
    ↓
JSON Response with Multilingual Content
    ↓
Form Auto-Population (Browser)
```

### API Details:

- **Model**: `gemini-1.5-pro`
- **Location**: `us-central1`
- **Input**: PDF file (base64 encoded) + instructions
- **Output**: Structured JSON with multilingual guide content

## Testing

### Local Testing:

```bash
netlify dev
```

Then navigate to `http://localhost:8888/laxy-admin/guide-generator.html`

### Test PDF Upload:

1. Enter a guide code (e.g., `TEST-MUSEUM-001`)
2. Upload a PDF file
3. Set number of POIs to generate
4. Click "Generate with AI"
5. Wait for processing (30-60 seconds)
6. Review generated content

## Troubleshooting

### "Invalid service account configuration"

- Check that `VERTEX_AI_SERVICE_ACCOUNT_KEY` is valid JSON
- Ensure there are no line breaks in the environment variable
- Verify the key hasn't expired

### "Failed to process PDF with Vertex AI"

- Check Google Cloud console for API quota limits
- Verify Vertex AI API is enabled
- Check service account has `roles/aiplatform.user` role

### PDF Processing Takes Too Long

- Gemini 1.5 Pro can take 30-60 seconds for large PDFs
- This is normal for multimodal AI processing
- Consider reducing the number of POIs requested

## Cost Considerations

Vertex AI pricing (as of 2024):
- Gemini 1.5 Pro: ~$0.035 per 1000 input tokens
- Average PDF processing: $0.10 - $0.50 per request

Monitor usage in Google Cloud Console → Billing

## Security Best Practices

1. **Rotate Keys**: Rotate service account keys every 90 days
2. **Least Privilege**: Only grant minimum required permissions
3. **Monitor Usage**: Set up billing alerts
4. **Audit Logs**: Enable Cloud Audit Logs for AI Platform

## Support

For issues:
1. Check Google Cloud Console logs
2. Review Netlify function logs
3. Check browser console for errors

## References

- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Gemini API Reference](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Service Account Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts)
