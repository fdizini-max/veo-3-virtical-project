flowchart TD
    A[Start Client Request] --> B[API Entry Point]
    B --> C{Request Type}
    C -->|Generate| G1[Validate Generate Input]
    G1 --> G2[Enqueue Generation Job]
    G2 --> G3[Send 202 Accepted]
    G2 --> W1[Worker Picks Generation Job]
    W1 --> W2[Prisma Writes Data]
    W2 --> W3[Update Job Status to Completed]
    C -->|Upload| U1[Upload Middleware Streams File]
    U1 --> U2[Validate File]
    U2 --> U3[Store File]
    U3 --> U4[Send 201 Created]
    C -->|Export| E1[Validate Export Input]
    E1 --> E2[Enqueue Export Job]
    E2 --> E3[Send 202 Accepted]
    E2 --> W4[Worker Picks Export Job]
    W4 --> W5[Query DB and Transform Data]
    W5 --> W6[Store Export File]
    W6 --> W7[Update Job Status with Link]
    G3 --> S1[Client Polls Status]
    E3 --> S1
    U4 --> S1
    W3 --> S2[Job Completed in DB]
    W7 --> S2
    S1 --> S3[GET Status with Job ID]
    S3 --> S4[Return Status and Download Link]