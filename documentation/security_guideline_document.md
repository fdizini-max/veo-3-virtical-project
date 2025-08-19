# Security Guidelines for **veo-3-vertical-project**

This document provides security best practices and implementation guidance specifically tailored to the Node.js/TypeScript backend of the veo-3-vertical-project. It covers all phases of development—from design and coding through deployment and maintenance—to ensure that data generation, file uploads, and data exports are handled securely by default.

---

## 1. Security by Design

- Embed security from the start. Treat each module (routes, middleware, queues, config) as potentially exposed to adversaries.
- Maintain a security checklist alongside feature specifications. For every new endpoint or worker, verify authentication, validation, error handling, and logging.
- Conduct periodic threat modeling (e.g., STRIDE) to identify risks in data generation, file parsing, queue processing, and storage flows.

## 2. Authentication & Access Control

> Version 1 currently trusts clients. Plan to add auth in subsequent releases.

- Even in v1, limit exposure by running behind an API gateway or firewall. Whitelist IPs if only known services should call these endpoints.
- When introducing authentication:
  - Use strong, salted password hashes (bcrypt/Argon2) if you store credentials.
  - Issue JSON Web Tokens (JWT) with a secure algorithm (e.g., RS256), validate `exp` and `aud` claims, and rotate signing keys regularly.
  - Enforce Role-Based Access Control (RBAC) for `/generate`, `/upload`, `/export`, and `/status/:jobId` to prevent unauthorized usage.
  - Protect admin or status-check endpoints with multi-factor authentication (MFA) where appropriate.

## 3. Input Validation & Output Encoding

### a. JSON Payloads (Generate / Export)
- Use a schema validation library (e.g., `joi`, `zod`) in `generation.routes.ts` and `export.routes.ts` to enforce field presence, types, ranges, and length limits.
- Reject requests with unknown or extra properties. Return uniform `400 Bad Request` errors without leaking internal details.

### b. File Uploads (upload.middleware.ts)
- Restrict accepted MIME types and file extensions (e.g., `.csv`, `.json`).
- Enforce maximum file size (e.g., 100 MB) and abort streaming on violation to prevent DoS.
- Sanitize filenames or generate your own storage keys to prevent path traversal.
- Scan file content for malware using an external service or library where possible.

### c. Queue Payloads
- Validate job payloads before enqueuing in `generation.queue.ts` and `export.queue.ts`.
- Encode and/or escape any dynamic data consumed by workers to prevent injection into shell commands or queries.

## 4. Data Protection & Privacy

- Use TLS 1.2+ for all HTTP traffic. Enforce HTTPS in Express (e.g., via `helmet()` or reverse-proxy config).
- Encrypt sensitive data at rest:
  - Ensure database storage uses transparent data encryption (TDE) if available (e.g., PostgreSQL TDE).
  - Encrypt exported files in S3 (e.g., SSE-S3 or SSE-KMS).
- Never log or expose PII or secrets (API keys, database URLs) in plaintext. Mask or redact these in logs and error messages.
- Keep secrets out of source code. Use environment variables with a secure vault (AWS Secrets Manager, HashiCorp Vault) or encrypted `.env` files.

## 5. Secure Session & API Management

- If you introduce sessions, set cookies with `HttpOnly`, `Secure`, and `SameSite=Strict`.
- Implement CSRF protection if you add browser-based clients (e.g., synchronizer tokens in Express or use modules like `csurf`).
- Enforce strict CORS policies. Only allow trusted origins to call the API and reject all others.
- Use appropriate HTTP methods: GET for status/read, POST for create/enqueue, DELETE for cancel jobs, etc.
- Return minimal error information—avoid stack traces or internal identifiers in responses.

## 6. Rate Limiting & Throttling

- Protect endpoints against brute-force and DoS by applying rate limits (e.g., `express-rate-limit`) per IP or API key.
- For critical flows (`/generate`, `/upload`, `/export`), implement quotas or per-user limits to prevent abuse.

## 7. Queue & Worker Security

- Secure Redis:
  - Require authentication (`requirepass`), bind to localhost or private subnets, and enable TLS if supported.
  - Run Redis with the least privileges, disabling commands you don’t need (e.g., `CONFIG`, `DEBUG`).
- Enable job retries with exponential backoff, but cap the number to prevent infinite loops.
- Monitor and quarantine failed jobs (dead-letter queue) rather than reprocessing indefinitely.

## 8. Secure Coding & Dependency Management

- Use the latest LTS versions of Node.js and keep dependencies up to date. Run an SCA tool (e.g., `npm audit`, Snyk) in CI.
- Employ lockfiles (`package-lock.json` or `yarn.lock`) to freeze transitive dependencies.
- Vet third-party libraries for activity, issue history, and licensing before inclusion.
- Apply ESLint (with security plugins) and Prettier to enforce a consistent, readable code style.

## 9. Infrastructure & Configuration Hardening

- **Server Hardening**: Disable unnecessary ports and services. Keep the OS patched. Use a minimal base image (e.g., Alpine) for Docker builds.
- **TLS Configuration**: Disable weak cipher suites and protocols (SSLv3, TLS 1.0/1.1). Enable HSTS and OCSP stapling.
- **Environment Segregation**: Maintain separate Redis, database, and storage instances for dev/test/prod.
- **File System Permissions**: Run Node.js processes under a non-root user. Restrict write permissions to only required directories (e.g., upload temp folder).
- **No Debug in Production**: Turn off verbose logging, stack traces, and interactive debugging in production builds.

## 10. Logging, Monitoring & Incident Response

- Use structured logging (Winston/Pino) with correlation IDs to trace a request through routes, middleware, and workers.
- Emit logs at appropriate levels (INFO for successful operations, WARN for recoverable errors, ERROR for failures).
- Integrate with a log aggregation and alerting solution (e.g., ELK Stack, Datadog, CloudWatch) to detect anomalies and job failures.
- Define an incident response plan: who is notified on alerts, how to rotate compromised secrets, and rollback procedures.

---

By adhering to these guidelines, the veo-3-vertical-project codebase will maintain a strong security posture, minimizing risks and ensuring data integrity and confidentiality throughout its lifecycle. Regularly review and update this document as the project evolves and new threats emerge.