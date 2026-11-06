-- Optional issue key for b25_learning_report_share. Nullable so V13 rows and
-- headerless issues stay unique-safe: InnoDB allows many NULLs in this index.
-- ascii_bin keeps Idempotency-Key case-sensitive. Upper and lower case are
-- different keys; the table default utf8mb4_unicode_ci would fold them.
ALTER TABLE b25_learning_report_share
    ADD COLUMN idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER principal_id,
    ADD COLUMN request_binding VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER idempotency_key,
    ADD UNIQUE KEY uq_b25_learning_report_share_idem (tenant_id, principal_id, idempotency_key);
