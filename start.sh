#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  OLAP-OLTP Movie Booking System${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Check if docker-compose exists
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}⚠ docker-compose not found, trying 'docker compose'${NC}"
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
$COMPOSE_CMD down

# Build and start services
echo ""
echo -e "${GREEN}Building and starting all services...${NC}"
echo -e "${YELLOW}This may take 2-3 minutes on first run${NC}"
echo ""

$COMPOSE_CMD up -d --build

# Wait for services to be healthy
echo ""
echo -e "${YELLOW}Waiting for services to become healthy...${NC}"
echo ""

# Function to check if a service is healthy
check_health() {
    local service=$1
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        health=$($COMPOSE_CMD ps $service 2>/dev/null | grep -o "healthy" || echo "")
        if [ "$health" == "healthy" ]; then
            echo -e "${GREEN}✓ $service is healthy${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    echo -e "${RED}✗ $service failed to become healthy${NC}"
    return 1
}

# Check each service
check_health "postgres-primary"
check_health "postgres-reports"
check_health "backend"
check_health "frontend"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  🎉 System is ready!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "📱 Frontend:    ${GREEN}http://localhost${NC}"
echo -e "🔌 Backend API: ${GREEN}http://localhost:3000/api${NC}"
echo -e "🗄️  PgAdmin:     ${GREEN}http://localhost:5050${NC} (admin@admin.com / admin)"
echo ""
echo -e "${YELLOW}Database Ports:${NC}"
echo -e "  • Primary (OLTP):  ${GREEN}5432${NC}"
echo -e "  • Backup:          ${GREEN}5433${NC}"
echo -e "  • Reports (OLAP):  ${GREEN}5434${NC}"
echo ""
echo -e "${YELLOW}To view logs:${NC} docker-compose logs -f"
echo -e "${YELLOW}To stop:${NC}      docker-compose down"
echo ""
