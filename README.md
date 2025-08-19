# Vertical Veo 3 Tool - MVP

A powerful tool for generating vertical-first videos using Google's Veo 3 API. This tool cleverly works around Veo 3's 16:9 output limitation to create perfect 9:16 vertical videos for social media platforms.

## 🎯 Key Features

- **Vertical-First Generation**: Automatically composes videos sideways for perfect vertical output
- **Smart Preview System**: CSS-based vertical preview without modifying files  
- **Flexible Export Options**: 
  - Fast metadata-only rotation
  - Guaranteed upright 9:16 with re-encoding
  - Horizontal pass-through
- **Platform Presets**: Optimized for TikTok, Instagram Reels, YouTube Shorts
- **FFmpeg Integration**: Professional-grade video processing
- **Queue System**: Reliable background job processing with BullMQ
- **Cloud Storage**: Support for GCS, AWS S3, or local storage

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- Next.js 14 with App Router
- React 18 with TypeScript
- Tailwind CSS for styling
- Radix UI components
- React Query for data fetching
- Zustand for state management

**Backend:**
- Node.js with Express
- TypeScript
- Prisma ORM with PostgreSQL
- BullMQ for job queues
- Redis for caching
- FFmpeg for video processing

**Infrastructure:**
- Docker & Docker Compose
- Google Cloud Storage
- Nginx reverse proxy
- PostgreSQL database
- Redis cache

## 📁 Project Structure

```
vertical-veo3-tool/
├── frontend/          # Next.js frontend application
├── backend/           # Node.js/Express API server
├── infrastructure/    # Docker, Kubernetes, Terraform configs
├── scripts/          # Utility scripts
└── docs/            # Documentation
```

See `PROJECT_STRUCTURE.md` for detailed structure breakdown.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- FFmpeg installed locally
- Google Cloud account with Gemini API access
- PostgreSQL (or use Docker)
- Redis (or use Docker)

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/vertical-veo3-tool.git
cd vertical-veo3-tool
```

2. Copy environment variables:
```bash
cp env.example .env
# Edit .env with your API keys and configuration
```

3. Install dependencies:
```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

### Using Docker (Recommended)

1. Start all services:
```bash
docker-compose up -d
```

2. Run database migrations:
```bash
docker-compose exec backend npm run migrate
```

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- MinIO Console: http://localhost:9001

### Manual Setup

1. Start PostgreSQL and Redis:
```bash
# Using Docker for databases only
docker-compose up -d postgres redis
```

2. Run database migrations:
```bash
cd backend
npm run migrate
```

3. Start the backend:
```bash
cd backend
npm run dev
```

4. Start the frontend:
```bash
cd frontend
npm run dev
```

## 🎬 How It Works

### Vertical-First Generation Process [[memory:5212048]]

1. **User Input**: User provides a prompt and optional reference image
2. **Prompt Processing**: System recognizes elements and applies vertical formatting [[memory:5212044]]
3. **Veo 3 Generation**: Sends modified prompt with rotation instructions to Veo 3
4. **Preview**: Shows vertical preview using CSS transforms
5. **Export**: User chooses export option for final 9:16 video

### The Rotation Trick

The tool prepends this instruction to user prompts:

> "Design the video in 9:16 vertical composition, but render it in a 16:9 horizontal layout with the entire scene rotated 90 degrees counterclockwise..."

This makes Veo 3 compose the video sideways, which becomes perfect vertical when rotated back.

## 📊 API Endpoints

### Generation
- `POST /api/v1/generation/create` - Create new video generation
- `GET /api/v1/generation/:id` - Check generation status
- `GET /api/v1/generation/list` - List user's generations

### Export  
- `POST /api/v1/export/create` - Create export job
- `GET /api/v1/export/:id` - Get export status
- `POST /api/v1/export/preview` - Generate preview

### Media
- `POST /api/v1/media/upload` - Upload media file
- `GET /api/v1/media/:id` - Get media information
- `DELETE /api/v1/media/:id` - Delete media

## 🎯 FFmpeg Commands

### Guaranteed Upright 9:16 (Re-encode)
```bash
ffmpeg -i input.mp4 -vf "transpose=1,crop=1080:1920:(in_w-1080)/2:(in_h-1920)/2" \
  -c:v libx264 -crf 18 -preset medium -c:a copy output_1080x1920.mp4
```

### Metadata-Only Rotate (Fast)
```bash
ffmpeg -i input.mp4 -metadata:s:v rotate="90" -codec copy output_flagged.mp4
```

### Scale & Pad Alternative
```bash
ffmpeg -i input.mp4 -vf "scale=w=1080:h=1920:force_original_aspect_ratio=decrease,\
  pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1:1" \
  -c:v libx264 -crf 18 -preset medium -c:a copy output_pad_1080x1920.mp4
```

## 🔐 Security Features

- JWT-based authentication
- Rate limiting on API endpoints
- Input validation with Zod
- Content moderation for prompts
- Secure prompt merging (vertical logic not exposed) [[memory:5212048]]
- HTTPS with SSL certificates
- Environment variable encryption

## 📈 Monitoring & Logging

- Winston logger for structured logging
- Custom error tracking
- API performance metrics
- Job queue monitoring
- Optional Sentry integration

## 🚧 Development

### Running Tests
```bash
# All tests
npm test

# Frontend only
npm run test:frontend

# Backend only
npm run test:backend
```

### Database Commands
```bash
# Generate Prisma client
cd backend && npm run generate

# Create migration
cd backend && npx prisma migrate dev --name your_migration_name

# Reset database
cd backend && npx prisma migrate reset
```

### Code Quality
```bash
# Lint frontend
cd frontend && npm run lint

# Lint backend
cd backend && npm run lint
```

## 📝 Configuration

Key configuration options in `.env`:

- `GEMINI_API_KEY`: Your Gemini API key for Veo 3 access
- `VEO3_MODEL`: Model version (veo-3.0-generate-preview)
- `EXPORT_CRF`: Video quality (18 recommended)
- `QUEUE_GENERATION_CONCURRENCY`: Parallel generation jobs
- `RATE_LIMIT_GENERATION_PER_HOUR`: User generation limits

## 🎯 Roadmap

- [ ] Batch job processing
- [ ] Smart auto-crop detection
- [ ] Character consistency with image seeding
- [ ] Audio ducking and captions
- [ ] Multi-region cloud rendering
- [ ] Advanced templates system
- [ ] Mobile app development

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Google Gemini team for Veo 3 API access
- FFmpeg community for video processing tools
- Next.js and Node.js communities

## 📞 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/yourusername/vertical-veo3-tool/issues)
- Documentation: See `/docs` folder
- Email: support@vertical-veo3.com

---

Built with ❤️ for content creators who need vertical videos that just work.
