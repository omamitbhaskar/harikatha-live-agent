#!/bin/bash
# upload_media_to_gcs.sh — Upload harikatha media to Google Cloud Storage
# Usage: ./scripts/upload_media_to_gcs.sh
#
# This script:
# 1. Creates a GCS bucket (if not exists)
# 2. Uploads MP3 and MP4 files from frontend/
# 3. Makes them publicly readable
# 4. Prints the public URLs

set -e

PROJECT_ID="harikatha-live-agent"
BUCKET_NAME="${PROJECT_ID}-media"
REGION="us-central1"

echo "══════════════════════════════════════════"
echo "  Upload Harikatha Media to Cloud Storage"
echo "══════════════════════════════════════════"

# 1. Set project
echo "→ Setting project to ${PROJECT_ID}"
gcloud config set project ${PROJECT_ID}

# 2. Create bucket (if not exists)
echo "→ Creating bucket gs://${BUCKET_NAME} (if not exists)..."
gcloud storage buckets create gs://${BUCKET_NAME} \
    --project=${PROJECT_ID} \
    --location=${REGION} \
    --uniform-bucket-level-access \
    2>/dev/null || echo "  Bucket already exists"

# 3. Make bucket publicly readable
echo "→ Setting public read access on bucket..."
gcloud storage buckets add-iam-policy-binding gs://${BUCKET_NAME} \
    --member=allUsers \
    --role=roles/storage.objectViewer \
    2>/dev/null || echo "  Public access already set"

# 4. Upload media files
echo "→ Uploading media files..."

# Upload MP3
if [ -f "frontend/we_are_the_cause_of_our_problems.mp3" ]; then
    echo "  Uploading MP3..."
    gcloud storage cp frontend/we_are_the_cause_of_our_problems.mp3 \
        gs://${BUCKET_NAME}/we_are_the_cause_of_our_problems.mp3
    echo "  ✅ MP3 uploaded"
else
    echo "  ⚠️ MP3 not found at frontend/we_are_the_cause_of_our_problems.mp3"
fi

# Upload MP4
if [ -f "frontend/we_are_the_cause_of_our_problems_badger_eng_subs.mp4" ]; then
    echo "  Uploading MP4..."
    gcloud storage cp frontend/we_are_the_cause_of_our_problems_badger_eng_subs.mp4 \
        gs://${BUCKET_NAME}/we_are_the_cause_of_our_problems_badger_eng_subs.mp4
    echo "  ✅ MP4 uploaded"
else
    echo "  ⚠️ MP4 not found at frontend/we_are_the_cause_of_our_problems_badger_eng_subs.mp4"
fi

# Also upload from corpus/media if exists there
if [ -f "corpus/media/we_are_the_cause_of_our_problems.mp3" ]; then
    echo "  Uploading MP3 from corpus/media..."
    gcloud storage cp corpus/media/we_are_the_cause_of_our_problems.mp3 \
        gs://${BUCKET_NAME}/we_are_the_cause_of_our_problems.mp3
fi

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Upload complete!"
echo ""
echo "  Public URLs:"
echo "  MP3: https://storage.googleapis.com/${BUCKET_NAME}/we_are_the_cause_of_our_problems.mp3"
echo "  MP4: https://storage.googleapis.com/${BUCKET_NAME}/we_are_the_cause_of_our_problems_badger_eng_subs.mp4"
echo ""
echo "  Next step: Update DEFAULT_AUDIO_URL in src/main.py to:"
echo "  https://storage.googleapis.com/${BUCKET_NAME}/we_are_the_cause_of_our_problems.mp3"
echo "══════════════════════════════════════════"
