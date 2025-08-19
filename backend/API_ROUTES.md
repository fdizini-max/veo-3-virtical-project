# API Routes Documentation

## 🚀 **Backend API Structure Complete**

Your Vertical Veo 3 tool now has a complete API structure with all the routes you requested:

## 📋 **Core API Endpoints**

### **Generation Routes (`/api/v1/generate`)**

#### **POST /api/generate** - Create new video generation job
```typescript
// Request Body:
{
  prompt: string;           // Video description (required)
  mode: 'VERTICAL' | 'HORIZONTAL'; // Default: 'VERTICAL'
  duration?: number;        // 1-10 seconds, default: 5
  fps?: number;            // 24 or 30, default: 30
  resolution?: string;     // Default: '1920x1080'
  backgroundMode?: string; // Default: 'MINIMAL_GRADIENT'
  useFastModel?: boolean;  // Default: false
}

// Optional file upload:
referenceImage: File     // Reference image for image-to-video

// Response:
{
  id: string;             // Job ID
  status: 'PENDING';      // Job status
  type: 'GENERATE';       // Job type
  mode: 'VERTICAL' | 'HORIZONTAL';
  prompt: string;
  progress: number;       // 0-100
  estimatedWaitTime: number; // seconds
  queuePosition: number;
  metadata: object;
  createdAt: string;
}
```

#### **GET /api/generate/:id** - Get job status
```typescript
// Response:
{
  id: string;
  type: 'GENERATE' | 'EXPORT';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  mode: 'VERTICAL' | 'HORIZONTAL';
  prompt?: string;
  progress: number;       // 0-100
  inputFile?: string;
  outputFile?: string;
  errorMessage?: string;
  metadata: object;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // Queue information (if still processing)
  queueStatus?: string;
  queueProgress?: number;
  estimatedTimeRemaining?: number;
  
  // Generation details (if completed)
  generation?: {
    id: string;
    veoOperationId?: string;
    outputMedia?: {
      id: string;
      filename: string;
      publicUrl: string;
      thumbnailUrl?: string;
      duration: number;
      width: number;
      height: number;
    };
  };
}
```

#### **POST /api/generate/:id/export** - Export video
```typescript
// Request Body:
{
  exportType: 'METADATA_ROTATE' | 'GUARANTEED_UPRIGHT' | 'HORIZONTAL' | 'SCALE_PAD';
  resolution?: string;    // Default: '1080x1920' for vertical
  fps?: number;          // Default: 30
  preset?: string;       // 'TikTok', 'Reels', 'Shorts', 'Custom'
  cropX?: number;        // Crop offset X
  cropY?: number;        // Crop offset Y
}

// Response:
{
  id: string;            // Export job ID
  type: 'EXPORT';
  status: 'PENDING';
  originalJobId: string; // Original generation job ID
  exportType: string;
  resolution: string;
  fps: number;
  preset?: string;
  progress: number;
  metadata: object;
  createdAt: string;
}
```

### **Upload Routes (`/api/v1/upload`)**

#### **POST /api/upload** - Handle file uploads
```typescript
// Multipart form data:
file: File              // The file to upload (required)
type?: 'image' | 'video'; // Default: 'image'
purpose?: 'reference' | 'import' | 'avatar' | 'thumbnail'; // Default: 'reference'
description?: string;   // Optional description
tags?: string[];       // Optional tags (JSON array)

// Response:
{
  id: string;           // Media ID
  filename: string;     // Stored filename
  originalName: string; // Original filename
  mimeType: string;
  fileSize: number;     // Bytes
  publicUrl: string;    // Public access URL
  storageType: string;  // 'LOCAL' | 'GCS'
  status: 'READY';
  type: 'image' | 'video';
  purpose: string;
  uploadedAt: string;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    fileInfo: object;
  };
}
```

#### **GET /api/upload/:id** - Get uploaded file information
```typescript
// Response:
{
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  publicUrl: string;
  thumbnailUrl?: string;
  storageType: string;
  status: string;
  
  // Video metadata (if applicable)
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  hasAudio?: boolean;
  
  uploadedAt: string;
  updatedAt: string;
}
```

#### **DELETE /api/upload/:id** - Delete uploaded file
```typescript
// Response:
{
  message: 'File deleted successfully';
  mediaId: string;
}
```

#### **POST /api/upload/batch** - Handle multiple file uploads
```typescript
// Multipart form data:
files: File[]          // Array of files (max 10)

// Response:
{
  message: string;
  files: Array<{
    id: string;
    filename: string;
    originalName: string;
    publicUrl: string;
    fileSize: number;
    uploadedAt: string;
  }>;
  summary: {
    totalFiles: number;
    totalSize: number;
    successCount: number;
    failedCount: number;
  };
}
```

## 🔧 **Additional Helper Endpoints**

### **Job Management**

#### **DELETE /api/generate/:id** - Cancel job
```typescript
// Response:
{
  message: 'Job cancelled successfully';
  jobId: string;
}
```

#### **POST /api/generate/:id/retry** - Retry failed job
```typescript
// Response:
{
  message: 'Job queued for retry';
  jobId: string;
  status: 'PENDING';
}
```

#### **GET /api/generate** - List user's jobs
```typescript
// Query parameters:
?page=1&limit=20&status=COMPLETED&type=GENERATE&mode=VERTICAL

// Response:
{
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

### **Upload Management**

#### **GET /api/upload/limits** - Get upload limits
```typescript
// Response:
{
  maxFileSize: number;    // MB
  maxFiles: number;       // Total files per user
  allowedImageTypes: string[];
  allowedVideoTypes: string[];
  maxImageDimensions: { width: number; height: number };
  minImageDimensions: { width: number; height: number };
  maxVideoDuration: number; // seconds
  storageQuota: {
    used: number;         // MB used
    limit: number;        // MB limit
    unit: 'MB';
  };
}
```

#### **GET /api/upload/user/:userId** - Get user's uploaded files
```typescript
// Query parameters:
?page=1&limit=20&type=image&purpose=reference

// Response:
{
  files: Media[];
  pagination: PaginationInfo;
}
```

#### **POST /api/upload/:id/generate-thumbnail** - Generate video thumbnail
```typescript
// Response:
{
  message: 'Thumbnail generation started';
  mediaId: string;
  status: 'processing';
}
```

## 🎯 **Your Job Model Integration**

The API routes are built around your Job model specification:

```prisma
model Job {
  id          String   @id @default(cuid())
  type        JobType  // GENERATE, EXPORT
  status      Status   // PENDING, PROCESSING, COMPLETED, FAILED
  prompt      String?
  mode        Mode     // VERTICAL, HORIZONTAL
  inputFile   String?
  outputFile  String?
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

✅ **All your requested endpoints are implemented:**
- ✅ `POST /api/generate` - Create new video generation job
- ✅ `GET /api/generate/:id` - Get job status  
- ✅ `POST /api/generate/:id/export` - Export video
- ✅ `POST /api/upload` - Handle file uploads

## 🚀 **Usage Examples**

### **Create Generation Job**
```bash
curl -X POST http://localhost:3001/api/v1/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A chef cooking pasta in a modern kitchen",
    "mode": "VERTICAL",
    "duration": 5,
    "backgroundMode": "MINIMAL_GRADIENT"
  }'
```

### **Upload Reference Image**
```bash
curl -X POST http://localhost:3001/api/v1/upload \
  -F "file=@image.jpg" \
  -F "type=image" \
  -F "purpose=reference"
```

### **Check Job Status**
```bash
curl http://localhost:3001/api/v1/generate/job_123
```

### **Export Video**
```bash
curl -X POST http://localhost:3001/api/v1/generate/job_123/export \
  -H "Content-Type: application/json" \
  -d '{
    "exportType": "GUARANTEED_UPRIGHT",
    "resolution": "1080x1920",
    "preset": "TikTok"
  }'
```

## 🔒 **Security Features**

- ✅ **File Type Validation**: Only allowed file types can be uploaded
- ✅ **Size Limits**: Configurable file size limits
- ✅ **Request Validation**: Zod schema validation for all inputs
- ✅ **Error Handling**: Comprehensive error responses
- ✅ **Cleanup**: Automatic temp file cleanup
- ✅ **Logging**: Full request/response logging

## 📊 **Integration Points**

- ✅ **Database**: All routes integrate with your Job model
- ✅ **Queue System**: Generation jobs are added to BullMQ
- ✅ **Storage**: Files are stored via the storage service
- ✅ **Logging**: Comprehensive logging for monitoring
- ✅ **Validation**: Input validation and file checking

Your backend API structure is now **complete and production-ready**! 🎉
