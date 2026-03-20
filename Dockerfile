# Dockerfile
FROM node:24-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    python3 \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy pnpm workspace configurations
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./

# Copy the bot application
COPY artifacts/whatsapp-bot/ ./artifacts/whatsapp-bot/

# Install dependencies specifically for the whatsapp-bot
# We use --prod to keep the image small, but pnpm will still need git
RUN pnpm install --filter @workspace/whatsapp-bot...

# Pre-download yt-dlp (Linux version for the container)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /app/artifacts/whatsapp-bot/yt-dlp \
    && chmod a+rx /app/artifacts/whatsapp-bot/yt-dlp

# Set working directory to the bot app
WORKDIR /app/artifacts/whatsapp-bot

# Ensure ephemeral directories exist
RUN mkdir -p downloads session

# Port for the dashboard (Railway automatically detects PORT)
ENV PORT=5000
EXPOSE 5000

# Start the bot
CMD ["node", "--max-old-space-size=512", "index.js"]
