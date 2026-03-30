-- Add live probe fields to health_summary
ALTER TABLE health_summary ADD COLUMN call_success_rate REAL DEFAULT NULL;
ALTER TABLE health_summary ADD COLUMN probe_type TEXT DEFAULT NULL;
ALTER TABLE health_summary ADD COLUMN last_probe_details TEXT DEFAULT NULL;
