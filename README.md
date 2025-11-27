# 🎬 Movie Booking System - OLAP-OLTP Project

## Quick Start (Docker Swarm)

### Prerequisites
- Docker Desktop installed and running
- Docker Swarm initialized
- 8GB+ RAM available

### Initialize Swarm (First Time Only)
```bash
# Initialize Docker Swarm
docker swarm init

# Verify Swarm is active
docker info | grep Swarm
```

### Deploy Everything
```bash
# Navigate to project directory
cd /path/to/OLAP-OLTP

# Deploy the stack
docker stack deploy -c docker-compose.yml myapp

# Wait 2-3 minutes for initialization
docker stack ps myapp  # Check all services are running

# Watch services come online
docker stack services myapp
```

### Access the Application
- **🎬 Movie Booking:** http://72.61.112.223 (or http://localhost if running locally)
- **📊 Analytics Dashboard:** http://72.61.112.223/analytics
- **🗄️ Database Admin:** http://72.61.112.223:5050 (admin@admin.com / admin)

## 🎯 Try It Out

### 1. Book Movie Seats
1. Go to http://72.61.112.223
2. Select a date and movie
3. Click time slots to choose seats
4. Fill payment form and book

### 2. View Analytics
1. Go to http://72.61.112.223/analytics
2. See revenue trends, top movies, and peak booking hours
3. Interactive charts with hover details
4. **Note:** Analytics update every 5 minutes via ETL process

### 3. Test Race Conditions
1. Open 2 browser windows
2. Try booking the same seat at the same time
3. One succeeds, others get "Seats just taken" error ✅

## 🔧 Useful Commands

### Stack Management
```bash
# View all services
docker stack services myapp

# View service logs (replace service name)
docker service logs -f myapp_backend
docker service logs -f myapp_postgres-primary
docker service logs -f myapp_etl

# View detailed service status
docker stack ps myapp

# Scale a service (example: scale backend to 3 instances)
docker service scale myapp_backend=3

# Update the stack (after changing docker-compose.yml)
docker stack deploy -c docker-compose.yml myapp

# Remove the entire stack
docker stack rm myapp

# Leave Swarm mode (warning: removes all stacks)
docker swarm leave --force
```

### Database Access
```bash
# First, get the container name (they have dynamic names in Swarm)
docker ps --filter "name=myapp_postgres-primary"

# Access primary database (replace with actual container name)
docker exec -it myapp_postgres-primary.1.xyz123abc psql -U postgres -d movies_oltp

# Or use PowerShell to automate this
$primaryId = docker ps -q -f "name=myapp_postgres-primary"
docker exec -it $primaryId psql -U postgres -d movies_oltp

# Access reports database
$reportsId = docker ps -q -f "name=myapp_postgres-reports"
docker exec -it $reportsId psql -U postgres -d movies_olap
```

### Clean Restart (Removes All Data)
```bash
# Remove stack
docker stack rm myapp

# Wait for all containers to stop (verify with docker ps)
docker ps

# Remove all volumes (WARNING: deletes all data)
docker volume rm myapp_primary_data myapp_backup_data myapp_reports_data myapp_pgadmin_data myapp_wal_archive_data

# Redeploy
docker stack deploy -c docker-compose.yml myapp
```

## 📈 Load Testing (Optional)

### Generate Test Data
```bash
# Get primary container ID
primaryId=$(docker ps -q -f "name=myapp_postgres-primary")

# Generate realistic test data (5,000 bookings)
cat scripts/generate-realistic-dataset.sql | docker exec -i $primaryId psql -U postgres -d movies_oltp

# ETL will automatically sync data to analytics within 5 minutes
# Or manually trigger ETL:
$reportsId = docker ps -q -f "name=myapp_postgres-reports"
cat scripts/etl-oltp-to-olap.sql | docker exec -i $reportsId psql -U postgres -d movies_olap
```

### Run JMeter Load Tests
```bash
# 1. Deploy the test stack (runs the JMeter job once via docker-compose.yml)
docker stack deploy -c docker-compose.yml myapp

# 2. Check status, get the successful Task ID (e.g., t79qf0rystka), and confirm 'Shutdown Complete' state
docker service ps myapp_jmeter-load-test

# 3. Find the actual Container ID using the Task ID (e.g., t79qf0rystka)
docker inspect --format='{{.Status.ContainerStatus.ContainerID}}' t79qf0rystka

# 4. Copy the results file (.jtl) from the stopped container back to the host path
# NOTE: Replace the Container ID (4d1a48eddb22) with the value from Step 3.
docker cp 4d1a48eddb22:/jmeter/results.jtl "D:/Coding Files/STADVDB/MCO2/OLAP-OLTP/jmeter/results.jtl"

# 5. Optional: Remove the container after successful file retrieval
docker rm 4d1a48eddb22

```

## 🏗️ Architecture

### Service Overview
- **postgres-primary** (OLTP): Primary transactional database for bookings
- **postgres-backup**: Hot standby with streaming replication
- **postgres-reports** (OLAP): Analytics database with optimized star schema
- **backend**: Express.js API with dual database connections
- **frontend**: React + Nginx serving booking and analytics UI
- **pgadmin**: Database administration interface
- **etl**: Automated data sync (OLTP → OLAP every 5 minutes)

### Network Architecture
All services communicate via overlay network: `myapp_olap_oltp_network`

Service DNS names in Swarm:
- `postgres-primary` (not `myapp_postgres-primary`)
- `postgres-reports`
- `backend`
- `frontend`

## 📁 Project Structure

```
OLAP-OLTP/
├── docker-compose.yml       # Swarm stack configuration
├── ddl.sql                  # Database schema
├── backend/                 # Express API server
│   ├── server.js
│   ├── config/db.js         # Dual database pools
│   └── controllers/bookings.js
├── frontend/                # React application
│   ├── src/
│   │   ├── App.jsx          # Main booking page
│   │   └── Analytics.jsx    # Dashboard with charts
│   └── nginx.conf           # Reverse proxy config
├── scripts/
│   ├── init-primary.sql     # OLTP initialization
│   ├── init-reports.sql     # OLAP star schema
│   ├── postgresql-primary.conf
│   ├── postgresql-standby.conf
│   ├── pg_hba.conf
│   ├── etl-oltp-to-olap.sql # Data sync script
│   └── generate-realistic-dataset.sql
└── jmeter/                  # Load testing config
    └── booking-load-test-docker.jmx
```

## 🔍 Troubleshooting

### Services Won't Start
```bash
# Check Swarm is initialized
docker info | grep Swarm

# View detailed service status
docker stack ps myapp --no-trunc

# Check individual service logs
docker service logs myapp_postgres-primary
docker service logs myapp_backend
docker service logs myapp_etl

# Verify all config files exist
ls -la ddl.sql scripts/
```

### ETL Service Failing
```bash
# Check ETL logs
docker service logs myapp_etl

# Common issues:
# - Config file missing: Verify ./scripts/etl-oltp-to-olap.sql exists
# - Database not ready: Wait for postgres services to be healthy
# - Syntax error: Check docker-compose.yml ETL command formatting
```

### Database Schema Not Created
```bash
# This happens if volumes already exist from previous deployment
# Solution: Clean restart (see "Clean Restart" section above)

# Verify configs are mounted
$primaryId = docker ps -q -f "name=myapp_postgres-primary"
docker exec $primaryId ls -la /docker-entrypoint-initdb.d/

# Expected output:
# 01-schema.sql
# 02-replication.sql
```

### Can't Access Application
```bash
# Check all services are running
docker stack services myapp

# All should show 1/1 replicas

# Check backend health
curl http://localhost:3000/api/health

# Check frontend
curl http://localhost

# If backend shows 0/1, check logs
docker service logs myapp_backend
```

### Analytics Not Updating
```bash
# Check ETL service is running
docker service logs myapp_etl

# Should see "Running ETL process..." every 5 minutes

# Manually verify data sync
$reportsId = docker ps -q -f "name=myapp_postgres-reports"
docker exec $reportsId psql -U postgres -d movies_olap -c "SELECT COUNT(*) FROM fact_bookings;"

# If count is 0, manually run ETL
cat scripts/etl-oltp-to-olap.sql | docker exec -i $reportsId psql -U postgres -d movies_olap
```

### Database Connection Issues
```bash
# Test primary database
$primaryId = docker ps -q -f "name=myapp_postgres-primary"
docker exec $primaryId psql -U postgres -d movies_oltp -c "SELECT COUNT(*) FROM movies;"

# Test reports database
$reportsId = docker ps -q -f "name=myapp_postgres-reports"
docker exec $reportsId psql -U postgres -d movies_olap -c "SELECT COUNT(*) FROM fact_bookings;"

# Check replication status
docker exec $primaryId psql -U postgres -c "SELECT * FROM pg_stat_replication;"
```

## 🔄 Differences from Docker Compose

If you're familiar with the `docker-compose up` version:

| Feature | Docker Compose | Docker Swarm (This Version) |
|---------|---------------|---------------------------|
| Command | `docker-compose up -d` | `docker stack deploy -c docker-compose.yml myapp` |
| Container names | Fixed (e.g., `olap_oltp_primary`) | Dynamic (e.g., `myapp_postgres-primary.1.xyz`) |
| Config files | Bind mounts (e.g., `./ddl.sql:/path`) | Docker configs (read-only) |
| Scaling | Manual | Built-in orchestration |
| Service discovery | Container names | Service names (no stack prefix) |
| Networking | Bridge network | Overlay network |

## 📝 Development

For local development without Swarm, use the standard docker-compose.yml with bind mounts:

```bash
# Frontend development
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173

# Backend development
cd backend
npm install
node server.js  # Runs on http://localhost:3000
```

## 🚀 Production Considerations

- **Secrets Management**: Replace hardcoded passwords with Docker secrets
- **Volume Backups**: Implement automated backup strategy for named volumes
- **Monitoring**: Add Prometheus/Grafana for service monitoring
- **Load Balancing**: Scale services with `docker service scale`
- **Multi-node**: Deploy across multiple Swarm nodes for HA

---

<img width="1240" alt="Movie Booking Interface" src="https://github.com/user-attachments/assets/3393fe2c-d298-4916-9328-b24d436e21a7" />

<img width="391" alt="Analytics Dashboard" src="https://github.com/user-attachments/assets/b23fed8a-2f55-4203-a381-47a43ca89bed" />
