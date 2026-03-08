#!/bin/bash
set -e

PROJECT_ID="harikatha-live-agent"
REGION="us-central1"
SERVICE_NAME="harikatha-live-agent"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "=== Harikatha Live Agent — Cloud Run Deployment ==="
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"

echo ""
echo "Step 1: Setting GCP project..."
gcloud config set project $PROJECT_ID

echo ""
echo "Step 2: Building and pushing Docker image..."
gcloud builds submit --tag $IMAGE .

echo ""
echo "Step 3: Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 3

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo "Your live URL is shown above as 'Service URL'"
echo "Visit it in your browser — you should see the JSON response"