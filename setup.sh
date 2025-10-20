#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

print_info "Starting setup for Solana Tracer..."
echo ""

# Check for required dependencies
print_info "Checking for required dependencies..."

if ! command_exists docker; then
    print_error "Docker is not installed. Please install Docker first."
    print_info "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi
print_success "Docker found: $(docker --version)"

# Check if user has permission to run Docker
if ! docker ps >/dev/null 2>&1; then
    print_warning "Docker daemon is not accessible. You may need to configure permissions."
    echo ""
    print_info "If you just installed Docker, add your user to the docker group:"
    echo "  sudo usermod -aG docker \$USER"
    echo "  newgrp docker"
    echo ""
    print_info "Then run this setup script again."
    echo ""
    print_info "Alternatively, you can run this script with sudo: (not recommended)"
    echo "  sudo bash setup.sh"
    echo ""
    exit 1
fi

if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
print_success "Docker Compose found"

echo "" 

# Start Docker containers
print_info "Starting Docker containers (PostgreSQL)..."
if docker compose up -d; then
    print_success "Docker containers started"
else
    print_error "Failed to start Docker containers"
    exit 1
fi

# Install dependencies
print_info "Installing dependencies..."
npm install
print_success "Dependencies installed"

# Run Prisma migrations
print_info "Running Prisma migrations..."
npx prisma generate
npx prisma db push
print_success "Prisma migrations completed"

echo ""
echo "================================================"
print_success "Setup completed successfully!"
echo "================================================"
echo ""
print_info "Everything is ready! You can now:"
echo "  - Run 'npm run dev' to start both backend and frontend"
echo "  - Backend will typically run on http://localhost:3000"
echo "  - Frontend will typically run on http://localhost:5173"
echo ""
print_info "Useful commands:"
echo "  - Stop database: docker compose down"
echo "  - Reset database: docker compose down -v"
echo "  - View database: docker exec -it solana-tools-postgres psql -U solana_user -d solana_tools"
echo "  - View logs: docker compose logs -f"
echo ""

