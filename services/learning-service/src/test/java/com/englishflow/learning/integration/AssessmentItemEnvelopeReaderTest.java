package com.englishflow.learning.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.apache.kafka.common.header.internals.RecordHeader;
import org.junit.jupiter.api.Test;

import com.englishflow.learning.integration.AssessmentItemEnvelopeReader.ContentPin;
import com.englishflow.learning.integration.AssessmentItemEnvelopeReader.Identity;
import com.englishflow.learning.integration.AssessmentItemEnvelopeReader.Read;
import com.englishflow.learning.integration.AssessmentItemEnvelopeReader.Rejection;

/** B97 correlation tokens and the B105 owner pin on one assessment.item.assessed.v2 record. */
class AssessmentItemEnvelopeReaderTest {

    private static final String TOPIC = "platform.assessment.v1";
    private static final String EVENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    private static final String ITEM_ID = "aitm_b105item1";
    private static final String ATTEMPT_ID = "aatm_b105item1";
    private static final String DEDUPE = ATTEMPT_ID + ":" + ITEM_ID;
    private static final String REQUEST_ID = "req-b105-grammar";
    private static final String TRACE_ID = "0123456789abcdef0123456789abcdef";
    private static final String PRINCIPAL = "prn_learner0000000001";
    private static final String SNAPSHOT = "snap_owner_b95_pin";
    private static final String HASH = "AbCdEf0123456789".repeat(4);
    private static final String BEYOND_LONG = "9223372036854775808";
    private static final List<String> HEADERS = List.of(
            "eventId", "eventName", "schemaVersion", "eventVersion", "dedupeKey", "requestId", "traceId");

    @Test
    void decodesCanonicalB97CorrelationAndB105OwnerPin() {
        Read result = AssessmentItemEnvelopeReader.read(valid());

        assertThat(result).isInstanceOf(Read.Accepted.class);
        Identity identity = ((Read.Accepted) result).identity();
        assertThat(identity).isEqualTo(new Identity(
                EVENT_ID,
                "assessment.item.assessed.v2",
                "assessment.event.v2",
                2,
                ITEM_ID,
                ATTEMPT_ID,
                DEDUPE,
                REQUEST_ID,
                TRACE_ID,
                PRINCIPAL,
                "platform",
                new ContentPin(266100L, 0L, SNAPSHOT, HASH)));
        assertThat(identity.contentPin().snapshotId()).isEqualTo(SNAPSHOT);
        assertThat(identity.contentPin().snapshotHash()).isEqualTo(HASH);
        assertThat(identity.toString())
                .doesNotContain("SECRET_ANSWER_TEXT")
                .doesNotContain("SECRET_SCORE_BUCKET")
                .doesNotContain("2099-11-06T00:00:00Z");
    }

    @Test
    void duplicateOrMissingRequiredHeaderIsClosed() {
        for (String name : HEADERS) {
            ConsumerRecord<String, String> missing = valid();
            missing.headers().remove(name);
            assertClosed(missing, Rejection.MISSING_HEADER);

            ConsumerRecord<String, String> duplicate = valid();
            header(duplicate, name, "again");
            assertClosed(duplicate, Rejection.DUPLICATE_HEADER);
        }
    }

    @Test
    void duplicateJsonKeysAreClosed() {
        assertClosed(withBody(body().replace(
                "\"eventId\": \"" + EVENT_ID + "\"",
                "\"eventId\": \"" + EVENT_ID + "\", \"eventId\": \"" + EVENT_ID + "\"")),
                Rejection.MALFORMED);
        assertClosed(withBody(body().replace(
                "\"snapshotId\": \"" + SNAPSHOT + "\"",
                "\"snapshotId\": \"" + SNAPSHOT + "\", \"snapshotId\": \"" + SNAPSHOT + "\"")),
                Rejection.MALFORMED);
        assertClosed(withBody(body().replace(
                "\"answer\": \"SECRET_ANSWER_TEXT\"",
                "\"answer\": \"SECRET_ANSWER_TEXT\", \"answer\": \"OTHER\"")),
                Rejection.MALFORMED);
    }

    @Test
    void trailingTokensAreClosed() {
        assertClosed(withBody(body() + " {\"extra\":true}"), Rejection.MALFORMED);
        assertClosed(withBody("{"), Rejection.MALFORMED);
    }

    @Test
    void outOfRangeLongIsClosed() {
        assertClosed(withBody(body().replace("\"contentVersionId\": 266100",
                "\"contentVersionId\": " + BEYOND_LONG)), Rejection.TYPE_MISMATCH);
        assertClosed(withBody(body().replace("\"contentEpoch\": 0",
                "\"contentEpoch\": " + BEYOND_LONG)), Rejection.TYPE_MISMATCH);
    }

    @Test
    void floatingAndStringNumbersAreClosed() {
        assertClosed(withBody(body().replace("\"version\": 2", "\"version\": \"2\"")), Rejection.TYPE_MISMATCH);
        assertClosed(withBody(body().replace("\"contentVersionId\": 266100", "\"contentVersionId\": 266100.0")),
                Rejection.TYPE_MISMATCH);
        assertClosed(withBody(body().replace("\"contentVersionId\": 266100", "\"contentVersionId\": \"266100\"")),
                Rejection.TYPE_MISMATCH);
        assertClosed(withBody(body().replace("\"contentEpoch\": 0", "\"contentEpoch\": true")),
                Rejection.TYPE_MISMATCH);
    }

    @Test
    void wrongTopicOrKeyIsClosed() {
        assertClosed(copy(valid(), "platform.learning.v1", ITEM_ID, body()), Rejection.WRONG_TOPIC);
        assertClosed(copy(valid(), TOPIC, "aitm_otherkey1", body()), Rejection.WRONG_KEY);
        assertClosed(copy(valid(), TOPIC, null, body()), Rejection.WRONG_KEY);
    }

    @Test
    void mismatchedIdentityIsClosed() {
        ConsumerRecord<String, String> eventId = valid();
        eventId.headers().remove("eventId");
        header(eventId, "eventId", "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee");
        assertClosed(eventId, Rejection.WRONG_IDENTITY);

        assertClosed(withBody(body().replaceFirst(
                "\"actorId\": \"" + PRINCIPAL + "\"",
                "\"actorId\": \"prn_learner0000000002\"")), Rejection.WRONG_IDENTITY);
        assertClosed(withBody(body().replaceFirst(
                "\"tenantId\": \"platform\"",
                "\"tenantId\": \"other\"")), Rejection.WRONG_IDENTITY);
        assertClosed(withBody(body().replace(
                "\"schema\": \"assessment.event.v2\"",
                "\"schema\": \"assessment.event.v1\"")), Rejection.WRONG_IDENTITY);

        ConsumerRecord<String, String> dedupe = valid();
        dedupe.headers().remove("dedupeKey");
        header(dedupe, "dedupeKey", ATTEMPT_ID + "+" + ITEM_ID);
        assertClosed(dedupe, Rejection.WRONG_IDENTITY);

        ConsumerRecord<String, String> request = withBody(body().replace(REQUEST_ID, "bad:request"));
        request.headers().remove("requestId");
        header(request, "requestId", "bad:request");
        assertClosed(request, Rejection.WRONG_IDENTITY);

        String upperTrace = TRACE_ID.toUpperCase(Locale.ROOT);
        ConsumerRecord<String, String> trace = withBody(body().replace(TRACE_ID, upperTrace));
        trace.headers().remove("traceId");
        header(trace, "traceId", upperTrace);
        assertClosed(trace, Rejection.WRONG_IDENTITY);

        assertClosed(withBody(body().replace(EVENT_ID, "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE")),
                Rejection.WRONG_IDENTITY);
    }

    @Test
    void wrongPinIsClosed() {
        assertClosed(withBody(body().replace("\"contentEpoch\": 0", "\"contentEpoch\": -1")), Rejection.WRONG_PIN);
        assertClosed(withBody(body().replace("\"contentVersionId\": 266100", "\"contentVersionId\": 0")),
                Rejection.WRONG_PIN);
        assertClosed(withBody(body().replace(HASH, "abcd")), Rejection.WRONG_PIN);
        assertClosed(withBody(body().replace(SNAPSHOT, "snap_not")), Rejection.WRONG_PIN);
        assertClosed(withBody(body().replace(
                "\"contentEpoch\": 0",
                "\"contentEpoch\": 0, \"contentCode\": \"p1.placement.v1\"")), Rejection.WRONG_PIN);
    }

    @Test
    void syntheticFallbackPinIsClosed() {
        assertClosed(withBody(body().replace(SNAPSHOT, "snap_assessment_266100")), Rejection.FALLBACK_PIN);
        assertClosed(withBody(body().replace(SNAPSHOT, "snap_assessment_25001")), Rejection.FALLBACK_PIN);
    }

    @Test
    void malformedEnvelopeIsClosed() {
        assertClosed(null, Rejection.MALFORMED);
        ConsumerRecord<String, String> headerBytes = valid();
        headerBytes.headers().remove("eventId");
        headerBytes.headers().add(new RecordHeader("eventId", new byte[] {(byte) 0xFF}));
        assertClosed(headerBytes, Rejection.MALFORMED);
    }

    private static void assertClosed(ConsumerRecord<String, String> record, Rejection rejection) {
        Read result = AssessmentItemEnvelopeReader.read(record);
        assertThat(result).isInstanceOf(Read.Closed.class);
        assertThat(((Read.Closed) result).rejection()).isEqualTo(rejection);
        assertThat(result.toString()).doesNotContain("SECRET_ANSWER_TEXT");
    }

    private static ConsumerRecord<String, String> valid() {
        return copy(null, TOPIC, ITEM_ID, body());
    }

    private static ConsumerRecord<String, String> withBody(String body) {
        return copy(valid(), TOPIC, ITEM_ID, body);
    }

    private static ConsumerRecord<String, String> copy(ConsumerRecord<String, String> source, String topic,
            String key, String body) {
        ConsumerRecord<String, String> record = new ConsumerRecord<>(topic, 0, 0L, key, body);
        if (source == null) {
            header(record, "eventId", EVENT_ID);
            header(record, "eventName", "assessment.item.assessed.v2");
            header(record, "schemaVersion", "assessment.event.v2");
            header(record, "eventVersion", "2");
            header(record, "dedupeKey", DEDUPE);
            header(record, "requestId", REQUEST_ID);
            header(record, "traceId", TRACE_ID);
            header(record, "x-unrelated", "one");
            header(record, "x-unrelated", "two");
            return record;
        }
        for (Header header : source.headers()) {
            record.headers().add(header);
        }
        return record;
    }

    private static void header(ConsumerRecord<String, String> record, String name, String value) {
        record.headers().add(new RecordHeader(name, value.getBytes(StandardCharsets.UTF_8)));
    }

    private static String body() {
        return """
                {
                  "eventId": "%s",
                  "eventName": "assessment.item.assessed.v2",
                  "schema": "assessment.event.v2",
                  "version": 2,
                  "occurredAt": "2099-11-06T00:00:00Z",
                  "aggregateType": "assessment_item",
                  "aggregateId": "%s",
                  "actorId": "%s",
                  "tenantId": "platform",
                  "traceId": "%s",
                  "requestId": "%s",
                  "schemaVersion": "assessment.event.v2",
                  "dedupeKey": "%s",
                  "payload": {
                    "tenantId": "platform",
                    "principalId": "%s",
                    "itemAssessmentId": "%s",
                    "attemptId": "%s",
                    "sessionId": "asess_b105gram",
                    "logicalItemId": "li_b105gram1",
                    "contentPin": {
                      "contentVersionId": 266100,
                      "contentEpoch": 0,
                      "snapshotId": "%s",
                      "snapshotHash": "%s"
                    },
                    "answer": "SECRET_ANSWER_TEXT",
                    "scoreBucket": "SECRET_SCORE_BUCKET"
                  }
                }
                """.formatted(EVENT_ID, ITEM_ID, PRINCIPAL, TRACE_ID, REQUEST_ID, DEDUPE,
                PRINCIPAL, ITEM_ID, ATTEMPT_ID, SNAPSHOT, HASH);
    }
}
