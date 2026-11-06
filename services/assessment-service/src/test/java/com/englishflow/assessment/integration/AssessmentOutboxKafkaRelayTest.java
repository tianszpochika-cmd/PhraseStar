package com.englishflow.assessment.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.englishflow.assessment.port.AssessmentOutboxRelayPort;
import com.englishflow.assessment.port.AssessmentOutboxRelayPort.ClaimedEvent;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.DoubleSupplier;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.errors.NetworkException;
import org.apache.kafka.common.errors.SerializationException;
import org.apache.kafka.common.errors.TopicAuthorizationException;
import org.apache.kafka.common.header.Header;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

/**
 * Pure publisher checks. They do not open a broker, a database, or a Spring context.
 * The JDBC lease regressions stay in {@code JdbcAssessmentOutboxRelayTest}.
 */
class AssessmentOutboxKafkaRelayTest {

    private static final Instant BASE = Instant.parse("2026-11-06T00:00:00Z");
    private static final String PAYLOAD = "{\"marker\":\" keep \",\"n\":2}";

    @Test
    void acknowledgedRecordIsMarkedWithTheSameTokenAfterAFreshClock() {
        SequenceClock clock = new SequenceClock(BASE);
        List<String> order = new ArrayList<>();
        FakeRelayPort port = new FakeRelayPort(order, List.of(event("evt-1", 1, "lease-1", PAYLOAD)));
        FakeKafka kafka = new FakeKafka(order);
        relay(port, kafka, clock, () -> 0.0d).poll();

        assertEquals(List.of("reclaim", "claim", "send", "markPublished", "claim"), order);
        assertEquals(List.of(1, 1), port.batches);
        assertEquals(List.of(AssessmentOutboxKafkaRelay.LEASE, AssessmentOutboxKafkaRelay.LEASE), port.leases);
        assertEquals(1, kafka.sent.size());
        ProducerRecord<String, String> record = kafka.sent.get(0);
        assertEquals(AssessmentOutboxKafkaRelay.TOPIC, record.topic());
        assertSame("aitm_row_00000001", record.key());
        assertSame(PAYLOAD, record.value());
        assertEquals(7, record.headers().toArray().length);
        assertEquals("evt-1", header(record, "eventId"));
        assertEquals(AssessmentOutboxKafkaRelay.EVENT_NAME, header(record, "eventName"));
        assertEquals(AssessmentOutboxKafkaRelay.SCHEMA_VERSION, header(record, "schemaVersion"));
        assertEquals("2", header(record, "eventVersion"));
        assertEquals("dedupe-evt-1", header(record, "dedupeKey"));
        assertEquals("req_relay_ok_01", header(record, "requestId"));
        assertEquals("0123456789abcdef0123456789abcdef", header(record, "traceId"));
        assertEquals(List.of(AssessmentOutboxKafkaRelay.ACK_WAIT.toMillis()), kafka.waits);
        assertTrue(port.failed.isEmpty());
        assertEquals(1, port.published.size());
        Mark published = port.published.get(0);
        assertEquals("evt-1", published.eventId());
        assertEquals("lease-1", published.leaseToken());
        assertEquals(clock.reads.get(4), published.at());
        assertTrue(clock.reads.get(4).isAfter(clock.reads.get(3)));
        assertEquals(clock.reads.get(1), port.claimTimes.get(0));
    }

    @Test
    void stalePublishMarkStaysInertAndStopsTheTick() {
        List<String> order = new ArrayList<>();
        FakeRelayPort port = new FakeRelayPort(order, List.of(
                event("evt-1", 1, "lease-1", PAYLOAD),
                event("evt-2", 1, "lease-2", PAYLOAD)));
        port.publishResult = false;
        FakeKafka kafka = new FakeKafka(order);
        relay(port, kafka, Clock.fixed(BASE, ZoneOffset.UTC), () -> 0.0d).poll();

        assertEquals(List.of("reclaim", "claim", "send", "markPublished"), order);
        assertTrue(port.failed.isEmpty());
        assertEquals("lease-1", port.published.get(0).leaseToken());
        assertEquals(1, port.claimTimes.size());
    }

    @Test
    void brokerFailureStopsAfterOneBackoffFromTheStoredAttempt() {
        CountingJitter jitter = new CountingJitter(0.0d);
        SequenceClock clock = new SequenceClock(BASE);
        List<String> order = new ArrayList<>();
        FakeRelayPort port = new FakeRelayPort(order, List.of(
                event("evt-1", 2, "lease-2", PAYLOAD),
                event("evt-2", 1, "lease-other", PAYLOAD)));
        FakeKafka kafka = new FakeKafka(order);
        kafka.failWith(new org.apache.kafka.common.errors.TimeoutException("broker unavailable"));
        relay(port, kafka, clock, jitter).poll();

        assertEquals(List.of("reclaim", "claim", "send", "markFailed"), order);
        assertTrue(port.published.isEmpty());
        assertEquals(1, jitter.samples);
        assertEquals(1, port.failed.size());
        Failure failure = port.failed.get(0);
        assertEquals("evt-1", failure.eventId());
        assertEquals("lease-2", failure.leaseToken());
        assertEquals("TIMEOUT", failure.code());
        assertFalse(failure.code().contains("broker"));
        assertEquals(clock.reads.get(4), failure.now());
        assertEquals(clock.reads.get(4).plusSeconds(2), failure.availableAt());
        assertEquals(1, port.claimTimes.size());
    }

    @Test
    void fifthStoredAttemptIsTerminalWithoutAnotherBackoff() {
        CountingJitter jitter = new CountingJitter(1.0d);
        SequenceClock clock = new SequenceClock(BASE);
        List<String> order = new ArrayList<>();
        FakeRelayPort port = new FakeRelayPort(order, List.of(event("evt-5", 5, "lease-5", PAYLOAD)));
        FakeKafka kafka = new FakeKafka(order);
        kafka.timeOut = true;
        relay(port, kafka, clock, jitter).poll();

        assertEquals(0, jitter.samples);
        assertTrue(port.published.isEmpty());
        Failure failure = port.failed.get(0);
        assertEquals("TIMEOUT", failure.code());
        assertEquals("lease-5", failure.leaseToken());
        assertEquals(clock.reads.get(4), failure.now());
        assertEquals(failure.now(), failure.availableAt());
        assertEquals(List.of("reclaim", "claim", "send", "markFailed"), order);
    }

    @Test
    void interruptIsRestoredAfterTheFailureMarkAndStopsTheTick() {
        Thread.interrupted();
        try {
            List<String> order = new ArrayList<>();
            FakeRelayPort port = new FakeRelayPort(order, List.of(
                    event("evt-1", 1, "lease-1", PAYLOAD),
                    event("evt-2", 1, "lease-2", PAYLOAD)));
            FakeKafka kafka = new FakeKafka(order);
            kafka.interrupt = true;
            relay(port, kafka, Clock.fixed(BASE, ZoneOffset.UTC), () -> 0.0d).poll();

            assertEquals(List.of("reclaim", "claim", "send", "markFailed"), order);
            assertTrue(port.published.isEmpty());
            assertEquals("TIMEOUT", port.failed.get(0).code());
            assertEquals("lease-1", port.failed.get(0).leaseToken());
            assertFalse(port.interruptedAtFailureMark);
            assertTrue(Thread.currentThread().isInterrupted());
            assertEquals(1, kafka.sent.size());
        } finally {
            Thread.interrupted();
        }
    }

    @Test
    void malformedRowContinuesAndSendExceptionStopsTheTick() {
        CountingJitter jitter = new CountingJitter(0.0d);
        List<String> order = new ArrayList<>();
        ClaimedEvent wrongName = new ClaimedEvent(
                "evt-legacy", "aitm_row_00000001", "assessment.placement.completed.v1",
                "assessment.event.v1", 1, "dedupe-legacy", PAYLOAD,
                "req_relay_ok_01", "0123456789abcdef0123456789abcdef", 1, "lease-legacy");
        ClaimedEvent serial = event("evt-serial", 1, "lease-serial", PAYLOAD);
        ClaimedEvent later = event("evt-ok", 3, "lease-ok", PAYLOAD);
        FakeRelayPort port = new FakeRelayPort(order, List.of(wrongName, serial, later));
        FakeKafka kafka = new FakeKafka(order);
        kafka.failNext(new SerializationException("must not be stored"));
        relay(port, kafka, Clock.fixed(BASE, ZoneOffset.UTC), jitter).poll();

        assertEquals(0, jitter.samples);
        assertEquals(1, kafka.sent.size());
        assertEquals(AssessmentOutboxKafkaRelay.TOPIC, kafka.sent.get(0).topic());
        assertSame("aitm_row_00000001", kafka.sent.get(0).key());
        assertSame(PAYLOAD, kafka.sent.get(0).value());
        assertEquals(AssessmentOutboxKafkaRelay.EVENT_NAME, header(kafka.sent.get(0), "eventName"));
        assertEquals(List.of("SCHEMA_INVALID", "SCHEMA_INVALID"),
                port.failed.stream().map(Failure::code).toList());
        assertEquals(List.of("lease-legacy", "lease-serial"),
                port.failed.stream().map(Failure::leaseToken).toList());
        assertTrue(port.published.isEmpty());
        assertEquals(BASE, port.failed.get(0).availableAt());
        assertEquals(BASE, port.failed.get(1).availableAt());
        assertEquals(2, port.claimTimes.size());
        assertEquals(1, port.queued.size());
        assertEquals(List.of("reclaim", "claim", "markFailed", "claim", "send", "markFailed"), order);
        assertTrue(port.failed.stream().noneMatch(failure -> failure.code().contains("must not")));

        order.clear();
        ClaimedEvent forbidden = event("evt-auth", 1, "lease-auth", PAYLOAD);
        ClaimedEvent accepted = event("evt-next", 1, "lease-next", PAYLOAD);
        port = new FakeRelayPort(order, List.of(forbidden, accepted));
        kafka = new FakeKafka(order);
        kafka.failNext(new TopicAuthorizationException("Authorization failed"));
        relay(port, kafka, Clock.fixed(BASE, ZoneOffset.UTC), jitter).poll();

        assertEquals(0, jitter.samples);
        assertEquals(List.of("FORBIDDEN"), port.failed.stream().map(Failure::code).toList());
        assertEquals("lease-auth", port.failed.get(0).leaseToken());
        assertEquals(BASE, port.failed.get(0).availableAt());
        assertTrue(port.published.isEmpty());
        assertEquals(1, port.claimTimes.size());
        assertEquals(1, port.queued.size());
        assertEquals(List.of("reclaim", "claim", "send", "markFailed"), order);
        assertTrue(port.failed.stream().noneMatch(failure -> failure.code().contains("Authorization")));
    }

    @Test
    void otherRetriableBrokerFailureStopsWithoutASecondClaim() {
        CountingJitter jitter = new CountingJitter(1.0d);
        SequenceClock clock = new SequenceClock(BASE);
        List<String> order = new ArrayList<>();
        FakeRelayPort port = new FakeRelayPort(order, List.of(
                event("evt-1", 1, "lease-1", PAYLOAD),
                event("evt-2", 1, "lease-2", PAYLOAD)));
        FakeKafka kafka = new FakeKafka(order);
        kafka.failWith(new NetworkException("connection reset"));
        relay(port, kafka, clock, jitter).poll();

        assertEquals(1, jitter.samples);
        assertEquals("TEMPORARY_UNAVAILABLE", port.failed.get(0).code());
        assertEquals(clock.reads.get(4).plusMillis(1_200), port.failed.get(0).availableAt());
        assertEquals(1, port.claimTimes.size());
        assertTrue(port.published.isEmpty());
    }

    @Test
    void staleFailureMarkStaysInert() {
        List<String> order = new ArrayList<>();
        FakeRelayPort port = new FakeRelayPort(order, List.of(
                event("evt-1", 1, "lease-1", PAYLOAD),
                event("evt-2", 1, "lease-2", PAYLOAD)));
        port.failResult = false;
        FakeKafka kafka = new FakeKafka(order);
        kafka.failWith(new org.apache.kafka.common.errors.TimeoutException("late"));
        relay(port, kafka, Clock.fixed(BASE, ZoneOffset.UTC), () -> 0.0d).poll();

        assertEquals(List.of("reclaim", "claim", "send", "markFailed"), order);
        assertEquals(1, port.failed.size());
        assertTrue(port.published.isEmpty());
    }

    @Test
    void sendIsSkippedWhenTheRemainingLeaseCannotCoverTheMark() {
        ScriptClock clock = new ScriptClock(BASE, BASE, BASE.plusMillis(29_500));
        List<String> order = new ArrayList<>();
        FakeRelayPort port = new FakeRelayPort(order, List.of(
                event("evt-1", 1, "lease-1", PAYLOAD),
                event("evt-2", 1, "lease-2", PAYLOAD)));
        FakeKafka kafka = new FakeKafka(order);
        relay(port, kafka, clock, () -> 0.0d).poll();

        assertEquals(List.of("reclaim", "claim"), order);
        assertTrue(kafka.sent.isEmpty());
        assertTrue(port.published.isEmpty());
        assertTrue(port.failed.isEmpty());
        assertEquals(3, clock.reads.size());
    }

    @Test
    void emptyAckBudgetAfterSendLeavesTheLease() {
        ScriptClock clock = new ScriptClock(BASE, BASE, BASE, BASE.plusMillis(29_500));
        List<String> order = new ArrayList<>();
        FakeRelayPort port = new FakeRelayPort(order, List.of(
                event("evt-1", 1, "lease-1", PAYLOAD),
                event("evt-2", 1, "lease-2", PAYLOAD)));
        FakeKafka kafka = new FakeKafka(order);
        relay(port, kafka, clock, () -> 0.0d).poll();

        assertEquals(List.of("reclaim", "claim", "send"), order);
        assertEquals(1, kafka.sent.size());
        assertTrue(kafka.waits.isEmpty());
        assertTrue(port.published.isEmpty());
        assertTrue(port.failed.isEmpty());
        assertEquals(1, port.claimTimes.size());
        assertEquals(4, clock.reads.size());
    }

    @Test
    void normalCompletionWithoutAcknowledgementNeverMarksPublished() {
        for (String mode : List.of("null", "no-offset", "null-metadata", "wrong-topic")) {
            List<String> order = new ArrayList<>();
            FakeRelayPort port = new FakeRelayPort(order, List.of(
                    event("evt-" + mode, 1, "lease-" + mode, PAYLOAD),
                    event("evt-next-" + mode, 1, "lease-next-" + mode, PAYLOAD)));
            FakeKafka kafka = new FakeKafka(order);
            if ("null".equals(mode)) {
                kafka.nullResult = true;
            } else if ("no-offset".equals(mode)) {
                kafka.noOffset = true;
            } else if ("null-metadata".equals(mode)) {
                kafka.nullMetadata = true;
            } else {
                kafka.metadataTopic = "platform.content.v1";
            }
            relay(port, kafka, Clock.fixed(BASE, ZoneOffset.UTC), () -> 0.0d).poll();

            assertEquals(List.of("reclaim", "claim", "send"), order, mode);
            assertEquals(List.of(AssessmentOutboxKafkaRelay.ACK_WAIT.toMillis()), kafka.waits, mode);
            assertTrue(port.published.isEmpty(), mode);
            assertTrue(port.failed.isEmpty(), mode);
            assertEquals(1, port.claimTimes.size(), mode);
        }
    }

    @Test
    void pollStopsAtTheRegisteredCap() {
        List<ClaimedEvent> queued = new ArrayList<>();
        for (int n = 0; n < AssessmentOutboxKafkaRelay.MAX_PER_POLL + 5; n++) {
            queued.add(event("evt-" + n, 1, "lease-" + n, PAYLOAD));
        }
        List<String> order = new ArrayList<>();
        FakeRelayPort port = new FakeRelayPort(order, queued);
        FakeKafka kafka = new FakeKafka(order);
        relay(port, kafka, Clock.fixed(BASE, ZoneOffset.UTC), () -> 0.0d).poll();

        assertEquals(AssessmentOutboxKafkaRelay.MAX_PER_POLL, kafka.sent.size());
        assertEquals(AssessmentOutboxKafkaRelay.MAX_PER_POLL, port.published.size());
        assertEquals(5, port.queued.size());
        assertTrue(port.batches.stream().allMatch(batch -> batch == 1));
        assertTrue(port.published.stream().allMatch(mark -> mark.leaseToken().startsWith("lease-")));
        assertEquals("lease-0", port.published.get(0).leaseToken());
        assertEquals("lease-99", port.published.get(99).leaseToken());
    }

    @Test
    void backoffUsesTheStoredAttemptOnceAndCaps() {
        CountingJitter jitter = new CountingJitter(1.0d);
        AssessmentOutboxKafkaRelay relay = relay(new FakeRelayPort(new ArrayList<>(), List.of()),
                new FakeKafka(new ArrayList<>()), Clock.fixed(BASE, ZoneOffset.UTC), jitter);
        assertEquals(Duration.ofMillis(1_200), relay.backoff(1));
        assertEquals(Duration.ofMillis(2_400), relay.backoff(2));
        assertEquals(Duration.ofMillis(9_600), relay.backoff(4));
        assertEquals(Duration.ofSeconds(60), relay.backoff(7));
        assertEquals(Duration.ofSeconds(60), relay.backoff(30));
        assertEquals(5, jitter.samples);
        assertEquals(List.of(
                "TIMEOUT", "TEMPORARY_UNAVAILABLE", "CONFLICT_RETRYABLE"),
                AssessmentOutboxRelayPort.RETRYABLE_FAILURE_CODES);
        assertEquals(List.of(
                "SCHEMA_INVALID", "FORBIDDEN", "OWNER_MISMATCH", "STALE_VERSION"),
                AssessmentOutboxRelayPort.PERMANENT_FAILURE_CODES);
        assertFalse(AssessmentOutboxRelayPort.PERMANENT_FAILURE_CODES.contains("TIMEOUT"));
    }

    private static AssessmentOutboxKafkaRelay relay(FakeRelayPort port, FakeKafka kafka, Clock clock,
            DoubleSupplier jitter) {
        return new AssessmentOutboxKafkaRelay(port, kafka, clock, jitter);
    }

    private static ClaimedEvent event(String eventId, int attemptCount, String leaseToken, String payload) {
        return new ClaimedEvent(
                eventId,
                "aitm_row_00000001",
                AssessmentOutboxKafkaRelay.EVENT_NAME,
                AssessmentOutboxKafkaRelay.SCHEMA_VERSION,
                AssessmentOutboxKafkaRelay.EVENT_VERSION,
                "dedupe-" + eventId,
                payload,
                "req_relay_ok_01",
                "0123456789abcdef0123456789abcdef",
                attemptCount,
                leaseToken);
    }

    private static String header(ProducerRecord<String, String> record, String name) {
        Header header = record.headers().lastHeader(name);
        assertNotNull(header, name);
        return new String(header.value(), StandardCharsets.UTF_8);
    }

    private record Mark(String eventId, String leaseToken, Instant at) {
    }

    private record Failure(String eventId, String leaseToken, Instant now, Instant availableAt, String code) {
    }

    private static final class CountingJitter implements DoubleSupplier {
        private final double value;
        private int samples;

        private CountingJitter(double value) {
            this.value = value;
        }

        @Override
        public double getAsDouble() {
            samples++;
            return value;
        }
    }

    private static final class SequenceClock extends Clock {
        private Instant next;
        private final List<Instant> reads = new ArrayList<>();

        private SequenceClock(Instant start) {
            this.next = start;
        }

        @Override
        public Instant instant() {
            Instant value = next;
            reads.add(value);
            next = next.plusMillis(5);
            return value;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    private static final class ScriptClock extends Clock {
        private final ArrayDeque<Instant> times;
        private final List<Instant> reads = new ArrayList<>();
        private Instant last;

        private ScriptClock(Instant... instants) {
            this.times = new ArrayDeque<>(List.of(instants));
            this.last = instants[instants.length - 1];
        }

        @Override
        public Instant instant() {
            Instant value = times.isEmpty() ? last : times.removeFirst();
            last = value;
            reads.add(value);
            return value;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }

    private static final class FakeRelayPort implements AssessmentOutboxRelayPort {
        private final List<String> order;
        private final List<ClaimedEvent> queued;
        private final List<Mark> published = new ArrayList<>();
        private final List<Failure> failed = new ArrayList<>();
        private final List<Integer> batches = new ArrayList<>();
        private final List<Duration> leases = new ArrayList<>();
        private final List<Instant> claimTimes = new ArrayList<>();
        private boolean publishResult = true;
        private boolean failResult = true;
        private boolean interruptedAtFailureMark;

        private FakeRelayPort(List<String> order, List<ClaimedEvent> queued) {
            this.order = order;
            this.queued = new ArrayList<>(queued);
        }

        @Override
        public List<ClaimedEvent> claim(Instant now, int batchSize, Duration lease) {
            order.add("claim");
            claimTimes.add(now);
            batches.add(batchSize);
            leases.add(lease);
            if (queued.isEmpty()) {
                return List.of();
            }
            return List.of(queued.remove(0));
        }

        @Override
        public boolean markPublished(String eventId, String leaseToken, Instant now) {
            order.add("markPublished");
            published.add(new Mark(eventId, leaseToken, now));
            return publishResult;
        }

        @Override
        public boolean markFailed(String eventId, String leaseToken, Instant now, Instant availableAt,
                String errorCode) {
            order.add("markFailed");
            interruptedAtFailureMark = Thread.currentThread().isInterrupted();
            failed.add(new Failure(eventId, leaseToken, now, availableAt, errorCode));
            return failResult;
        }

        @Override
        public int reclaimExpiredLeases(Instant now) {
            order.add("reclaim");
            return 0;
        }
    }

    private static final class FakeKafka extends KafkaTemplate<String, String> {
        private final List<String> order;
        private final List<ProducerRecord<String, String>> sent = new ArrayList<>();
        private final List<Long> waits = new ArrayList<>();
        private final ArrayDeque<RuntimeException> nextFailures = new ArrayDeque<>();
        private RuntimeException failure;
        private boolean interrupt;
        private boolean timeOut;
        private boolean nullResult;
        private boolean noOffset;
        private boolean nullMetadata;
        private String metadataTopic;

        private FakeKafka(List<String> order) {
            super(new DefaultKafkaProducerFactory<>(Map.of(
                    ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "127.0.0.1:1")));
            this.order = order;
        }

        private void failWith(RuntimeException failure) {
            this.failure = failure;
        }

        private void failNext(RuntimeException failure) {
            nextFailures.addLast(failure);
        }

        @Override
        public CompletableFuture<SendResult<String, String>> send(ProducerRecord<String, String> record) {
            order.add("send");
            sent.add(record);
            RuntimeException captured = nextFailures.isEmpty() ? failure : nextFailures.removeFirst();
            boolean interruptNow = interrupt;
            boolean timeOutNow = timeOut;
            boolean nullResultNow = nullResult;
            boolean noOffsetNow = noOffset;
            boolean nullMetadataNow = nullMetadata;
            String topicNow = metadataTopic == null ? record.topic() : metadataTopic;
            return new CompletableFuture<>() {
                @Override
                public SendResult<String, String> get(long timeout, TimeUnit unit)
                        throws InterruptedException, ExecutionException, TimeoutException {
                    waits.add(unit.toMillis(timeout));
                    if (interruptNow) {
                        throw new InterruptedException("stopped");
                    }
                    if (timeOutNow) {
                        throw new TimeoutException("wait elapsed");
                    }
                    if (captured != null) {
                        throw new ExecutionException(captured);
                    }
                    if (nullResultNow) {
                        return null;
                    }
                    RecordMetadata metadata = nullMetadataNow
                            ? null
                            : new RecordMetadata(
                                    new TopicPartition(topicNow, 0),
                                    noOffsetNow ? -1L : 4L,
                                    0,
                                    BASE.toEpochMilli(),
                                    -1,
                                    -1);
                    return new SendResult<>(record, metadata);
                }
            };
        }
    }
}
