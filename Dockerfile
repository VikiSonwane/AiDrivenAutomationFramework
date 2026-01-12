FROM node:20-alpine

# Install Playwright dependencies
RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    firefox \
    webkit2gtk \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Install Playwright browsers
RUN npx playwright install --with-deps chromium firefox webkit

# Copy source code
COPY src ./src
COPY tests ./tests
COPY playwright.config.ts ./

# Build TypeScript
RUN npm run build

# Create directories for artifacts
RUN mkdir -p logs test-results screenshots videos traces

# Expose API port
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start"]
