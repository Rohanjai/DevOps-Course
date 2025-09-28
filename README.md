# DevOps - Exercise 1

This repository contains a simple system with three services, implemented in **different technologies**:

## Requirements

- **Docker** ≥ 20.x
- **Docker Compose** ≥ 3.x
- Git

## System Architecture

- **Service1** – Node.js (Express)

  - The **only service accessible from outside**.
  - Collects system uptime and free disk space.
  - Stores logs in:
    - Shared file volume `vstorage`
    - Storage service
  - Forwards requests to **Service2**.
  - Combines status from Service1 and Service2 and returns.
  - Endpoints:
    - `GET /status` → Analyze uptime, space, and append new log entry (`text/plain`)
    - `GET /log` → Retrieve all logs (`text/plain`)

- **Service2** – Python (FastAPI)

  - Collects system uptime and free disk space.
  - Stores logs in:
    - Shared file volume `vstorage`
    - Storage service
  - Returns status info back to Service1.
  - Endpoints:
    - `GET /status` → Analyze uptime, space, and append new log entry (`text/plain`)

- **Storage** – Go (HTTP Server)

  - Simple REST API for persistent logs.
  - `storageVolume`: a named Docker volume mounted only into Storage at `/storage` and used to persist its internal `logs.txt`.
  - Persists logs between container restarts using Docker volumes.
  - Endpoints:
    - `POST /log` → Append new log entry (`text/plain`)
    - `GET /log` → Retrieve all logs (`text/plain`)

- **vstorage** – Host file `./vstorage` mounted into Service1 and Service2 at `/vStorage` and appended per request. This is the simple shared file method.

- **Networking**
  - A single user-defined `my_network` network connects all three services. Only Service1 publishes a host port.

## How to Run

1. Clone the repository using the command:
   ```bash
   git clone -b exercise1 https://github.com/Rohanjai/DevOps-Course.git
   ```
2. Navigate to the project directory:  
   ```bash
   cd DevOps-Course
   ```
3. Build and start the services:  
   ```bash
   docker-compose up --build -d
   ```
4. Wait ~10 seconds for the services to initialize.
5. Test the status flow:  
   ```bash
   curl localhost:8199/status
   ```
6. Fetch the first storage log:  
   ```bash
   curl localhost:8199/log
   ```
7. Fetch the second storage log:  
   ```bash
   cat ./vstorage
   ```
8. Stop the services:  
   ```bash
   docker-compose down
   ```

### Cleanup Instructions

- Clean the logs from host-file storage:  
  `> ./vstorage`
- Remove the named volume for Storage:  
  `docker volume rm devops_storageVolume`
