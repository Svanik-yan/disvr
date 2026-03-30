-- Add install score fields to health_summary
ALTER TABLE health_summary ADD COLUMN install_score INTEGER DEFAULT NULL;
ALTER TABLE health_summary ADD COLUMN install_difficulty TEXT DEFAULT NULL;
ALTER TABLE health_summary ADD COLUMN install_details TEXT DEFAULT NULL;
