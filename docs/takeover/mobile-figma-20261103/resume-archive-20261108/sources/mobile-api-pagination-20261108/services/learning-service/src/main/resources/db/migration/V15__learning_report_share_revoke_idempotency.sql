-- Required revoke key for b25_learning_report_share. Nullable so V13/V14
-- rows stay unique-safe: InnoDB allows many NULLs in this index.
-- ascii_bin keeps Idempotency-Key case-sensitive. Upper and lower case are
-- different keys; the table default utf8mb4_unicode_ci would fold them.
ALTER TABLE b25_learning_report_share
    ADD COLUMN revoke_idempotency_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER request_binding,
    ADD COLUMN revoke_request_binding CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER revoke_idempotency_key,
    ADD UNIQUE KEY uq_b25_learning_report_share_revoke_idem (tenant_id, principal_id, revoke_idempotency_key);
