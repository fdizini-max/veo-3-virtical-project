# Project Requirements Document (PRD)

## 1. Project Overview

This backend service—named **veo-3-vertical-project**—is a Node.js/TypeScript application designed to manage the full lifecycle of data tasks: generating synthetic or real data, handling file uploads, and exporting records in common formats (CSV, JSON). It exposes HTTP endpoints that enqueue heavy jobs to a message queue, ensuring users get quick acknowledgments while compute-intensive work happens asynchronously in background workers. This design makes the API highly responsive and scalable under load.

The core problem it solves is offloading long-running data operations from real-time requests to background processes. Instead of blocking clients during large dataset creation or export, the system immediately accepts requests, queues them, and processes them independently. Key objectives are: 1) maintain sub-200ms HTTP response times for enqueueing tasks, 2) ensure reliable job processing with clear status tracking, and 3) provide safe, efficient file upload and storage. Success criteria include stable throughput (e.g., 100 concurrent jobs), zero data loss, and robust error handling.

## 2. In-Scope vs. Out-of-Scope

**In-Scope (Version 1)**
- HTTP POST endpoint `/generate` to enqueue data generation jobs.
- HTTP POST endpoint `/upload` for multipart file uploads with validation.
- HTTP POST endpoint `/export` to enqueue data export tasks in CSV/JSON.
- Message queue integration (e.g., BullMQ with Redis) to manage job queues for generation and export.
- Background worker processes to pick up jobs, interact with the database via Prisma ORM, and perform the actual work.
- Configuration module supporting environment-based settings (development, staging, production).
- Basic job status tracking in the database (job ID, status: pending/in-progress/failed/completed).
- Simple logging strategy (console or file-based) for requests and job outcomes.

**Out-of-Scope (Planned for Later Phases)**
- Frontend/UI or dashboards for monitoring job status.
- Authentication and user roles—API remains open or protected by a future auth layer.
- Multi-tenant support.
- File storage rotation, archive policies, or lifecycle management.
- Detailed analytics or reporting beyond raw CSV/JSON export.
- High-availability Redis clustering or multi-region deployments.

## 3. User Flow

A client (could be another service or a frontend) calls the `/generate` endpoint with a JSON payload specifying dataset parameters (e.g., record count, schema). The API middleware validates the payload, then the route handler enqueues a `generation` job in the Redis-backed queue. The server immediately returns a 202 Accepted response with a unique job ID. Separately, a worker process picks up the job, uses Prisma to connect to the database, generates data rows, writes them into the DB, updates the job status, and logs progress.

Similarly, for file uploads, the client sends a multipart/form-data request to `/upload`. The upload middleware streams the file to local or cloud storage, validates file type/size, and returns a job ID for any downstream processing. For exports, a call to `/export` with filter parameters enqueues an export job. The worker retrieves relevant records from the database, transforms them to CSV or JSON, stores the result in an output bucket, and updates the DB with a download link. Clients can poll a `/status/:jobId` endpoint to check completion and retrieve a download URL when ready.

## 4. Core Features

- **Data Generation Endpoint** (`POST /generate`):
  - Accepts JSON with generation parameters.
  - Validates input schema.
  - Enqueues job with metadata (time, user, params).
- **File Upload Handling** (`POST /upload`):
  - Streams multipart uploads via middleware.
  - Validates file type (e.g., CSV, JSON) and size limit (e.g., 100MB).
  - Stores files in local disk or cloud (S3-compatible) storage.
- **Data Export Endpoint** (`POST /export`):
  - Accepts filters (date range, record type).
  - Enqueues export job into queue.
- **Asynchronous Job Queue**:
  - Uses Redis-based BullMQ (or similar) for `generationQueue` and `exportQueue`.
  - Supports job retry policies (e.g., 3 retries, backoff).
- **Background Workers**:
  - Separate Node.js worker processes consuming queue jobs.
  - Interact with Prisma ORM to read/write DB.
  - Save export outputs and update job statuses.
- **Configuration Module**:
  - Centralized `config/index.ts` loading environment vars (DB URL, Redis URL, storage paths).
- **Job Status Tracking**:
  - Database table `jobs` with fields: id, type, params, status, resultUri, createdAt, updatedAt.
- **Logging & Error Handling**:
  - Structured logs via Winston or Pino.
  - Global exception handlers to catch unhandled errors.

## 5. Tech Stack & Tools

- **Runtime & Language**: Node.js 18+, TypeScript for static typing.
- **Web Framework**: Express.js (or Fastify) for HTTP routing.
- **ORM**: Prisma for type-safe database access (PostgreSQL/MySQL/SQLite).
- **Message Queue**: BullMQ with Redis for asynchronous job management.
- **Storage**: Local disk or AWS S3 (S3-compatible) for uploads and exports.
- **Config Management**: `dotenv` or a config module for environment variables.
- **Logging**: Winston or Pino for structured logs.
- **IDE & Plugins**: VS Code, ESLint + Prettier, optional AI code helpers (Cursor, Windsurf).
- **Testing**: Jest or Mocha for unit and integration tests.

## 6. Non-Functional Requirements

- **Performance**: HTTP endpoints must respond within 200ms under light-to-moderate load. Worker jobs should process 1,000 records/minute per worker.
- **Scalability**: Horizontal scaling of workers; Redis and DB connection pooling.
- **Security**: Input validation to prevent injection attacks; sanitize file uploads; secure S3 buckets; use TLS for HTTP.
- **Reliability**: At-least-once job processing with retry/backoff; dead-letter queue for failed jobs.
- **Usability**: Clear, consistent JSON response formats. Meaningful error messages with HTTP status codes.
- **Compliance**: GDPR considerations for PII in data generation/export; secure credential management via environment vars or secrets manager.

## 7. Constraints & Assumptions

- Redis and database services must be provisioned and reachable.
- Workers run separately from the HTTP server, each with appropriate permissions.
- No user authentication in v1; assume trusted clients.
- File uploads capped at 100MB per request.
- Environment variables are set correctly for each deployment environment.
- Prisma migrations must be applied before server start.

## 8. Known Issues & Potential Pitfalls

- **Large File Uploads**: Risk of memory exhaustion if not streamed. Mitigation: use streaming parsers (e.g., `multer` with `file.stream`).
- **Queue Backlog**: If workers lag, jobs pile up. Mitigation: implement auto-scaling alerts for worker processes.
- **Database Connection Limits**: High concurrency could exhaust pool. Mitigation: tune connection pool size and reuse Prisma clients.
- **Job Duplication**: At-least-once semantics can cause duplicates. Mitigation: idempotent job handlers (check if data already exists before writing).
- **Error Handling Gaps**: Uncaught exceptions may crash workers. Mitigation: global exception handlers and process supervisors (e.g., PM2).
- **Timeouts**: Long-running jobs may exceed default queue timeouts. Mitigation: configure per-job timeouts and adjust as needed.

---
This PRD outlines all components, flows, and expectations needed for AI-driven generation of technical docs (Tech Stack Doc, Frontend Guidelines, Backend Structure, etc.) without ambiguity. It can serve as the single source of truth for subsequent design and implementation documents.