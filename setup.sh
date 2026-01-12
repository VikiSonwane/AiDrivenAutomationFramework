#!/bin/bash

# Setup script for Agentic QA Platform

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  🤖 Agentic QA Platform - Setup Script                       ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Check Node.js version
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version must be 20 or higher. Current: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Install Playwright browsers
echo ""
echo "🌐 Installing Playwright browsers..."
npx playwright install chromium
echo "✅ Chromium installed"

# Optional: Install all browsers
read -p "Install Firefox and WebKit browsers? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx playwright install firefox webkit
    echo "✅ Firefox and WebKit installed"
fi

# Setup environment file
echo ""
echo "⚙️  Setting up environment configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
    echo "⚠️  Important: Edit .env and add your API keys!"
    echo "   Required: ANTHROPIC_API_KEY or OPENAI_API_KEY"
else
    echo "ℹ️  .env file already exists"
fi

# Check for API keys
echo ""
if [ -f .env ]; then
    if grep -q "your_anthropic_key_here" .env || grep -q "your_openai_key_here" .env; then
        echo "⚠️  API keys not configured yet!"
        echo ""
        read -p "Do you want to configure your Anthropic API key now? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -p "Enter your Anthropic API key: " API_KEY
            if [ ! -z "$API_KEY" ]; then
                sed -i.bak "s/your_anthropic_key_here/$API_KEY/" .env
                rm .env.bak 2>/dev/null || true
                echo "✅ API key configured"
            fi
        fi
    else
        echo "✅ API keys configured"
    fi
fi

# Setup optional services
echo ""
read -p "Do you want to set up PostgreSQL and Redis with Docker? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed. Please install Docker first."
    else
        echo "🐳 Starting PostgreSQL and Redis..."
        docker-compose up -d postgres redis
        echo "✅ Database and cache services started"
        echo ""
        echo "Waiting for services to be ready..."
        sleep 5
        echo "✅ Services ready"
    fi
fi

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
npm run build
echo "✅ Build complete"

# Create directories
echo ""
echo "📁 Creating artifact directories..."
mkdir -p logs test-results screenshots videos traces allure-results
echo "✅ Directories created"

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  ✅ Setup Complete!                                           ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure your API keys in .env (if not done already)"
echo ""
echo "2. Start the API server:"
echo "   npm run api"
echo ""
echo "3. Run example tests:"
echo "   npm test tests/example-tests.spec.ts"
echo ""
echo "4. Try the web interface:"
echo "   Open src/ui/index.html in your browser"
echo ""
echo "5. Read the documentation:"
echo "   cat GETTING_STARTED.md"
echo ""
echo "For advanced usage, see ADVANCED_USAGE.md"
echo ""
