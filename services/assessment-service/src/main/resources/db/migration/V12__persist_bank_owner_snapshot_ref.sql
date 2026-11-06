-- New bank-backed sessions may carry the Content sealed snapshot id.
-- Older rows and sessions with no authoritative ref stay NULL. No backfill.
ALTER TABLE b10_assessment_session
    ADD COLUMN owner_snapshot_ref VARCHAR(132) NULL AFTER snapshot_hash;
