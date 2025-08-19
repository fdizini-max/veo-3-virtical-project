import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import { queueManager } from './queue';

/**
 * Main Application Entry Point
 * Sets up Express server with middleware and routes
 */

async function createApp() {
  // Validate configuration
  const configValidation = validateConfig();
  if (!configValidation.isValid) {
    logger.error('Configuration validation failed', {
      errors: configValidation.errors
    });
    process.exit(1);
  }

  const app = express();

  // Security middleware
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
      },
    },
  }));

  // CORS configuration
  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging middleware
  app.use((req, _res, next) => {
    const headerRequestId = req.headers['x-request-id'];
    const normalizedHeaderId = Array.isArray(headerRequestId) ? headerRequestId[0] : headerRequestId;
    const requestId: string = normalizedHeaderId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;

    logger.request(req.method, req.path, 0, 0, { requestId });
    next();
  });

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: config.env
    });
  });

  // Import and use API routes
  const apiRoutes = await import('./routes');
  app.use('/', apiRoutes.default);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString()
    });
  });

  // Global error handler
  app.use((err: any, req: any, res: any, _next: any) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
      requestId: req.requestId,
      path: req.path,
      method: req.method
    });

    res.status(err.status || 500).json({
      error: config.isDevelopment ? err.message : 'Internal Server Error',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
  });

  return app;
}

async function startServer() {
  try {
    logger.info('Starting Vertical Veo 3 API server...', {
      environment: config.env,
      port: config.port,
      nodeVersion: process.version
    });

    // Initialize queue manager if enabled
    if (config.queuesEnabled) {
      await queueManager.initialize();
      logger.info('Queue manager initialized');
    } else {
      logger.warn('Queues are disabled by configuration. Skipping queue initialization.');
    }

    // Create Express app
    const app = await createApp();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info('Server started successfully', {
        port: config.port,
        environment: config.env,
        frontendUrl: config.frontendUrl
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(async () => {
        try {
          await queueManager.cleanup();
          logger.info('Server shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error: error.message });
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

export { createApp };
