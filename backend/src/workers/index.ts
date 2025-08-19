#!/usr/bin/env node

/**
 * Worker Process Entry Point
 * Starts all background workers for video generation processing
 */

import { generationWorker } from './generation.worker';
import { exportWorker } from './export.worker';
import { queueManager } from '@/queue';
import { logger } from '@/utils/logger';
import config, { validateConfig } from '@/config';

/**
 * Worker Manager - Coordinates all background workers
 */
class WorkerManager {
  private isRunning = false;
  private shutdownPromise?: Promise<void>;

  /**
   * Start all workers
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Workers already running');
      return;
    }

    try {
      logger.info('Starting worker processes...', {
        environment: config.env,
        concurrency: config.queue.generation.concurrency
      });

      // Initialize queue manager first
      await queueManager.initialize();

      // Workers are automatically initialized when imported
      // The generation and export workers are already started in their modules

      this.isRunning = true;
      this.setupGracefulShutdown();

      logger.info('All workers started successfully');

      // Keep the process alive
      await this.keepAlive();

    } catch (error) {
      logger.error('Failed to start workers', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Keep the process alive and monitor health
   */
  private async keepAlive(): Promise<void> {
    // Log status every 5 minutes
    setInterval(async () => {
      try {
        const health = await queueManager.getSystemHealth();
        const stats = await queueManager.getSystemStats();
        
        logger.info('Worker health check', {
          isHealthy: health.isHealthy,
          totalActive: stats?.totalJobs.active || 0,
          totalWaiting: stats?.totalJobs.waiting || 0,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        });

        // Log warning if unhealthy
        if (!health.isHealthy) {
          logger.warn('Worker system is unhealthy', health);
        }

      } catch (error) {
        logger.error('Health check failed', {
          error: error.message
        });
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Monitor memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      };

      // Log warning if memory usage is high
      if (memUsageMB.heapUsed > 512) { // 512MB threshold
        logger.warn('High memory usage detected', memUsageMB);
      } else {
        logger.debug('Memory usage', memUsageMB);
      }
    }, 60 * 1000); // Every minute

    // Return a promise that never resolves to keep process alive
    return new Promise(() => {});
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.shutdownPromise) {
        logger.info(`Received ${signal} again, forcing exit...`);
        process.exit(1);
      }

      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      this.shutdownPromise = this.performShutdown();
      await this.shutdownPromise;
    };

    // Handle various shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    // Handle uncaught exceptions and rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in worker process', {
        error: error.message,
        stack: error.stack
      });
      
      // Attempt graceful shutdown
      this.performShutdown().finally(() => {
        process.exit(1);
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection in worker process', {
        reason: String(reason),
        promise: String(promise)
      });
    });

    // Handle worker-specific errors
    process.on('warning', (warning) => {
      logger.warn('Node.js warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });
  }

  /**
   * Perform graceful shutdown
   */
  private async performShutdown(): Promise<void> {
    try {
      this.isRunning = false;

      logger.info('Shutting down workers gracefully...');

      // Set a timeout for shutdown
      const shutdownTimeout = setTimeout(() => {
        logger.error('Shutdown timeout reached, forcing exit');
        process.exit(1);
      }, 30000); // 30 seconds timeout

      // Pause queues to prevent new jobs
      await queueManager.pauseAll();
      logger.info('Queues paused');

      // Wait for active jobs to complete
      const maxWaitTime = 20000; // 20 seconds
      const startTime = Date.now();
      
      logger.info('Waiting for active jobs to complete...');
      while (Date.now() - startTime < maxWaitTime) {
        const stats = await queueManager.getSystemStats();
        const activeJobs = stats?.totalJobs.active || 0;
        
        if (activeJobs === 0) {
          logger.info('All active jobs completed');
          break;
        }
        
        logger.info(`Waiting for ${activeJobs} active jobs to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Close workers
      await generationWorker.close();
      logger.info('Generation worker closed');

      // Close queue manager
      await queueManager.cleanup();
      logger.info('Queue manager closed');

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown completed');
      
      process.exit(0);

    } catch (error) {
      logger.error('Error during shutdown', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      pid: process.pid,
      nodeVersion: process.version,
      environment: config.env,
    };
  }
}

/**
 * Main execution
 */
async function main() {
  // Validate configuration
  const configValidation = validateConfig();
  if (!configValidation.isValid) {
    logger.error('Configuration validation failed', {
      errors: configValidation.errors
    });
    process.exit(1);
  }

  // Create and start worker manager
  const workerManager = new WorkerManager();
  await workerManager.start();
}

// Start if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to start worker process', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });
}

export { WorkerManager };
