# Deployment Guide for Notefy

Your application is now configured for deployment! Here are the steps to deploy it to the web.

## 1. Architecture Overview

The application consists of three parts:
1.  **Node.js Backend**: Serves the API and the static Frontend files.
2.  **Python Worker**: Handles heavy tasks like OCR and PowerPoint parsing.
3.  **Redis**: Used as a message queue between Node.js and Python.

## 2. Deployment Options

### Option A: Docker (Recommended)
We have created a `docker-compose.yml` file that orchestrates all services. This is the easiest way to deploy on a VPS (Virtual Private Server) like DigitalOcean, Linode, or AWS EC2.

**Steps:**
1.  Install Docker and Docker Compose on your server.
2.  Copy the entire project to the server.
3.  Run:
    ```bash
    docker-compose up -d --build
    ```
4.  Your app will be available at `http://<your-server-ip>:4000`.

### Option B: Cloud PaaS (Render/Railway)
You can deploy each service individually.

1.  **Redis**: Create a Redis instance (e.g., on Upstash or Render).
2.  **Python Worker**: Deploy `Backend/python-worker` as a Web Service.
    - Build Command: `pip install -r requirements.txt`
    - Start Command: `uvicorn main:app --host 0.0.0.0 --port 8000`
3.  **Node Backend**: Deploy the root repository (or `Backend` folder if possible, but it needs access to `Frontend`).
    - **Important**: If deploying only `Backend`, you must ensure `Frontend` files are copied or available. Docker is safer here.
    - Environment Variables:
        - `REDIS_URL`: URL from Step 1.
        - `PYTHON_WORKER_URL`: URL from Step 2.
        - `JWT_SECRET`: A random secret string.

## 3. Changes Made
We have automatically applied the following changes to make your app production-ready:
- **Backend/server.js**: Now serves the `Frontend` static files directly. No need for a separate frontend server.
- **Backend/server.js**: Now uses `process.env.PORT` for flexibility.
- **Frontend/editor.html**: Removed hardcoded API URL. It now automatically connects to the backend serving it.
- **Docker Config**: Added `Dockerfile`s and `docker-compose.yml`.

## 4. Next Steps
- **Database**: The current setup uses an in-memory user store. For production, you should uncomment the PostgreSQL code in `server.js` and set up a real database.
- **Security**: Change the `JWT_SECRET` in `docker-compose.yml` or your environment variables.
