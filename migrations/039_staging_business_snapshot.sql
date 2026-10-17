-- Staging import recovery records. No production records are modified.
CREATE TABLE IF NOT EXISTS staging_snapshot_runs (
 id TEXT PRIMARY KEY,
 source_commit TEXT NOT NULL,
 captured_at TIMESTAMPTZ NOT NULL,
 imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 summary JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS staging_snapshot_backups (
 run_id TEXT NOT NULL REFERENCES staging_snapshot_runs(id),
 table_name TEXT NOT NULL,
 records JSONB NOT NULL,
 PRIMARY KEY(run_id,table_name)
);
