-- Replication setup

-- Create replication user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'replicator') THEN
        CREATE ROLE replicator WITH REPLICATION PASSWORD 'replicator' LOGIN;
    END IF;
END
$$;

GRANT CONNECT ON DATABASE movies_oltp TO replicator;

-- Create publication for logical replication
CREATE PUBLICATION reports_publication FOR TABLE 
    movies,
    auditoriums,
    showtimes,
    customers,
    reservation_holds,
    payments,
    tickets;

-- Create replication slot for backup server
SELECT pg_create_physical_replication_slot('backup_slot');

-- Monitoring view
CREATE OR REPLACE VIEW v_replication_status AS
SELECT 
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    sync_state,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replication_lag_bytes
FROM pg_stat_replication;

GRANT SELECT ON v_replication_status TO postgres;

