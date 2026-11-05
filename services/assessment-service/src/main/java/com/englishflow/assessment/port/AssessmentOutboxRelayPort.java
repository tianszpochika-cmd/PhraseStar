package com.englishflow.assessment.port;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Dormant claim/lease/mark view of the assessment outbox.
 *
 * <p>The claim transaction commits before any later publish attempt, so a row lock is never held
 * across a broker round trip. This port does not publish, schedule, or rewrite a stored envelope.
 * Only canonical {@code assessment.item.assessed.v2} rows are eligible.
 */
public interface AssessmentOutboxRelayPort {

    /** Registered attempt budget. The fifth stored attempt is the last one that may publish. */
    int MAX_ATTEMPTS = 5;

    /**
     * Broker failures that stay on the attempt budget. Any other short safe token that is not
     * permanent does too. Unsafe text is stored as {@code UNCLASSIFIED} and stays on that budget.
     */
    List<String> RETRYABLE_FAILURE_CODES = List.of(
            "TIMEOUT",
            "TEMPORARY_UNAVAILABLE",
            "CONFLICT_RETRYABLE");

    /**
     * Terminal failures. A live lease moves to owner-row {@code DLQ} immediately, with no extra publish.
     */
    List<String> PERMANENT_FAILURE_CODES = List.of(
            "SCHEMA_INVALID",
            "FORBIDDEN",
            "OWNER_MISMATCH",
            "STALE_VERSION");

    /**
     * A row claimed for a later publish attempt.
     *
     * <p>{@code attemptCount} is the value stored by this claim. {@code leaseToken} is the opaque
     * value written to {@code locked_by} and required to mark the same attempt.
     * {@code eventVersion} is the integer carried in the stored envelope. {@code payloadJson} is
     * the stored envelope text.
     */
    record ClaimedEvent(
            String eventId,
            String aggregateId,
            String eventName,
            String schemaVersion,
            int eventVersion,
            String dedupeKey,
            String payloadJson,
            String requestId,
            String traceId,
            int attemptCount,
            String leaseToken) {
    }

    /**
     * Claims up to {@code batchSize} due canonical rows with {@code FOR UPDATE SKIP LOCKED}.
     * Each claimed row receives its own new token, lease expiry, and one attempt increment inside
     * that short transaction.
     */
    List<ClaimedEvent> claim(Instant now, int batchSize, Duration lease);

    /**
     * Marks the row published when {@code eventId} is still {@code PUBLISHING} under
     * {@code leaseToken} and the lease has not expired at {@code now}.
     *
     * @return {@code true} only when that fenced update changed the row
     */
    boolean markPublished(String eventId, String leaseToken, Instant now);

    /**
     * Records an explicit failure of the current lease. A live matching token moves the row to
     * {@code RETRY} at {@code availableAt}, or to {@code DLQ} once the attempt budget is spent.
     * A code in {@link #PERMANENT_FAILURE_CODES} moves that same live lease to {@code DLQ}
     * immediately and stores {@code now} as {@code available_at}. Codes in
     * {@link #RETRYABLE_FAILURE_CODES} keep the attempt constraint. The stored error text is the
     * fixed phrase {@code publish failed}; {@code errorCode} is kept only when it is a short safe
     * token, otherwise {@code UNCLASSIFIED}.
     *
     * @return {@code true} only when that fenced update changed the row
     */
    boolean markFailed(String eventId, String leaseToken, Instant now, Instant availableAt, String errorCode);

    /**
     * Moves canonical rows whose publishing lease has expired. Rows still inside the attempt
     * budget become {@code RETRY}; rows that have spent the budget become {@code DLQ}.
     * Non-canonical rows are left untouched.
     *
     * @return the number of canonical rows moved
     */
    int reclaimExpiredLeases(Instant now);
}
