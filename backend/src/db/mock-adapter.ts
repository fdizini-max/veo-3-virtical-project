/**
 * Mock Database Adapter for Local Testing
 * Provides a simple in-memory data store when Prisma is not available
 */

interface MockJob {
  id: string;
  type: string;
  status: string;
  prompt?: string;
  mode: string;
  inputFile?: string;
  outputFile?: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  progress: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface MockMedia {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  storageType: string;
  storagePath: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  hasAudio: boolean;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

class MockDatabase {
  private jobs: Map<string, MockJob> = new Map();
  private media: Map<string, MockMedia> = new Map();

  // Job operations
  async createJob(data: {
    type: string;
    status: string;
    prompt?: string;
    mode: string;
    metadata: any;
    userId?: string;
  }): Promise<MockJob> {
    const job: MockJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: 0,
    };
    
    this.jobs.set(job.id, job);
    return job;
  }

  async findJob(id: string): Promise<MockJob | null> {
    return this.jobs.get(id) || null;
  }

  async updateJob(id: string, data: Partial<MockJob>): Promise<MockJob | null> {
    const job = this.jobs.get(id);
    if (!job) return null;

    const updated = {
      ...job,
      ...data,
      updatedAt: new Date(),
    };

    this.jobs.set(id, updated);
    return updated;
  }

  async findJobsByUser(userId: string, options: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    mode?: string;
  } = {}): Promise<{ jobs: MockJob[]; total: number }> {
    const { page = 1, limit = 20, status, type, mode } = options;
    
    let jobs = Array.from(this.jobs.values()).filter(job => job.userId === userId);

    if (status) jobs = jobs.filter(job => job.status === status);
    if (type) jobs = jobs.filter(job => job.type === type);
    if (mode) jobs = jobs.filter(job => job.mode === mode);

    // Sort by creation date (newest first)
    jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = jobs.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      jobs: jobs.slice(start, end),
      total,
    };
  }

  // Media operations
  async createMedia(data: {
    userId: string;
    filename: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    storageType: string;
    storagePath: string;
    publicUrl?: string;
    status: string;
  }): Promise<MockMedia> {
    const media: MockMedia = {
      id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      hasAudio: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.media.set(media.id, media);
    return media;
  }

  async findMedia(id: string): Promise<MockMedia | null> {
    return this.media.get(id) || null;
  }

  async updateMedia(id: string, data: Partial<MockMedia>): Promise<MockMedia | null> {
    const media = this.media.get(id);
    if (!media) return null;

    const updated = {
      ...media,
      ...data,
      updatedAt: new Date(),
    };

    this.media.set(id, updated);
    return updated;
  }

  async deleteMedia(id: string): Promise<boolean> {
    return this.media.delete(id);
  }

  async findMediaByUser(userId: string, options: {
    page?: number;
    limit?: number;
    type?: string;
  } = {}): Promise<{ media: MockMedia[]; total: number }> {
    const { page = 1, limit = 20, type } = options;
    
    let mediaList = Array.from(this.media.values()).filter(media => media.userId === userId);

    if (type) {
      mediaList = mediaList.filter(media => media.mimeType.startsWith(type + '/'));
    }

    // Sort by creation date (newest first)
    mediaList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = mediaList.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      media: mediaList.slice(start, end),
      total,
    };
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    return true; // Mock database is always "healthy"
  }
}

export const mockDb = new MockDatabase();
export type { MockJob, MockMedia };