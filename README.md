# 🎬 Movie Booking System - OLAP-OLTP Project

## Quick Start

### Prerequisites
- Docker Desktop installed and running
- 8GB+ RAM available

### Run Everything
```bash
# Clone and navigate
cd /path/to/OLAP-OLTP

# Start all services
docker-compose up -d

# Wait 2-3 minutes for initialization
docker-compose ps  # Check all services are "healthy"
```

### Access the Application
- **🎬 Movie Booking:** http://localhost
- **📊 Analytics Dashboard:** http://localhost/analytics
- **🗄️ Database Admin:** http://localhost:5050 (admin@admin.com / admin)

## 🎯 Try It Out

### 1. Book Movie Seats
1. Go to http://localhost
2. Select a date and movie
3. Click time slots to choose seats
4. Fill payment form and book

### 2. View Analytics
1. Go to http://localhost/analytics
2. See revenue trends, top movies, and peak booking hours
3. Interactive charts with hover details

### 3. Test Race Conditions
1. Open 2 browser windows
2. Try booking the same seat at the same time
3. One succeeds, others get "Seats just taken" error ✅

## 🔧 Useful Commands

```bash
# View logs
docker-compose logs -f

# Restart everything
docker-compose restart

# Stop everything
docker-compose down

# Clean restart (removes data)
docker-compose down -v && docker-compose up -d

# Access primary database
docker exec -it olap_oltp_primary psql -U postgres -d movies_oltp

# Access reports database
docker exec -it olap_oltp_reports psql -U postgres -d movies_olap
```

## 📈 Load Testing (Optional)

```bash
# Generate realistic test data (5,000 bookings)
cat scripts/generate-realistic-dataset.sql | docker exec -i olap_oltp_primary psql -U postgres -d movies_oltp

# Sync to analytics database
cat scripts/etl-oltp-to-olap.sql | docker exec -i olap_oltp_reports psql -U postgres -d movies_olap

# Run JMeter load tests
docker run --rm --network olap_oltp_network \
  -v $(pwd)/jmeter:/jmeter justb4/jmeter \
  -n -t /jmeter/booking-load-test-docker.jmx \
  -l /jmeter/results.jtl

# Results: ~120 req/sec, 18ms avg, 0 double bookings ✅
```

##  Project Structure

```
OLAP-OLTP/
├── docker-compose.yml       # Container orchestration
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
│   ├── init-primary.sql     # OLTP schema
│   ├── init-reports.sql     # OLAP schema
│   ├── generate-realistic-dataset.sql
│   └── etl-oltp-to-olap.sql
└── jmeter/                  # Load testing config
    └── booking-load-test-docker.jmx
```

## 🔍 Troubleshooting

### Services Won't Start
```bash
# Check Docker is running
docker --version

# View detailed logs
docker-compose logs

# Clean restart
docker-compose down -v && docker-compose up -d
```

### Can't Access Application
```bash
# Check all services are healthy
docker-compose ps

# Verify backend is responding
curl http://localhost:3000/api/schedule

# Check frontend
curl http://localhost
```

### Database Connection Issues
```bash
# Test primary database
docker exec -it olap_oltp_primary psql -U postgres -d movies_oltp -c "SELECT COUNT(*) FROM movies;"

# Test reports database
docker exec -it olap_oltp_reports psql -U postgres -d movies_olap -c "SELECT COUNT(*) FROM fact_bookings;"
```

## 📝 Development

```bash
# Frontend development (without Docker)
cd frontend
npm install
npm run dev  # Runs on http://localhost:5173

# Backend development (without Docker)
cd backend
npm install
node server.js  # Runs on http://localhost:3000
```

<img width="1240" height="597" alt="image" src="https://github.com/user-attachments/assets/3393fe2c-d298-4916-9328-b24d436e21a7" />
<img width="391" height="810" alt="image" src="https://github.com/user-attachments/assets/b23fed8a-2f55-4203-a381-47a43ca89bed" />


