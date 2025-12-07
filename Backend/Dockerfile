FROM node:18-alpine

WORKDIR /app

# Copy package files first for caching
COPY Backend/package*.json ./Backend/

# Install dependencies
WORKDIR /app/Backend
RUN npm install --production

# Copy source code
COPY Backend/ .
COPY Frontend/ ../Frontend/

# Expose port
EXPOSE 4000

# Start server
CMD ["node", "server.js"]
