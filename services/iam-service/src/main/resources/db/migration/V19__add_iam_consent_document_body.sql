-- Additive nullable plain-text column for the authenticated principal projection.
-- Preexisting control-plane rows stay without a body. This migration adds no rows.
-- utf8mb4 MEDIUMTEXT holds the contract maximum of 65536 characters (up to 262144 bytes).
ALTER TABLE iam_consent_document_version
  ADD COLUMN document_body MEDIUMTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
  ADD CONSTRAINT chk_iam_consent_document_body_length
    CHECK (document_body IS NULL OR CHAR_LENGTH(document_body) BETWEEN 1 AND 65536);
