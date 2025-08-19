import { Router } from 'express';
import generationRoutes from './generation.routes';
import generateRoutes from './generate';
import uploadRoutes from './upload';
import { logger } from '@/utils/logger';

const router = Router();

// API prefixes (support both /api and /api/v1)
const API_PREFIXES = ['/api', '/api/v1'];

// Mount route modules under both prefixes
for (const prefix of API_PREFIXES) {
  router.use(`${prefix}/generation`, generationRoutes);
  router.use(`${prefix}/generate`, generateRoutes);
  router.use(`${prefix}/upload`, uploadRoutes);
}

// API health check on both prefixes
for (const prefix of API_PREFIXES) {
  router.get(`${prefix}/health`, (req, res) => {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        database: 'connected', // TODO: Add actual health checks
        redis: 'connected',
        queue: 'running'
      }
    });
  });
}

// API info endpoint on both prefixes
for (const prefix of API_PREFIXES) {
  router.get(`${prefix}/info`, (req, res) => {
    res.json({
      name: 'Vertical Veo 3 API',
      version: '1.0.0',
      description: 'AI-powered vertical video generation API',
      endpoints: [
        'GET /api/health',
        'GET /api/generation/limits',
        'POST /api/generation/create',
        'GET /api/generation/:id',
        'GET /api/generation/list',
        'GET /api/generation/stats',
        'POST /api/generate',
        'GET /api/generate/:id',
        'POST /api/generate/:id/export',
        'DELETE /api/generate/:id',
        'POST /api/upload',
        'GET /api/upload/:id',
        'DELETE /api/upload/:id',
        'POST /api/upload/batch'
      ],
      documentation: 'https://docs.vertical-veo3.com'
    });
  });
}

// Catch-all for undefined API routes
router.use('*', (req, res) => {
  logger.warn('API route not found', {
    method: req.method,
    path: req.originalUrl,
    requestId: req.requestId
  });

  res.status(404).json({
    error: 'API endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid API endpoint`,
    availableEndpoints: [
      'GET /api/health',
      'GET /api/generation/limits',
      'POST /api/generation/create',
      'GET /api/generation/:id',
      'GET /api/generation/list',
      'GET /api/generation/stats',
      'POST /api/generate',
      'GET /api/generate/:id',
      'POST /api/generate/:id/export',
      'DELETE /api/generate/:id',
      'POST /api/upload',
      'GET /api/upload/:id',
      'DELETE /api/upload/:id',
      'POST /api/upload/batch'
    ]
  });
});

export default router;
