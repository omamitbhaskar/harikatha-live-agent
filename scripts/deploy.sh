#!/bin/bash
# deploy.sh — Deploy Harikatha Live Agent to Cloud Run
# Usage: ./scripts/deploy.sh

set -e

PROJECT_ID="harikatha-live-agent"
REGION="us-central1"
SERVICE_NAME="harikatha-live-agent"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "══════════════════════════════════════════"
echo "  Harikatha Live Agent — Deploy to Cloud Run"
echo "══════════════════════════════════════════"

# 1. Set project
echo "→ Setting project to ${PROJECT_ID}"
gcloud config set project ${PROJECT_ID}

# 2. Build container
echo "→ Building container image..."
gcloud builds submit --tag ${IMAGE} --timeout=600

# 3. Deploy to Cloud Run
echo "→ Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE} \
    --region ${REGION} \
    --platform managed \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --max-instances 3 \
    --set-env-vars "GCP_PROJECT=${PROJECT_ID}" \
    --set-env-vars "GOOGLE_API_KEY=$(gcloud secrets versions access latest --secret=gemini-api-key 2>/dev/null || echo '')"

echo ""
echo "✅ Deployed!"
echo "→ URL: https://${SERVICE_NAME}-862707561519.${REGION}.run.app"
echo ""
echo "If GOOGLE_API_KEY is empty above, set it manually:"
echo "  gcloud run services update ${SERVICE_NAME} \\"
echo "    --region ${REGION} \\"
echo "    --set-env-vars GOOGLE_API_KEY=your-key-here"
