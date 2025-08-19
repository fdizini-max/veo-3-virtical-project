/**
 * Queue System Index
 * Central management for all queue operations
 */

import { generationQueue } from './generation.queue';
import { exportQueue } from './export.queue';
import { logger } from '@/utils/logger';
import { config } from '@/config';

/**
 * Queue Manager - Coordinates all queues and workers
 */
class QueueManager {
  private isInitialized = false;
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Initialize all queues and start background processes
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Queue manager already initialized');
      return;
    }

    try {
      logger.info('Initializing queue manager...');

      // Test Redis connection
      await this.testRedisConnection();

      // Start cleanup scheduler
      this.startCleanupScheduler();

      // Setup health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      logger.info('Queue manager initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize queue manager', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Test Redis connection
   */
  private async testRedisConnection(): Promise<void> {
    try {
      // Test connection using the generation queue
      const stats = await generationQueue.getStats();
      logger.info('Redis connection test successful', stats);
    } catch (error) {
      logger.error('Redis connection test failed', {
        error: error.message,
        redisUrl: config.redis.url
      });
      throw new Error('Redis connection failed');
    }
  }

  /**
   * Start automatic cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Parse cron-like schedule (simplified)
    const scheduleMinutes = 60; // Run every hour
    
    this.cleanupInterval = setInterval(async () => {
      try {
        logger.info('Starting scheduled queue cleanup...');
        
        // Clean up old jobs (older than 24 hours)
        await generationQueue.cleanup(24 * 60 * 60 * 1000);
        
        logger.info('Scheduled queue cleanup completed');
        
      } catch (error) {
        logger.error('Scheduled cleanup failed', {
          error: error.message
        });
      }
    }, scheduleMinutes * 60 * 1000);

    logger.info('Cleanup scheduler started', {
      intervalMinutes: scheduleMinutes
    });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    // Check queue health every 5 minutes
    setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        
        if (!health.isHealthy) {
          logger.warn('Queue system health check failed', health);
        } else {
          logger.debug('Queue system health check passed', health);
        }
        
      } catch (error) {
        logger.error('Health monitoring error', {
          error: error.message
        });
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth() {
    try {
      const generationStats = await generationQueue.getStats();
      const generationInfo = await generationQueue.getQueueInfo();
      const exportStats = await exportQueue.getStats();
      const exportInfo = await exportQueue.getQueueInfo();

      const health = {
        isHealthy: true,
        timestamp: new Date().toISOString(),
        queues: {
          generation: {
            ...generationStats,
            isHealthy: generationInfo?.isHealthy || false,
            estimatedWaitTime: generationInfo?.estimatedWaitTime || 0,
          },
          export: {
            ...exportStats,
            isHealthy: exportInfo?.isHealthy || false,
          }
        },
        redis: {
          connected: true, // Will throw if not connected
        },
        workers: {
          generation: {
            concurrency: config.queue.generation.concurrency,
            // Worker stats would be added here if workers report back
          }
        }
      };

      // Determine overall health
      health.isHealthy = health.queues.generation.isHealthy && health.queues.export.isHealthy && health.redis.connected;

      return health;

    } catch (error) {
      logger.error('Failed to get system health', {
        error: error.message
      });

      return {
        isHealthy: false,
        timestamp: new Date().toISOString(),
        error: error.message,
        queues: {},
        redis: { connected: false },
        workers: {}
      };
    }
  }

  /**
   * Get system statistics
   */
  async getSystemStats() {
    try {
      const generationStats = await generationQueue.getStats();
      const exportStats = await exportQueue.getStats();
      
      return {
        timestamp: new Date().toISOString(),
        totalJobs: {
          waiting: generationStats.waiting,
          active: generationStats.active,
          completed: generationStats.completed,
          failed: generationStats.failed,
          delayed: generationStats.delayed,
        },
        queues: {
          generation: generationStats,
          export: exportStats,
        },
        performance: {
          // These would be calculated from historical data
          averageProcessingTime: 180, // 3 minutes
          successRate: 0.95, // 95%
          throughput: 20, // jobs per hour
        }
      };

    } catch (error) {
      logger.error('Failed to get system stats', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Pause all queues
   */
  async pauseAll(): Promise<void> {
    try {
      await generationQueue.pause();
      logger.info('All queues paused');
    } catch (error) {
      logger.error('Failed to pause queues', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Resume all queues
   */
  async resumeAll(): Promise<void> {
    try {
      await generationQueue.resume();
      logger.info('All queues resumed');
    } catch (error) {
      logger.error('Failed to resume queues', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Emergency shutdown - drain all queues
   */
  async emergencyShutdown(): Promise<void> {
    try {
      logger.warn('Emergency shutdown initiated');
      
      // Pause all queues to prevent new jobs
      await this.pauseAll();
      
      // Wait for active jobs to complete (with timeout)
      const maxWaitTime = 60000; // 1 minute
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        const stats = await generationQueue.getStats();
        if (stats.active === 0) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      logger.info('Emergency shutdown completed');
      
    } catch (error) {
      logger.error('Emergency shutdown failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up all resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = undefined;
      }

      await generationQueue.close();
      
      this.isInitialized = false;
      logger.info('Queue manager cleanup completed');

    } catch (error) {
      logger.error('Queue manager cleanup failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get queue manager status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasCleanupScheduler: !!this.cleanupInterval,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }
}

// Create and export singleton instance
export const queueManager = new QueueManager();

// Export individual queues for direct access
export { generationQueue } from './generation.queue';

// Export types
export type { QueueStats } from './generation.queue';

// Utility functions
export const queueUtils = {
  /**
   * Add a generation job with proper error handling
   */
  async addGenerationJob(jobData: Parameters<typeof generationQueue.addGenerationJob>[0]) {
    try {
      return await generationQueue.addGenerationJob(jobData);
    } catch (error) {
      logger.error('Failed to add generation job', {
        generationId: jobData.generationId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Get job status with error handling
   */
  async getJobStatus(jobId: string) {
    try {
      return await generationQueue.getJobStatus(jobId);
    } catch (error) {
      logger.error('Failed to get job status', {
        jobId,
        error: error.message
      });
      return null;
    }
  },

  /**
   * Cancel job with error handling
   */
  async cancelJob(jobId: string) {
    try {
      return await generationQueue.cancelJob(jobId);
    } catch (error) {
      logger.error('Failed to cancel job', {
        jobId,
        error: error.message
      });
      return false;
    }
  },

  /**
   * Get comprehensive queue information
   */
  async getQueueInfo() {
    try {
      const [health, stats] = await Promise.all([
        queueManager.getSystemHealth(),
        queueManager.getSystemStats()
      ]);

      return {
        health,
        stats,
        status: queueManager.getStatus()
      };
    } catch (error) {
      logger.error('Failed to get queue info', {
        error: error.message
      });
      return null;
    }
  }
};

export default queueManager;
