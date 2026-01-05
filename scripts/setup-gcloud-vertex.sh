#!/bin/bash

# Google Cloud Project Setup for Vertex AI
# Project ID: laxy-guide
# Project Number: 683838849728

PROJECT_ID="laxy-guide"
PROJECT_NUMBER="683838849728"

echo "🚀 Setting up Google Cloud Project: $PROJECT_ID"
echo "================================================"

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo ""
echo "📦 Enabling required APIs..."
gcloud services enable aiplatform.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
gcloud services enable iam.googleapis.com

# Create a service account for Vertex AI
SERVICE_ACCOUNT_NAME="vertex-ai-guide-generator"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo ""
echo "👤 Creating service account: $SERVICE_ACCOUNT_NAME"
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="Vertex AI Guide Generator" \
    --description="Service account for guide generator PDF processing" \
    || echo "Service account already exists"

# Grant necessary permissions
echo ""
echo "🔐 Granting permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/storage.objectViewer"

# Create service account key
KEY_FILE="vertex-ai-key.json"
echo ""
echo "🔑 Creating service account key..."
gcloud iam service-accounts keys create $KEY_FILE \
    --iam-account=$SERVICE_ACCOUNT_EMAIL

echo ""
echo "✅ Setup complete!"
echo ""
echo "================================================"
echo "📋 Configuration Summary"
echo "================================================"
echo "Project ID: $PROJECT_ID"
echo "Project Number: $PROJECT_NUMBER"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "Key File: $KEY_FILE"
echo ""
echo "⚠️  IMPORTANT: Add these to your Netlify environment variables:"
echo ""
echo "VERTEX_AI_PROJECT_ID=$PROJECT_ID"
echo "VERTEX_AI_LOCATION=us-central1"
echo "VERTEX_AI_SERVICE_ACCOUNT_KEY=<paste entire content of $KEY_FILE as one line>"
echo ""
echo "🔒 Keep the $KEY_FILE file secure and DO NOT commit it to git!"
echo "Add vertex-ai-key.json to .gitignore"
echo ""
