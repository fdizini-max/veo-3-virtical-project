#!/bin/bash

# Google Cloud Setup Script for Vertical Veo 3 Tool
# This script sets up Google Cloud infrastructure

set -e

echo "🚀 Setting up Google Cloud infrastructure for Vertical Veo 3..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ No default project set. Please run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "📋 Using project: $PROJECT_ID"

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable generativeai.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable sqladmin.googleapis.com

# Create storage bucket
BUCKET_NAME="vertical-veo3-storage-$(date +%s)"
echo "📦 Creating storage bucket: $BUCKET_NAME"
gcloud storage buckets create gs://$BUCKET_NAME --location=us-central1

# Create service account for storage
echo "🔐 Creating service account..."
gcloud iam service-accounts create vertical-veo3-storage \
  --description="Service account for Vertical Veo 3 storage access" \
  --display-name="Vertical Veo 3 Storage" || true

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:vertical-veo3-storage@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create credentials directory
mkdir -p ../backend/credentials

# Create and download service account key
echo "🗝️  Creating service account key..."
gcloud iam service-accounts keys create ../backend/credentials/gcs-service-account.json \
  --iam-account=vertical-veo3-storage@$PROJECT_ID.iam.gserviceaccount.com

# Create Cloud SQL instance (optional - can be expensive)
read -p "🗄️  Do you want to create a Cloud SQL instance? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating Cloud SQL instance (this may take several minutes)..."
    
    gcloud sql instances create vertical-veo3-db \
      --database-version=POSTGRES_15 \
      --cpu=1 \
      --memory=3.75GB \
      --storage-size=20GB \
      --region=us-central1 \
      --storage-auto-increase
    
    # Create database
    gcloud sql databases create vertical_veo3 --instance=vertical-veo3-db
    
    # Generate random password
    DB_PASSWORD=$(openssl rand -base64 32)
    
    # Create user
    gcloud sql users create veo3user --instance=vertical-veo3-db --password=$DB_PASSWORD
    
    # Get connection name
    CONNECTION_NAME=$(gcloud sql instances describe vertical-veo3-db --format="value(connectionName)")
    
    echo "✅ Cloud SQL instance created!"
    echo "📝 Add this to your backend/.env file:"
    echo "DATABASE_URL=postgresql://veo3user:$DB_PASSWORD@/vertical_veo3?host=/cloudsql/$CONNECTION_NAME"
    echo ""
    echo "💡 For local development, you can also use:"
    echo "   gcloud sql connect vertical-veo3-db --user=veo3user --database=vertical_veo3"
else
    echo "⏭️  Skipping Cloud SQL setup. You can use local PostgreSQL for development."
fi

echo ""
echo "✅ Google Cloud setup complete!"
echo ""
echo "📝 Update your backend/.env file with:"
echo "GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID"
echo "GOOGLE_CLOUD_STORAGE_BUCKET=$BUCKET_NAME"
echo "GOOGLE_APPLICATION_CREDENTIALS=./credentials/gcs-service-account.json"
echo "STORAGE_TYPE=gcs"
echo ""
echo "🔑 Don't forget to add your Gemini API key:"
echo "GEMINI_API_KEY=your_actual_gemini_api_key"
echo ""
echo "🎉 Ready to start generating vertical videos!"
