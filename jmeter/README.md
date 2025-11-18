# JMeter Load Testing Guide

## Prerequisites

1. **Install JMeter**:
   ```bash
   brew install jmeter
   ```

2. **Verify Installation**:
   ```bash
   jmeter --version
   ```

## Test Scenarios

### 1. Concurrent Booking Test
Tests the system's ability to handle multiple users booking seats simultaneously.

**Objective**: Verify no double bookings occur under high concurrency

**Configuration**:
- Thread Count: 100 users
- Ramp-up Period: 10 seconds
- Loop Count: 5
- Expected Result: All bookings succeed without conflicts

### 2. Race Condition Test
Tests transaction isolation and seat locking mechanism.

**Objective**: Ensure SERIALIZABLE isolation prevents race conditions

**Configuration**:
- Thread Count: 50 users
- Ramp-up Period: 1 second (aggressive)
- Target: Same showtime and seats
- Expected Result: Only one booking succeeds per seat

### 3. OLAP Query Performance Test
Tests analytics queries under load.

**Objective**: Verify OLAP database can handle read-heavy workload

**Configuration**:
- Thread Count: 50 users
- Ramp-up Period: 5 seconds
- Loop Count: 20
- Expected Result: Response time < 2 seconds

### 4. Mixed Workload Test
Simulates realistic usage with booking + analytics queries.

**Objective**: Test system under combined OLTP and OLAP load

**Configuration**:
- OLTP Threads: 100 users (bookings)
- OLAP Threads: 30 users (analytics)
- Duration: 5 minutes
- Expected Result: Both workloads perform well

## Running Tests

### Option 1: GUI Mode (Development)
```bash
jmeter -t jmeter/booking-load-test.jmx
```

### Option 2: CLI Mode (Production)
```bash
jmeter -n -t jmeter/booking-load-test.jmx -l results/test-results.jtl -e -o results/report
```

### Option 3: Using Docker
```bash
docker run --rm \
  --network olap-oltp_default \
  -v $(pwd)/jmeter:/jmeter \
  -v $(pwd)/results:/results \
  justb4/jmeter \
  -n -t /jmeter/booking-load-test.jmx \
  -l /results/test-results.jtl \
  -e -o /results/report
```

## Analyzing Results

### View HTML Report
```bash
open results/report/index.html
```

### Key Metrics to Check

1. **Response Time**:
   - Average: < 500ms
   - 90th Percentile: < 1000ms
   - 95th Percentile: < 2000ms

2. **Throughput**:
   - Target: > 100 requests/second

3. **Error Rate**:
   - Target: < 1%
   - Note: Some conflicts expected in race condition tests

4. **Database Metrics**:
   - Connection pool usage
   - Query execution time
   - Lock wait time
   - Replication lag

## Database Monitoring During Tests

### Monitor Active Connections
```bash
docker exec -it olap_oltp_primary psql -U postgres -d movies_primary -c "
SELECT 
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active,
    count(*) FILTER (WHERE state = 'idle') as idle,
    count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting
FROM pg_stat_activity 
WHERE datname = 'movies_primary';
"
```

### Monitor Locks
```bash
docker exec -it olap_oltp_primary psql -U postgres -d movies_primary -c "
SELECT locktype, relation::regclass, mode, granted 
FROM pg_locks 
WHERE NOT granted 
ORDER BY granted;
"
```

### Check Replication Lag
```bash
docker exec -it olap_oltp_backup psql -U postgres -c "
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
"
```

### Monitor Query Performance
```bash
docker exec -it olap_oltp_primary psql -U postgres -d movies_primary -c "
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
"
```

## Expected Outcomes

### ✅ Success Criteria

1. **No Double Bookings**: Each seat booked only once per showtime
2. **Transaction Safety**: SERIALIZABLE isolation prevents conflicts
3. **Performance**: Response times within acceptable limits
4. **Scalability**: System handles 100+ concurrent users
5. **Data Consistency**: OLAP reports match OLTP data

### ⚠️ Known Issues to Test

1. **Serialization Failures**: Some transactions will fail with conflict errors (expected behavior)
2. **Replication Lag**: OLAP queries may show slight delay
3. **Connection Limits**: Test max connection pool limits

## Test Data Validation

### Verify No Double Bookings
```sql
SELECT 
    showtime_id,
    seat_id,
    COUNT(*) as booking_count
FROM reservation_holds
GROUP BY showtime_id, seat_id
HAVING COUNT(*) > 1;
```

Expected: 0 rows (no double bookings)

### Check Booking Distribution
```sql
SELECT 
    DATE(booking_date) as date,
    COUNT(*) as bookings,
    SUM(total_amount) as revenue
FROM bookings
GROUP BY DATE(booking_date)
ORDER BY date DESC
LIMIT 10;
```

### Verify Data Replication
```sql
-- Compare counts between primary and reports databases
-- Primary
SELECT COUNT(*) FROM bookings;

-- Reports (should match after replication lag)
SELECT COUNT(*) FROM fact_bookings;
```

## Troubleshooting

### High Error Rate
- Check backend logs: `docker logs olap_oltp_backend`
- Monitor database connections
- Check for serialization errors (expected under high concurrency)

### Slow Response Times
- Check database query performance
- Monitor connection pool saturation
- Review indexes on hot tables

### Connection Pool Exhausted
- Increase pool size in backend configuration
- Reduce thread count in JMeter
- Implement connection timeout handling

## Next Steps

After load testing:
1. Analyze results and identify bottlenecks
2. Optimize queries and indexes
3. Tune database configuration
4. Implement caching if needed
5. Document performance characteristics
6. Create video demonstration
