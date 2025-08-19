import { EventEmitter } from 'events';
import { veoService } from './veo.service';
import { logger, Timer } from '@/utils/logger';
import { VeoOperationStatus } from '@/types/veo.types';

/**
 * Status Polling Service
 * 
 * Manages intelligent status polling for Veo 3 operations with:
 * - Exponential backoff
 * - Error recovery
 * - Event-driven updates
 * - Resource management
 */

interface PollingOptions {
  maxPolls?: number;
  initialInterval?: number;
  maxInterval?: number;
  backoffMultiplier?: number;
  errorRetryLimit?: number;
  onProgress?: (status: VeoOperationStatus) => void;
  onComplete?: (status: VeoOperationStatus) => void;
  onError?: (error: Error) => void;
}

interface ActivePoll {
  operationId: string;
  startTime: number;
  pollCount: number;
  currentInterval: number;
  timer?: NodeJS.Timeout;
  options: PollingOptions;
  emitter: EventEmitter;
}

class StatusPollingService extends EventEmitter {
  private activePolls = new Map<string, ActivePoll>();
  private readonly DEFAULT_OPTIONS: Required<Omit<PollingOptions, 'onProgress' | 'onComplete' | 'onError'>> = {
    maxPolls: 360, // 30 minutes max
    initialInterval: 5000, // 5 seconds
    maxInterval: 30000, // 30 seconds max
    backoffMultiplier: 1.1,
    errorRetryLimit: 5,
  };

  constructor() {
    super();
    this.setupCleanupInterval();
    
    logger.info('Status polling service initialized');
  }

  /**
   * Start polling for an operation
   */
  async startPolling(operationId: string, options: PollingOptions = {}): Promise<void> {
    // Stop existing poll if running
    this.stopPolling(operationId);

    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };
    const emitter = new EventEmitter();

    const poll: ActivePoll = {
      operationId,
      startTime: Date.now(),
      pollCount: 0,
      currentInterval: mergedOptions.initialInterval,
      options: mergedOptions,
      emitter,
    };

    this.activePolls.set(operationId, poll);

    logger.info('Started polling for operation', {
      operationId,
      options: mergedOptions
    });

    // Set up event handlers
    if (options.onProgress) {
      emitter.on('progress', options.onProgress);
    }
    if (options.onComplete) {
      emitter.on('complete', options.onComplete);
    }
    if (options.onError) {
      emitter.on('error', options.onError);
    }

    // Start the polling loop
    this.schedulePoll(operationId);
  }

  /**
   * Stop polling for an operation
   */
  stopPolling(operationId: string): void {
    const poll = this.activePolls.get(operationId);
    if (poll) {
      if (poll.timer) {
        clearTimeout(poll.timer);
      }
      poll.emitter.removeAllListeners();
      this.activePolls.delete(operationId);
      
      logger.info('Stopped polling for operation', {
        operationId,
        pollCount: poll.pollCount,
        duration: Date.now() - poll.startTime
      });
    }
  }

  /**
   * Get polling status for an operation
   */
  getPollingStatus(operationId: string): {
    isPolling: boolean;
    pollCount: number;
    duration: number;
    currentInterval: number;
  } | null {
    const poll = this.activePolls.get(operationId);
    if (!poll) return null;

    return {
      isPolling: true,
      pollCount: poll.pollCount,
      duration: Date.now() - poll.startTime,
      currentInterval: poll.currentInterval,
    };
  }

  /**
   * Get all active polls
   */
  getActivePolls(): string[] {
    return Array.from(this.activePolls.keys());
  }

  /**
   * Schedule the next poll for an operation
   */
  private schedulePoll(operationId: string): void {
    const poll = this.activePolls.get(operationId);
    if (!poll) return;

    poll.timer = setTimeout(async () => {
      await this.executePoll(operationId);
    }, poll.currentInterval);
  }

  /**
   * Execute a single poll iteration
   */
  private async executePoll(operationId: string): Promise<void> {
    const poll = this.activePolls.get(operationId);
    if (!poll) return;

    const timer = new Timer(`poll-${operationId}`, { operationId, pollCount: poll.pollCount });

    try {
      poll.pollCount++;

      // Check if we've exceeded max polls
      if (poll.pollCount > (poll.options.maxPolls ?? 300)) {
        const timeoutError = new Error(`Polling timeout after ${poll.options.maxPolls} attempts`);
        poll.emitter.emit('error', timeoutError);
        this.stopPolling(operationId);
        return;
      }

      // Get operation status
      const status = await veoService.checkOperationStatus(operationId);

      // Emit progress event
      poll.emitter.emit('progress', status);
      this.emit('progress', { operationId, status });

      // Log progress periodically
      if (poll.pollCount % 10 === 0) {
        logger.debug('Polling progress', {
          operationId,
          pollCount: poll.pollCount,
          progress: status.progress,
          status: status.status,
          currentInterval: poll.currentInterval
        });
      }

      // Check for completion
      if (status.status === 'COMPLETED') {
        timer.end('Polling completed successfully');
        
        logger.info('Operation completed', {
          operationId,
          pollCount: poll.pollCount,
          totalTime: Date.now() - poll.startTime,
          finalProgress: status.progress
        });

        poll.emitter.emit('complete', status);
        this.emit('complete', { operationId, status });
        this.stopPolling(operationId);
        return;
      }

      // Check for failure
      if (status.status === 'FAILED') {
        timer.end('Polling completed with failure');
        
        const error = new Error(status.error || 'Operation failed');
        logger.error('Operation failed during polling', {
          operationId,
          pollCount: poll.pollCount,
          error: status.error
        });

        poll.emitter.emit('error', error);
        this.emit('error', { operationId, error });
        this.stopPolling(operationId);
        return;
      }

      // Continue polling with exponential backoff
      poll.currentInterval = Math.min(
        poll.currentInterval * (poll.options.backoffMultiplier ?? 1.1),
        poll.options.maxInterval ?? 15000
      );

      timer.end('Poll iteration completed');
      this.schedulePoll(operationId);

    } catch (error) {
      timer.end('Poll iteration failed');
      
      logger.error('Polling iteration error', {
        operationId,
        pollCount: poll.pollCount,
        error: (error as Error).message
      });

      // Check if we should retry or give up
      if (poll.pollCount > (poll.options.errorRetryLimit ?? 10)) {
        const giveUpError = new Error(`Polling failed after ${(poll.options.errorRetryLimit ?? 10)} consecutive errors: ${(error as Error).message}`);
        poll.emitter.emit('error', giveUpError);
        this.emit('error', { operationId, error: giveUpError });
        this.stopPolling(operationId);
        return;
      }

      // Wait longer after errors and retry
      poll.currentInterval = Math.min(poll.currentInterval * 2, poll.options.maxInterval ?? 15000);
      this.schedulePoll(operationId);
    }
  }

  /**
   * Setup cleanup interval to remove stale polls
   */
  private setupCleanupInterval(): void {
    // Clean up stale polls every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60 * 60 * 1000; // 1 hour

      for (const [operationId, poll] of this.activePolls.entries()) {
        if (now - poll.startTime > staleThreshold) {
          logger.warn('Cleaning up stale poll', {
            operationId,
            duration: now - poll.startTime,
            pollCount: poll.pollCount
          });
          this.stopPolling(operationId);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Poll operation with promise-based interface
   */
  async pollUntilComplete(operationId: string, options: PollingOptions = {}): Promise<VeoOperationStatus> {
    return new Promise((resolve, reject) => {
      this.startPolling(operationId, {
        ...options,
        onComplete: (status) => {
          options.onComplete?.(status);
          resolve(status);
        },
        onError: (error) => {
          options.onError?.(error);
          reject(error);
        },
      });
    });
  }

  /**
   * Batch poll multiple operations
   */
  async pollMultiple(
    operationIds: string[],
    options: PollingOptions = {}
  ): Promise<Map<string, VeoOperationStatus>> {
    const results = new Map<string, VeoOperationStatus>();
    const promises = operationIds.map(operationId =>
      this.pollUntilComplete(operationId, options)
        .then(status => results.set(operationId, status))
        .catch(error => {
          logger.error('Batch poll failed for operation', {
            operationId,
            error: error.message
          });
          results.set(operationId, {
            operationId,
            status: 'FAILED',
            error: error.message,
            progress: 0
          });
        })
    );

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Get service statistics
   */
  getStats() {
    const activeCount = this.activePolls.size;
    const polls = Array.from(this.activePolls.values());
    
    return {
      activePolls: activeCount,
      totalPollCount: polls.reduce((sum, poll) => sum + poll.pollCount, 0),
      averagePollCount: activeCount > 0 ? polls.reduce((sum, poll) => sum + poll.pollCount, 0) / activeCount : 0,
      oldestPollAge: activeCount > 0 ? Math.max(...polls.map(poll => Date.now() - poll.startTime)) : 0,
      operationIds: Array.from(this.activePolls.keys()),
    };
  }

  /**
   * Cleanup all polls
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up all active polls', {
      activeCount: this.activePolls.size
    });

    for (const operationId of this.activePolls.keys()) {
      this.stopPolling(operationId);
    }

    this.removeAllListeners();
  }
}

// Export singleton instance
export const pollingService = new StatusPollingService();

// Export class for testing
export { StatusPollingService };
