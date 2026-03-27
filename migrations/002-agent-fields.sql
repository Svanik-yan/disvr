-- Migration: Add agent-friendly fields to services table
-- Run: npx wrangler d1 execute disvr-db --remote --file=./migrations/002-agent-fields.sql

ALTER TABLE services ADD COLUMN install_command TEXT;
ALTER TABLE services ADD COLUMN install_runtime TEXT;
ALTER TABLE services ADD COLUMN runtime_version TEXT;
ALTER TABLE services ADD COLUMN service_type TEXT DEFAULT 'mcp_server';
ALTER TABLE services ADD COLUMN required_env TEXT;
ALTER TABLE services ADD COLUMN tools_provided TEXT;
