-- Cost intelligence fields on services
ALTER TABLE services ADD COLUMN pricing_model TEXT DEFAULT NULL;
ALTER TABLE services ADD COLUMN pricing_details TEXT DEFAULT NULL;
ALTER TABLE services ADD COLUMN cost_per_call REAL DEFAULT NULL;
ALTER TABLE services ADD COLUMN free_tier_limit INTEGER DEFAULT NULL;
ALTER TABLE services ADD COLUMN monthly_price REAL DEFAULT NULL;
