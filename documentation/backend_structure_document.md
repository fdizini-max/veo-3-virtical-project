# Backend Structure Document

## 1. Backend Architecture

### Overview
This backend is a modular, event-driven Node.js service built with TypeScript. It follows a clear separation of concerns:

- **Routes Layer:** Defines HTTP endpoints and handles incoming requests.
- **Middleware Layer:** Processes cross-cutting concerns (file parsing, validation, logging) before requests reach route handlers.
- **Service/Worker Layer:** Contains business logic for data generation, file processing, and exports. Heavy tasks are delegated to background workers via queues.
- **Data Layer:** Uses Prisma ORM to interact with a PostgreSQL database, abstracting raw SQL into type-safe calls.
- **Queue Layer:** Employs BullMQ (Redis-backed) to offload time-consuming jobs from the API, keeping responses fast and non-blocking.

### Key Design Patterns and Frameworks

- **Modular Monolith:** While it runs as a single service, functionality is split into modules (routes, middleware, services, queues), making it easy to maintain and test.
- **Middleware Pattern:** Common in Express.js, this pattern ensures file uploads and input validations run automatically for matching routes.
- **Repository/ORM Pattern:** Prisma serves as the repository layer, providing a clean, type-safe interface to the relational database.
- **Queue-Based Asynchronous Processing:** The Pub/Sub style with BullMQ decouples HTTP requests from long-running tasks, improving scalability and API responsiveness.

### Scalability, Maintainability, Performance

- **Scalability:** Additional API instances and worker processes can be added horizontally. Redis and PostgreSQL scale independently.
- **Maintainability:** Clear folder structure and TypeScript typing reduce bugs and make onboarding new developers straightforward.
- **Performance:** HTTP endpoints remain sub-200 ms by immediately enqueueing jobs. Background workers handle heavy lifting without blocking.

---

## 2. Database Management

### Database Technology

- Type: **Relational (SQL)**
- System: **PostgreSQL**
- ORM: **Prisma**

### Data Storage and Access

- **Data Models:** Defined in `schema.prisma`, Prisma generates a client for all database interactions.
- **Migrations:** Managed via Prisma Migrate, version-controlling schema changes.
- **Connection Pooling:** Prisma client reuses connections to handle multiple queries efficiently.
- **Backups & Restore:** Regular automated backups (e.g., daily snapshots) with point-in-time recovery enabled.

### Data Management Practices

- Environment-specific databases (development, staging, production)
- Enforced input validation via middleware to prevent bad data
- Use of transactions for multi-step operations (e.g., enqueueing plus DB record create)
- Archival or cleanup policy for old jobs and generated data

---

## 3. Database Schema

### Human-Readable Overview

1. **jobs**
   - Tracks every queued task (generation, export, upload).
2. **uploaded_files**
   - Stores metadata for each file a user uploads.
3. **(Optional) generated_data**
   - A placeholder: actual data tables depend on generation parameters (e.g., `users`, `products`).

### PostgreSQL Schema Definition (SQL)

```sql
-- 1. jobs table --------------------------------------------------------------
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('generation','export','upload')),
  params JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','in-progress','completed','failed')),
  result_uri TEXT,          -- e.g., S3 link or file path
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. uploaded_files table ---------------------------------------------------
CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Example generated_data table -------------------------------------------
-- This is a template; actual columns depend on what data you generate.
CREATE TABLE generated_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. API Design and Endpoints

### Approach
- **Style:** RESTful
- **Data Format:** JSON for requests and responses
- **Authentication:** None in v1 (trusted clients), but designed to add token-based auth later

### Key Endpoints

| Method | Path               | Purpose                                        | Response                         |
|--------|--------------------|------------------------------------------------|----------------------------------|
| GET    | `/`                | Health check (service status, DB & Redis)      | JSON with service name, version  |
| POST   | `/generate`        | Enqueue a data generation job                  | 202 Accepted + `{ jobId }`       |
| POST   | `/upload`          | Handle file uploads                            | 201 Created + `{ jobId }`        |
| POST   | `/export`          | Enqueue a data export job                      | 202 Accepted + `{ jobId }`       |
| GET    | `/status/:jobId`   | Retrieve job status and result link if ready   | JSON with `status`, `resultUri`  |

### Communication Flow
1. **Client** calls an endpoint with required payload.
2. **Middleware** validates inputs and handles file streaming.
3. **Route Handler** enqueues a job and creates a `jobs` record.
4. **API** immediately responds with job identifier.
5. **Worker Process** picks up the job, performs the work (DB writes, file export), updates `jobs.status` and `result_uri`.
6. **Client** polls `/status/:jobId` to learn when the work is complete.

---

## 5. Hosting Solutions

### Cloud Providers
- **AWS** (recommended) using:
  - **ECS/EKS** or AWS Fargate for containerized services
  - **RDS (PostgreSQL)** for the database
  - **ElastiCache (Redis)** for queues
  - **S3** for file storage
- **Alternatives:** GCP Compute Engine + Cloud SQL + Memorystore, Azure App Service + Azure Database + Azure Cache for Redis

### Benefits
- **Reliability:** Managed services with high availability SLAs
- **Scalability:** Easy to add more containers, scale database read replicas, or increase Redis nodes
- **Cost-Effectiveness:** Pay-as-you-go; scale down in off-peak

---

## 6. Infrastructure Components

- **Load Balancer (e.g., AWS ALB):** Distributes API traffic across multiple container instances
- **Queue Service (BullMQ + Redis):** Manages job queues with retry policies and back-off strategies
- **CDN (e.g., CloudFront):** Optional, to serve exported files or a static dashboard
- **Object Storage (S3):** Stores uploads and generated exports
- **Configuration Store:** Environment variables (via `.env` or Secrets Manager) for credentials and endpoints
- **Container Orchestrator (ECS/EKS/Docker Swarm):** Manages container lifecycle, auto-scaling, and restarts

---

## 7. Security Measures

- **Transport Encryption:** HTTPS/TLS for all HTTP traffic
- **Input Validation:** Schemas for JSON bodies and file uploads to block malformed requests
- **Parameterized Queries:** Prisma uses parameterized SQL to prevent injection
- **Secrets Management:** No hard-coded credentials; use environment variables or a secrets store
- **Network Controls:** Restrict database and Redis access via VPC, security groups, or firewall rules
- **File Storage Permissions:** S3 buckets with least-privilege IAM policies
- **Future-Proofing:** Designed to layer on OAuth2/JWT authentication when needed

---

## 8. Monitoring and Maintenance

### Monitoring Tools
- **Application Logs:** Structured logs via Winston or Pino, forwarded to CloudWatch, Datadog, or ELK stack
- **Metrics & Alerts:** Prometheus + Grafana (or CloudWatch Metrics) to track CPU, memory, queue length, DB connections
- **Error Tracking:** Sentry or similar for uncaught exceptions and worker failures
- **Queue Dashboard:** Bull Board or Arena for real-time job status and failure inspection

### Maintenance Strategies
- **Automated Health Checks:** Container health endpoints and readiness probes
- **Auto-Scaling Policies:** Increase/decrease worker and API instances based on CPU or queue backlog
- **Scheduled Backups:** Daily DB snapshots and periodic Redis backups
- **Dependency Updates:** Regularly run `npm audit` and update packages via CI/CD pipelines
- **Database Migrations:** Safe rollout of Prisma migrations with zero-downtime strategies

---

## 9. Conclusion and Overall Backend Summary

This backend is a scalable, maintainable Node.js/TypeScript service designed around asynchronous job processing. By combining Express.js, Prisma ORM, and BullMQ (Redis), it keeps HTTP responses fast, offloads heavy tasks to background workers, and provides clear job-tracking via a relational database. Hosted on cloud platforms with containerization and managed services, it ensures high availability, security, and cost-effectiveness. The modular architecture, strong typing, and well-defined infrastructure components make it easy to extend—whether you add authentication, new data models, or a user interface on top—while keeping the core system reliable and performant.