import { Router } from 'express';
import generationRoutes from './generation.routes';
import generateRoutes from './generate';
import uploadRoutes from './upload';
import { logger } from '@/utils/logger';

const router = Router();

// API version prefix
const API_VERSION = '/api/v1';

// Mount route modules
router.use(`${API_VERSION}/generation`, generationRoutes);
router.use(`${API_VERSION}/generate`, generateRoutes);
router.use(`${API_VERSION}/upload`, uploadRoutes);

// API health check
router.get(`${API_VERSION}/health`, (req, res) => {
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

// API info endpoint
router.get(`${API_VERSION}/info`, (req, res) => {
  res.json({
    name: 'Vertical Veo 3 API',
    version: '1.0.0',
    description: 'AI-powered vertical video generation API',
    endpoints: [
      'GET /api/v1/health',
      'GET /api/v1/generation/limits',
      'POST /api/v1/generation/create',
      'GET /api/v1/generation/:id',
      'GET /api/v1/generation/list',
      'GET /api/v1/generation/stats',
      'POST /api/v1/generate',
      'GET /api/v1/generate/:id',
      'POST /api/v1/generate/:id/export',
      'DELETE /api/v1/generate/:id',
      'POST /api/v1/upload',
      'GET /api/v1/upload/:id',
      'DELETE /api/v1/upload/:id',
      'POST /api/v1/upload/batch'
    ],
    documentation: 'https://docs.vertical-veo3.com'
  });
});

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
      'GET /api/v1/health',
      'GET /api/v1/generation/limits',
      'POST /api/v1/generation/create',
      'GET /api/v1/generation/:id',
      'GET /api/v1/generation/list',
      'GET /api/v1/generation/stats',
      'POST /api/v1/generate',
      'GET /api/v1/generate/:id',
      'POST /api/v1/generate/:id/export',
      'DELETE /api/v1/generate/:id',
      'POST /api/v1/upload',
      'GET /api/v1/upload/:id',
      'DELETE /api/v1/upload/:id',
      'POST /api/v1/upload/batch'
    ]
  });
});

export default router;
