package com.englishflow.assessment.integration;

import com.englishflow.assessment.port.AssessmentOutboxRelayPort;
import com.englishflow.assessment.port.AssessmentOutboxRelayPort.ClaimedEvent;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.DoubleSupplier;

import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.InvalidRecordException;
import org.apache.kafka.common.errors.AuthenticationException;
import org.apache.kafka.common.errors.AuthorizationException;
import org.apache.kafka.common.errors.RecordBatchTooLargeException;
import org.apache.kafka.common.errors.RecordTooLargeException;
import org.apache.kafka.common.errors.RetriableException;
import org.apache.kafka.common.errors.SerializationException;
import org.apache.kafka.common.header.internals.RecordHeader;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Dormant at-least-once publisher for canonical assessment outbox rows.
 *
 * <p>{@link com.englishflow.assessment.config.AssessmentEventRelayConfiguration} is the only bean
 * source. It schedules {@link #poll()} only when the relay and persistence flags are both on, and that client must set
 * synchronous {@code max.block.ms} and {@code delivery.timeout.ms} below {@link #LEASE}. This class
 * does not publish to a workflow DLQ topic: terminal failure is the owner row's {@code DLQ} status.
 *
 * <p>One claim is leased at a time. {@code PUBLISHED} is written only after the send future returns
 * normally with non-null metadata on {@link #TOPIC} and an acknowledged offset, using that claim's
 * opaque token and a clock read taken after the acknowledgement. A normal completion with null,
 * offset-less, or foreign metadata is not marked. Send starts only when the remaining lease covers
 * {@link #MAX_BLOCK} and {@link #MARK_GUARD}. The acknowledgement wait is recomputed after
 * {@code send} returns; an empty budget leaves the lease for reclaim. A {@code false} mark is left
 * as it is. A crash after the broker ack and before the mark can duplicate a record; consumers
 * dedupe on {@code (consumerGroup, eventId)}. Exactly-once is not claimed.
 */
public final class AssessmentOutboxKafkaRelay {

    /** Registered topic. This publisher does not accept another destination. */
    public static final String TOPIC = "platform.assessment.v1";

    public static final String EVENT_NAME = "assessment.item.assessed.v2";

    public static final String SCHEMA_VERSION = "assessment.event.v2";

    public static final int EVENT_VERSION = 2;

    /** Registered poll cap. Each iteration claims at most one row. */
    public static final int MAX_PER_POLL = 100;

    public static final Duration LEASE = Duration.ofSeconds(30);

    /** Short acknowledgement bound. It is never the whole lease. */
    public static final Duration ACK_WAIT = Duration.ofSeconds(5);

    /** Reserved after the wait so the post-ack mark can still match {@code locked_until > now}. */
    public static final Duration MARK_GUARD = Duration.ofSeconds(1);

    /** Bounded producer {@code max.block.ms}. Reserved with {@link #MARK_GUARD} before send. */
    public static final Duration MAX_BLOCK = Duration.ofSeconds(3);

    public static final Duration BASE_DELAY = Duration.ofSeconds(1);

    public static final Duration MAX_DELAY = Duration.ofSeconds(60);

    private static final Logger log = LoggerFactory.getLogger(AssessmentOutboxKafkaRelay.class);

    private final AssessmentOutboxRelayPort relay;
    private final KafkaTemplate<String, String> kafka;
    private final Clock clock;
    private final DoubleSupplier jitterUnit;

    public AssessmentOutboxKafkaRelay(AssessmentOutboxRelayPort relay,
                                      KafkaTemplate<String, String> kafka,
                                      Clock clock) {
        this(relay, kafka, clock, Math::random);
    }

    AssessmentOutboxKafkaRelay(AssessmentOutboxRelayPort relay,
                               KafkaTemplate<String, String> kafka,
                               Clock clock,
                               DoubleSupplier jitterUnit) {
        this.relay = Objects.requireNonNull(relay, "relay is required");
        this.kafka = Objects.requireNonNull(kafka, "kafka is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
        this.jitterUnit = Objects.requireNonNull(jitterUnit, "jitterUnit is required");
    }

    /**
     * Reclaims expired canonical leases, then claims and publishes one row at a time.
     * Any exception from sending or waiting, an interrupt, an unresolved lease, or a budget that
     * cannot cover the block and the mark ends this tick. A malformed row rejected before send does not.
     */
    @Scheduled(fixedDelayString = "${assessment.events.relay.poll-interval:5s}",
            initialDelayString = "${assessment.events.relay.initial-delay:10s}")
    public void poll() {
        int reclaimed = relay.reclaimExpiredLeases(clock.instant());
        if (reclaimed > 0) {
            log.warn("assessment outbox reclaimed expired leases count={}", reclaimed);
        }
        for (int nth = 0; nth < MAX_PER_POLL; nth++) {
            Instant claimedAt = clock.instant();
            List<ClaimedEvent> claimed = relay.claim(claimedAt, 1, LEASE);
            if (claimed == null || claimed.isEmpty()) {
                return;
            }
            ClaimedEvent event = claimed.get(0);
            if (event == null) {
                return;
            }
            if (publish(event, claimedAt) == Step.STOP || claimed.size() != 1) {
                return;
            }
        }
    }

    private Step publish(ClaimedEvent event, Instant claimedAt) {
        if (!admissible(event)) {
            if (event.eventId() == null || event.leaseToken() == null) {
                log.warn("assessment outbox skipped an unfenced claim");
                return Step.STOP;
            }
            return settle(event, "SCHEMA_INVALID") ? Step.CONTINUE : Step.STOP;
        }
        Instant sendAt = clock.instant();
        if (!sendWindowOpen(claimedAt, sendAt)) {
            log.warn("assessment outbox skipped send outside the lease guard");
            return Step.STOP;
        }
        CompletableFuture<SendResult<String, String>> pending;
        try {
            pending = kafka.send(record(event));
        } catch (Exception failure) {
            return failAndStop(event, failure);
        }
        if (pending == null) {
            log.warn("assessment outbox ignored a completion without an acknowledged offset");
            return Step.STOP;
        }
        Duration wait = ackWait(claimedAt, clock.instant());
        if (wait.isZero() || wait.isNegative() || wait.toMillis() <= 0L) {
            log.warn("assessment outbox left the lease after send without an acknowledgement");
            return Step.STOP;
        }
        SendResult<String, String> result;
        try {
            result = pending.get(wait.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
        } catch (Exception failure) {
            return failAndStop(event, failure);
        }
        if (!acknowledged(result)) {
            log.warn("assessment outbox ignored a completion without an acknowledged offset");
            return Step.STOP;
        }
        Instant acknowledgedAt = clock.instant();
        boolean published = relay.markPublished(event.eventId(), event.leaseToken(), acknowledgedAt);
        if (!published) {
            log.warn("assessment outbox stale publish mark left inert");
            return Step.STOP;
        }
        return Step.CONTINUE;
    }

    /**
     * Delay for the stored post-increment attempt. Attempt 1 waits 1s. The sample is drawn once.
     * The result never exceeds 60s.
     */
    Duration backoff(int attemptCount) {
        int exponent = attemptCount - 1;
        if (exponent < 0) {
            exponent = 0;
        } else if (exponent > 20) {
            exponent = 20;
        }
        long exponential = BASE_DELAY.toMillis() * (1L << exponent);
        if (exponential < 0L || exponential > MAX_DELAY.toMillis()) {
            exponential = MAX_DELAY.toMillis();
        }
        double unit = jitterUnit.getAsDouble();
        if (Double.isNaN(unit) || unit < 0.0d) {
            unit = 0.0d;
        } else if (unit > 1.0d) {
            unit = 1.0d;
        }
        long delay = exponential + (long) (exponential * 0.2d * unit);
        if (delay > MAX_DELAY.toMillis()) {
            delay = MAX_DELAY.toMillis();
        }
        return Duration.ofMillis(delay);
    }

    private boolean settle(ClaimedEvent event, String code) {
        Instant now = clock.instant();
        boolean terminal = event.attemptCount() >= AssessmentOutboxRelayPort.MAX_ATTEMPTS
                || AssessmentOutboxRelayPort.PERMANENT_FAILURE_CODES.contains(code);
        Instant availableAt = now;
        if (!terminal) {
            availableAt = now.plus(backoff(event.attemptCount()));
        }
        boolean marked = relay.markFailed(event.eventId(), event.leaseToken(), now, availableAt, code);
        if (!marked) {
            log.warn("assessment outbox stale failure mark left inert");
            return false;
        }
        if (terminal) {
            log.warn("assessment outbox owner row dlq attempt={} code={}", event.attemptCount(), code);
        } else {
            log.warn("assessment outbox rescheduled attempt={} delayMs={} code={}",
                    event.attemptCount(), Duration.between(now, availableAt).toMillis(), code);
        }
        return true;
    }

    private Step failAndStop(ClaimedEvent event, Exception failure) {
        if (failure instanceof InterruptedException || unwrap(failure) instanceof InterruptedException) {
            try {
                settle(event, "TIMEOUT");
            } finally {
                Thread.currentThread().interrupt();
            }
            return Step.STOP;
        }
        String code = failure instanceof java.util.concurrent.TimeoutException
                ? "TIMEOUT"
                : classify(unwrap(failure));
        settle(event, code);
        return Step.STOP;
    }

    private static boolean sendWindowOpen(Instant claimedAt, Instant now) {
        Duration remaining = Duration.between(now, claimedAt.plus(LEASE));
        long requiredMillis = MAX_BLOCK.plus(MARK_GUARD).toMillis();
        return !remaining.isNegative() && remaining.toMillis() >= requiredMillis;
    }

    private static boolean acknowledged(SendResult<String, String> result) {
        if (result == null) {
            return false;
        }
        RecordMetadata metadata = result.getRecordMetadata();
        return metadata != null && TOPIC.equals(metadata.topic()) && metadata.hasOffset();
    }

    private static Duration ackWait(Instant claimedAt, Instant sendAt) {
        Duration remaining = Duration.between(sendAt, claimedAt.plus(LEASE));
        Duration budget = remaining.minus(MARK_GUARD);
        if (budget.isNegative() || budget.isZero() || budget.toMillis() <= 0L) {
            return Duration.ZERO;
        }
        if (budget.compareTo(ACK_WAIT) > 0) {
            return ACK_WAIT;
        }
        return budget;
    }

    private static boolean admissible(ClaimedEvent event) {
        return EVENT_NAME.equals(event.eventName())
                && SCHEMA_VERSION.equals(event.schemaVersion())
                && event.eventVersion() == EVENT_VERSION
                && event.eventId() != null
                && event.aggregateId() != null
                && event.dedupeKey() != null
                && event.payloadJson() != null
                && event.requestId() != null
                && event.traceId() != null
                && event.leaseToken() != null;
    }

    private static ProducerRecord<String, String> record(ClaimedEvent event) {
        ProducerRecord<String, String> producerRecord =
                new ProducerRecord<>(TOPIC, null, event.aggregateId(), event.payloadJson());
        header(producerRecord, "eventId", event.eventId());
        header(producerRecord, "eventName", event.eventName());
        header(producerRecord, "schemaVersion", event.schemaVersion());
        header(producerRecord, "eventVersion", Integer.toString(event.eventVersion()));
        header(producerRecord, "dedupeKey", event.dedupeKey());
        header(producerRecord, "requestId", event.requestId());
        header(producerRecord, "traceId", event.traceId());
        return producerRecord;
    }

    private static void header(ProducerRecord<String, String> producerRecord, String name, String value) {
        producerRecord.headers().add(new RecordHeader(name, value.getBytes(StandardCharsets.UTF_8)));
    }

    private static String classify(Throwable cause) {
        if (cause instanceof org.apache.kafka.common.errors.TimeoutException
                || cause instanceof java.util.concurrent.TimeoutException) {
            return "TIMEOUT";
        }
        if (cause instanceof AuthorizationException || cause instanceof AuthenticationException) {
            return "FORBIDDEN";
        }
        if (cause instanceof SerializationException
                || cause instanceof RecordTooLargeException
                || cause instanceof InvalidRecordException
                || cause instanceof RecordBatchTooLargeException) {
            return "SCHEMA_INVALID";
        }
        if (cause instanceof RetriableException) {
            return "TEMPORARY_UNAVAILABLE";
        }
        return "UNCLASSIFIED";
    }

    private static Throwable unwrap(Throwable failure) {
        Throwable current = failure;
        while (current.getCause() != null
                && (current instanceof java.util.concurrent.ExecutionException
                || current instanceof java.util.concurrent.CompletionException)) {
            current = current.getCause();
        }
        return current;
    }

    private enum Step {
        CONTINUE,
        STOP
    }
}
