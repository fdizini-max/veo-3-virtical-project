# Vertical Veo 3 Tool - Project Structure

## Root Level
```
vertical-veo3-tool/
├── package.json                 # Monorepo configuration
├── .gitignore                   # Git ignore rules
├── .env.example                 # Environment variables template
├── docker-compose.yml           # Docker services configuration
├── README.md                    # Project documentation
├── PROJECT_STRUCTURE.md         # This file
├── LICENSE                      # License information
│
├── frontend/                    # Next.js frontend application
├── backend/                     # Node.js/Express backend API
├── infrastructure/              # Infrastructure configurations
├── scripts/                     # Utility scripts
└── docs/                        # Documentation
```

## Frontend Structure
```
frontend/
├── package.json
├── next.config.js               # Next.js configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── .env.local                   # Local environment variables
│
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   └── assets/
│       ├── icons/
│       └── images/
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── globals.css         # Global styles
│   │   │
│   │   ├── generate/           # Video generation page
│   │   │   ├── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── results/            # Results/preview page
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── library/            # User's video library
│   │   │   └── page.tsx
│   │   │
│   │   ├── import/             # Import existing video
│   │   │   └── page.tsx
│   │   │
│   │   └── api/                # API routes (if needed)
│   │       └── auth/
│   │
│   ├── components/
│   │   ├── providers/          # Context providers
│   │   │   ├── index.tsx
│   │   │   ├── QueryProvider.tsx
│   │   │   └── AuthProvider.tsx
│   │   │
│   │   ├── layout/             # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Navigation.tsx
│   │   │
│   │   ├── generation/         # Generation components
│   │   │   ├── GenerationForm.tsx
│   │   │   ├── PromptInput.tsx
│   │   │   ├── ImageUpload.tsx
│   │   │   ├── ModeSelector.tsx
│   │   │   └── GenerationStatus.tsx
│   │   │
│   │   ├── preview/            # Preview components
│   │   │   ├── VideoPlayer.tsx
│   │   │   ├── VerticalPreview.tsx
│   │   │   ├── PreviewControls.tsx
│   │   │   └── CropAdjuster.tsx
│   │   │
│   │   ├── export/             # Export components
│   │   │   ├── ExportOptions.tsx
│   │   │   ├── PresetSelector.tsx
│   │   │   └── ExportProgress.tsx
│   │   │
│   │   └── ui/                 # UI components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── Slider.tsx
│   │       ├── Toast.tsx
│   │       ├── Toaster.tsx
│   │       ├── Modal.tsx
│   │       ├── Card.tsx
│   │       └── Spinner.tsx
│   │
│   ├── lib/
│   │   ├── api/                # API client
│   │   │   ├── client.ts
│   │   │   ├── generation.ts
│   │   │   ├── export.ts
│   │   │   └── media.ts
│   │   │
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useGeneration.ts
│   │   │   ├── useVideoPlayer.ts
│   │   │   ├── useExport.ts
│   │   │   └── useAuth.ts
│   │   │
│   │   ├── utils/              # Utility functions
│   │   │   ├── format.ts
│   │   │   ├── validation.ts
│   │   │   └── constants.ts
│   │   │
│   │   └── store/              # State management (Zustand)
│   │       ├── generation.ts
│   │       ├── preview.ts
│   │       └── user.ts
│   │
│   └── types/
│       ├── api.ts
│       ├── generation.ts
│       └── export.ts
```

## Backend Structure
```
backend/
├── package.json
├── tsconfig.json                # TypeScript configuration
├── .env                         # Environment variables
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Database migrations
│
├── src/
│   ├── index.ts                # Application entry point
│   ├── app.ts                  # Express application setup
│   │
│   ├── config/
│   │   ├── index.ts           # Configuration loader
│   │   ├── database.ts        # Database configuration
│   │   ├── redis.ts           # Redis configuration
│   │   ├── storage.ts         # Cloud storage configuration
│   │   └── gemini.ts          # Gemini/Veo API configuration
│   │
│   ├── routes/
│   │   ├── index.ts           # Route aggregator
│   │   ├── auth.routes.ts     # Authentication routes
│   │   ├── generation.routes.ts # Video generation routes
│   │   ├── export.routes.ts   # Export routes
│   │   ├── media.routes.ts    # Media management routes
│   │   └── health.routes.ts   # Health check routes
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── generation.controller.ts
│   │   ├── export.controller.ts
│   │   └── media.controller.ts
│   │
│   ├── services/
│   │   ├── veo.service.ts     # Veo 3 API integration [[memory:5212048]]
│   │   │   └── # Handles vertical logic prompt securely
│   │   ├── ffmpeg.service.ts  # FFmpeg operations
│   │   ├── storage.service.ts # File storage
│   │   ├── prompt.service.ts  # Prompt processing [[memory:5212044]]
│   │   │   └── # Recognizes elements then applies vertical formatting
│   │   └── auth.service.ts    # Authentication
│   │
│   ├── workers/                # Background job processors
│   │   ├── index.ts
│   │   ├── generation.worker.ts
│   │   ├── export.worker.ts
│   │   └── cleanup.worker.ts
│   │
│   ├── queue/                  # Job queue management
│   │   ├── index.ts
│   │   ├── generation.queue.ts
│   │   ├── export.queue.ts
│   │   └── types.ts
│   │
│   ├── models/                 # Database models
│   │   ├── user.model.ts
│   │   ├── generation.model.ts
│   │   ├── export.model.ts
│   │   └── media.model.ts
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── rateLimiter.middleware.ts
│   │   └── upload.middleware.ts
│   │
│   ├── utils/
│   │   ├── logger.ts          # Winston logger
│   │   ├── errors.ts          # Custom error classes
│   │   ├── validators.ts      # Zod validators
│   │   └── prompts.ts         # Prompt templates [[memory:5212035]]
│   │       └── # Uses specific object names in vertical prompts
│   │
│   └── types/
│       ├── index.ts
│       ├── veo.types.ts
│       ├── job.types.ts
│       └── export.types.ts
```

## Infrastructure
```
infrastructure/
├── docker/
│   ├── frontend/
│   │   └── Dockerfile
│   ├── backend/
│   │   └── Dockerfile
│   └── nginx/
│       ├── Dockerfile
│       └── nginx.conf
│
├── kubernetes/                 # K8s configurations (optional)
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
│
└── terraform/                  # Infrastructure as Code (optional)
    ├── main.tf
    ├── variables.tf
    └── outputs.tf
```

## Scripts
```
scripts/
├── setup.sh                    # Initial setup script
├── deploy.sh                   # Deployment script
├── backup.sh                   # Database backup script
└── test-ffmpeg.js             # FFmpeg testing utilities
```

## Documentation
```
docs/
├── API.md                      # API documentation
├── DEPLOYMENT.md               # Deployment guide
├── DEVELOPMENT.md              # Development guide
├── FFMPEG_COMMANDS.md         # FFmpeg command reference
└── VEO3_INTEGRATION.md        # Veo 3 API integration guide
```

## Key Configuration Files

### Root .env.example
```env
# API Keys
GEMINI_API_KEY=
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_STORAGE_BUCKET=

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vertical_veo3

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=
JWT_EXPIRES_IN=7d

# Storage
STORAGE_TYPE=gcs # or 'local'
CDN_URL=

# Stripe (optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# App
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

### Docker Compose Services
```yaml
services:
  - frontend (Next.js)
  - backend (Node.js API)
  - postgres (Database)
  - redis (Queue/Cache)
  - nginx (Reverse Proxy)
  - minio (Local S3-compatible storage for dev)
```

## Database Schema Overview

### Main Tables
- **users**: User accounts and authentication
- **generations**: Video generation jobs
- **exports**: Export jobs and configurations
- **media**: Media files metadata
- **prompts**: Saved prompt templates
- **presets**: Export presets
- **usage**: API usage tracking
- **billing**: Billing and subscription info

## API Endpoints Structure

### Generation
- `POST /api/v1/generation/create` - Create new generation job
- `GET /api/v1/generation/:id` - Get generation status
- `GET /api/v1/generation/list` - List user generations

### Export
- `POST /api/v1/export/create` - Create export job
- `GET /api/v1/export/:id` - Get export status
- `POST /api/v1/export/preview` - Generate preview

### Media
- `POST /api/v1/media/upload` - Upload media file
- `GET /api/v1/media/:id` - Get media info
- `DELETE /api/v1/media/:id` - Delete media

### Auth
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout

## Frontend Routes

- `/` - Landing page
- `/generate` - Video generation interface
- `/results/:id` - Results and preview page
- `/library` - User's video library
- `/import` - Import existing video
- `/account` - Account settings
- `/pricing` - Pricing plans

## Key Features Implementation Areas

1. **Vertical Logic Prompt System** [[memory:5212048]]
   - Location: `backend/src/services/veo.service.ts`
   - Securely merges universal vertical prompt with user input

2. **Prompt Processing** [[memory:5212044]]
   - Location: `backend/src/services/prompt.service.ts`
   - Recognizes elements first, then applies vertical formatting

3. **Export Options**
   - Location: `backend/src/services/ffmpeg.service.ts`
   - Metadata-only rotate (fast)
   - Guaranteed upright 9:16 (re-encode)
   - Horizontal pass-through

4. **Preview System**
   - Location: `frontend/src/components/preview/VerticalPreview.tsx`
   - CSS transform for vertical preview
   - No file modification

5. **Job Queue System**
   - Location: `backend/src/queue/`
   - BullMQ for job processing
   - Redis for queue storage
