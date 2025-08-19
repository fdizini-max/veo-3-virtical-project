# Infrastructure Setup Guide - Google Cloud Focus

## 🚀 **Infrastructure Components**

Your Vertical Veo 3 tool is configured to use Google Cloud Platform services:

### **1. FFmpeg (Video Processing)**
- **Purpose**: Video transcoding, rotation, and format conversion
- **Requirements**: FFmpeg binary installed on server
- **Configuration**: `FFMPEG_PATH`, `FFMPEG_THREADS`, `FFMPEG_TIMEOUT`

### **2. Google Cloud Storage (File Storage)**
- **Purpose**: Primary storage for generated videos and uploads
- **Features**: Scalable, CDN-ready, signed URLs for security
- **Configuration**: GCP credentials and GCS bucket

### **3. Google Cloud SQL (Database)**
- **Purpose**: PostgreSQL database for application data
- **Features**: Managed, scalable, automated backups
- **Configuration**: Connection string and credentials

### **4. Gemini API (Veo 3 Integration)**
- **Purpose**: AI video generation through Google's Veo 3 model
- **Model**: `gemini-2.5-flash-lite` as configured [[memory:6319799]]
- **Features**: Text-to-video and image-to-video generation

## 🛠️ **Setup Instructions**

### **Step 1: FFmpeg Installation**

#### **Windows (Development)**
```bash
# Using Chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
# Add to PATH environment variable
```

#### **Linux (Production)**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg

# Verify installation
ffmpeg -version
```

#### **Docker (Recommended)**
```dockerfile
# Add to your Dockerfile
RUN apt-get update && apt-get install -y ffmpeg
```

### **Step 2: Google Cloud Storage Setup**

#### **Create GCS Bucket**
```bash
# Using gcloud CLI
gcloud storage buckets create gs://vertical-veo3-storage --location=us-central1

# Set bucket permissions (optional for public access)
gcloud storage buckets add-iam-policy-binding gs://vertical-veo3-storage \
  --member=allUsers --role=roles/storage.objectViewer
```

#### **Create Service Account**
```bash
# Create service account for storage access
gcloud iam service-accounts create vertical-veo3-storage \
  --description="Service account for Vertical Veo 3 storage access" \
  --display-name="Vertical Veo 3 Storage"

# Grant storage permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:vertical-veo3-storage@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Create and download key
gcloud iam service-accounts keys create ./credentials/gcs-service-account.json \
  --iam-account=vertical-veo3-storage@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### **Step 3: Google Cloud SQL Setup**

#### **Create PostgreSQL Instance**
```bash
# Create Cloud SQL instance
gcloud sql instances create vertical-veo3-db \
  --database-version=POSTGRES_15 \
  --cpu=1 \
  --memory=3.75GB \
  --storage-size=20GB \
  --region=us-central1

# Create database
gcloud sql databases create vertical_veo3 --instance=vertical-veo3-db

# Create user
gcloud sql users create veo3user --instance=vertical-veo3-db --password=your_secure_password
```

#### **Get Connection Details**
```bash
# Get connection name
gcloud sql instances describe vertical-veo3-db --format="value(connectionName)"

# Connection string format:
# postgresql://veo3user:password@/vertical_veo3?host=/cloudsql/PROJECT:REGION:INSTANCE
```

### **Step 4: Google Cloud Setup (Veo 3)**

#### **Enable APIs**
```bash
# Using gcloud CLI
gcloud services enable generativeai.googleapis.com
gcloud services enable aiplatform.googleapis.com
```

#### **Create Service Account**
```bash
# Create service account
gcloud iam service-accounts create veo3-service-account

# Grant necessary permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:veo3-service-account@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Create and download key
gcloud iam service-accounts keys create ./credentials/gcp-service-account.json \
  --iam-account=veo3-service-account@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

#### **Get Gemini API Key**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create new API key
3. Copy the key for your environment variables

## 🔧 **Environment Configuration**

### **Backend Environment Variables**
Create/update `backend/.env`:

```env
# ================================
# Google Cloud Infrastructure
# ================================

# Gemini API (Veo 3)
GEMINI_API_KEY=your_actual_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash-lite

# Google Cloud Platform
GOOGLE_CLOUD_PROJECT_ID=your-gcp-project-id
GOOGLE_CLOUD_STORAGE_BUCKET=vertical-veo3-storage
GOOGLE_APPLICATION_CREDENTIALS=./credentials/gcs-service-account.json

# Storage Configuration
STORAGE_TYPE=gcs

# FFmpeg Configuration
FFMPEG_PATH=/usr/bin/ffmpeg
FFMPEG_THREADS=4
FFMPEG_TIMEOUT=300000

# Database (Google Cloud SQL)
DATABASE_URL=postgresql://veo3user:your_password@/vertical_veo3?host=/cloudsql/PROJECT:REGION:INSTANCE
# For local development:
# DATABASE_URL=postgresql://user:password@localhost:5432/vertical_veo3

# Redis
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Security (Generated automatically)
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_12345678901234567890
SESSION_SECRET=your_session_secret_here_12345678901234567890
ENCRYPTION_KEY=your_encryption_key_for_sensitive_data_12345678901234567890
JWT_EXPIRES_IN=7d
```

## 🧪 **Testing Infrastructure**

### **Test FFmpeg**
```bash
# Test FFmpeg installation
ffmpeg -version

# Test video processing
ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 test.mp4
```

### **Test AWS S3**
```bash
# Test S3 access
aws s3 ls s3://vertical-veo3-storage

# Test upload
echo "test" > test.txt
aws s3 cp test.txt s3://vertical-veo3-storage/
```

### **Test Gemini API**
```bash
# Test API key (using curl)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"prompt":"test"}' \
  https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
```

## 🐳 **Docker Setup**

### **Development with Docker Compose**
```yaml
# docker-compose.yml already includes:
services:
  postgres:    # Database
  redis:       # Queue system
  minio:       # S3-compatible local storage (dev)
  backend:     # API server
  frontend:    # Next.js app
```

### **Production Dockerfile**
```dockerfile
# backend/Dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Copy app
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
```

## 📊 **Monitoring & Health Checks**

### **Infrastructure Health Endpoints**
- **API Health**: `GET /api/v1/health`
- **Storage Test**: `POST /api/v1/test/storage`
- **FFmpeg Test**: `POST /api/v1/test/ffmpeg`
- **Veo 3 Test**: `POST /api/v1/test/veo3`

### **Monitoring Setup**
```javascript
// Health check implementation
app.get('/api/v1/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await testDatabase(),
      redis: await testRedis(),
      storage: await testStorage(),
      ffmpeg: await testFFmpeg(),
      veo3: await testVeo3(),
    }
  };
  
  const isHealthy = Object.values(health.services).every(status => status === 'healthy');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

## 💰 **Cost Optimization**

### **AWS S3 Costs**
- Use S3 Intelligent Tiering for automatic cost optimization
- Set up lifecycle policies to delete old files
- Use CloudFront CDN for better performance and lower costs

### **Gemini API Costs**
- Monitor usage through Google Cloud Console
- Use Veo 3 Fast model for development/testing
- Implement rate limiting to control costs

### **FFmpeg Optimization**
- Use appropriate CRF values (18-23 for good quality)
- Choose efficient presets (medium for balance)
- Implement queue concurrency limits

## 🔒 **Security Best Practices**

### **API Keys**
- Use environment variables, never commit keys
- Rotate keys regularly
- Use different keys for different environments

### **S3 Security**
- Use IAM roles instead of access keys when possible
- Enable S3 bucket versioning and logging
- Use signed URLs for temporary access

### **Network Security**
- Use HTTPS/TLS for all communications
- Implement rate limiting and DDoS protection
- Use VPC for production deployments

## 🚀 **Deployment Checklist**

### **Pre-deployment**
- [ ] FFmpeg installed and tested
- [ ] AWS S3 bucket created and configured
- [ ] Gemini API key obtained and tested
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Redis server running

### **Production Deployment**
- [ ] Use production-grade database (RDS)
- [ ] Use managed Redis (ElastiCache)
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategies
- [ ] Set up CI/CD pipeline
- [ ] Configure load balancing

Your infrastructure is now ready to support the full Vertical Veo 3 video generation pipeline! 🎬
