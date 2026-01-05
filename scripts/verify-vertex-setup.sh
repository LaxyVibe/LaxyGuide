#!/bin/bash

# Vertex AI Setup Verification Script

echo "🔍 Verifying Vertex AI Setup"
echo "============================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install it first."
    exit 1
fi
echo "✅ gcloud CLI installed"

# Check project
PROJECT_ID="laxy-guide"
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "⚠️  Current project: $CURRENT_PROJECT (expected: $PROJECT_ID)"
    echo "   Run: gcloud config set project $PROJECT_ID"
else
    echo "✅ Correct project: $PROJECT_ID"
fi

# Check if APIs are enabled
echo ""
echo "📦 Checking APIs..."

check_api() {
    SERVICE=$1
    NAME=$2
    if gcloud services list --enabled --filter="name:$SERVICE" --format="value(name)" 2>/dev/null | grep -q "$SERVICE"; then
        echo "✅ $NAME enabled"
    else
        echo "❌ $NAME not enabled"
        echo "   Run: gcloud services enable $SERVICE"
    fi
}

check_api "aiplatform.googleapis.com" "Vertex AI API"
check_api "storage.googleapis.com" "Cloud Storage API"
check_api "iam.googleapis.com" "IAM API"

# Check service account
echo ""
echo "👤 Checking service account..."
SERVICE_ACCOUNT="vertex-ai-guide-generator@${PROJECT_ID}.iam.gserviceaccount.com"
if gcloud iam service-accounts describe $SERVICE_ACCOUNT &>/dev/null; then
    echo "✅ Service account exists: $SERVICE_ACCOUNT"
else
    echo "❌ Service account not found: $SERVICE_ACCOUNT"
    echo "   Run: ./scripts/setup-gcloud-vertex.sh"
fi

# Check key file
echo ""
echo "🔑 Checking key file..."
if [ -f "vertex-ai-key.json" ]; then
    echo "✅ Key file found: vertex-ai-key.json"
    echo "   ⚠️  Make sure this file is NOT committed to git"
else
    echo "❌ Key file not found: vertex-ai-key.json"
    echo "   Run: ./scripts/setup-gcloud-vertex.sh"
fi

# Check environment variables
echo ""
echo "🌍 Checking environment variables..."
if [ -f ".env" ]; then
    if grep -q "VERTEX_AI_PROJECT_ID" .env; then
        echo "✅ VERTEX_AI_PROJECT_ID found in .env"
    else
        echo "⚠️  VERTEX_AI_PROJECT_ID not found in .env"
    fi
    
    if grep -q "VERTEX_AI_LOCATION" .env; then
        echo "✅ VERTEX_AI_LOCATION found in .env"
    else
        echo "⚠️  VERTEX_AI_LOCATION not found in .env"
    fi
    
    if grep -q "VERTEX_AI_SERVICE_ACCOUNT_KEY" .env; then
        echo "✅ VERTEX_AI_SERVICE_ACCOUNT_KEY found in .env"
    else
        echo "⚠️  VERTEX_AI_SERVICE_ACCOUNT_KEY not found in .env"
    fi
else
    echo "⚠️  .env file not found"
    echo "   Create one with required environment variables"
fi

# Check package.json
echo ""
echo "📦 Checking dependencies..."
if grep -q "@google-cloud/vertexai" package.json; then
    echo "✅ @google-cloud/vertexai in package.json"
else
    echo "❌ @google-cloud/vertexai not in package.json"
    echo "   Run: npm install @google-cloud/vertexai"
fi

# Check if node_modules installed
if [ -d "node_modules/@google-cloud/vertexai" ]; then
    echo "✅ @google-cloud/vertexai installed"
else
    echo "⚠️  @google-cloud/vertexai not installed"
    echo "   Run: npm install"
fi

# Check Netlify function
echo ""
echo "⚡ Checking Netlify function..."
if [ -f "netlify/functions/process-pdf-vertex.cjs" ]; then
    echo "✅ Netlify function exists"
else
    echo "❌ Netlify function not found"
fi

echo ""
echo "============================="
echo "🎉 Verification Complete!"
echo ""
echo "Next steps:"
echo "1. If any checks failed, run: ./scripts/setup-gcloud-vertex.sh"
echo "2. Make sure to set Netlify environment variables for production"
echo "3. Test locally with: netlify dev"
echo ""
