package com.englishflow.workflow.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UnfinishedSagaPagingTest {

    @Test
    void firstPageNextEmptyBoundaryAndInvalidCursor() {
        List<SagaStore.SagaRecord> rows = records(5);
        SagaStore.UnfinishedPage first = UnfinishedSagaPaging.slice(rows, null, 2);
        assertEquals(List.of(id(0), id(1)), ids(first));
        assertTrue(first.hasMore());
        assertEquals(2, first.pageSize());

        SagaStore.UnfinishedPage next = UnfinishedSagaPaging.slice(rows, first.nextCursor(), 2);
        assertEquals(List.of(id(2), id(3)), ids(next));
        assertTrue(next.hasMore());
        assertTrue(java.util.Collections.disjoint(ids(first), ids(next)));

        SagaStore.UnfinishedPage last = UnfinishedSagaPaging.slice(rows, next.nextCursor(), 2);
        assertEquals(List.of(id(4)), ids(last));
        assertFalse(last.hasMore());
        assertNull(last.nextCursor());

        SagaStore.UnfinishedPage empty = UnfinishedSagaPaging.slice(List.of(), null, 20);
        assertTrue(empty.items().isEmpty());
        assertFalse(empty.hasMore());
        assertNull(empty.nextCursor());
        assertEquals(20, empty.pageSize());

        SagaStore.UnfinishedPage exact = UnfinishedSagaPaging.slice(records(2), null, 2);
        assertEquals(2, exact.items().size());
        assertFalse(exact.hasMore());
        assertNull(exact.nextCursor());

        assertThrows(IllegalArgumentException.class, () -> UnfinishedSagaPaging.slice(rows, "short", 2));
        assertThrows(IllegalArgumentException.class, () -> UnfinishedSagaPaging.slice(rows, "!!!!!!!!", 2));
        assertThrows(IllegalArgumentException.class, () -> UnfinishedSagaPaging.requestPageSize(0));
        assertThrows(IllegalArgumentException.class, () -> UnfinishedSagaPaging.requestPageSize(101));
        assertEquals(20, UnfinishedSagaPaging.requestPageSize(null));
    }

    @Test
    void cursorPrecisionRoundTripsMicroseconds() {
        Instant micros = Instant.parse("2026-11-08T00:00:00.123456Z");
        SagaStore.SagaRecord row = record(id(0), micros, micros, SagaStatus.STARTED);
        String cursor = UnfinishedSagaPaging.encode(row);
        UnfinishedSagaPaging.Position position = UnfinishedSagaPaging.decode(cursor);
        assertEquals(micros, position.startedAt());
        assertEquals(id(0), position.sagaId());
        assertEquals(cursor, UnfinishedSagaPaging.encode(
                record(id(0), Instant.parse("2026-11-08T00:00:10Z"), position.startedAt(), SagaStatus.STARTED)));
        assertEquals("2026-11-08T00:00:00.123456Z", UnfinishedSagaPaging.formatStartedAt(micros));
        Instant hundred = Instant.parse("2026-11-08T00:00:00.100Z");
        assertEquals("2026-11-08T00:00:00.100000Z", UnfinishedSagaPaging.formatStartedAt(hundred));
        String hundredCursor = UnfinishedSagaPaging.encode(record(id(1), hundred, hundred, SagaStatus.STARTED));
        assertEquals(hundred.truncatedTo(java.time.temporal.ChronoUnit.MICROS),
                UnfinishedSagaPaging.decode(hundredCursor).startedAt());
        assertEquals(hundredCursor, UnfinishedSagaPaging.encode(record(id(1), hundred.plusSeconds(4),
                UnfinishedSagaPaging.decode(hundredCursor).startedAt(), SagaStatus.STARTED)));
    }

    @Test
    void mutableUpdatedAtDoesNotDuplicateASagaAcrossPages() {
        Instant t1 = Instant.parse("2026-01-01T00:00:00.000001Z");
        Instant t2 = Instant.parse("2026-01-01T00:00:00.000002Z");
        Instant t3 = Instant.parse("2026-01-01T00:00:00.000003Z");
        Instant moved = Instant.parse("2026-01-01T00:00:00.000010Z");
        String a = id(0);
        String b = id(1);
        String c = id(2);
        List<SagaStore.SagaRecord> original = List.of(
                record(a, t1, t1, SagaStatus.STARTED),
                record(b, t2, t2, SagaStatus.STARTED),
                record(c, t3, t3, SagaStatus.STARTED));
        SagaStore.UnfinishedPage first = UnfinishedSagaPaging.slice(original, null, 1);
        assertEquals(List.of(a), ids(first));
        List<SagaStore.SagaRecord> afterUpdate = List.of(
                record(a, moved, t1, SagaStatus.STARTED),
                record(b, moved, t2, SagaStatus.STARTED),
                record(c, t3, t3, SagaStatus.STARTED));
        SagaStore.UnfinishedPage second = UnfinishedSagaPaging.slice(afterUpdate, first.nextCursor(), 1);
        assertEquals(List.of(b), ids(second));
        SagaStore.UnfinishedPage third = UnfinishedSagaPaging.slice(afterUpdate, second.nextCursor(), 1);
        assertEquals(List.of(c), ids(third));
        assertFalse(third.hasMore());
        assertNull(third.nextCursor());
        List<String> walk = new ArrayList<>();
        walk.addAll(ids(first));
        walk.addAll(ids(second));
        walk.addAll(ids(third));
        assertEquals(List.of(a, b, c), walk);
    }

    @Test
    void terminalRowsAreFilteredBeforePaging() {
        List<SagaStore.SagaRecord> rows = new ArrayList<>(records(3));
        rows.add(record(id(9), Instant.parse("2026-01-01T00:00:00Z"), SagaStatus.COMPLETED));
        rows.add(record(id(8), Instant.parse("2026-01-01T00:00:00.000001Z"), SagaStatus.COMPENSATED));
        SagaStore.UnfinishedPage page = UnfinishedSagaPaging.slice(rows, null, 10);
        assertEquals(List.of(id(0), id(1), id(2)), ids(page));
        assertFalse(page.hasMore());
    }

    private static List<String> ids(SagaStore.UnfinishedPage page) {
        return page.items().stream().map(SagaStore.SagaRecord::sagaId).toList();
    }

    private static List<SagaStore.SagaRecord> records(int count) {
        List<SagaStore.SagaRecord> rows = new ArrayList<>();
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        for (int index = 0; index < count; index++) {
            rows.add(record(id(index), start.plusMillis(index), SagaStatus.STARTED));
        }
        return rows;
    }

    private static SagaStore.SagaRecord record(String sagaId, Instant updatedAt, SagaStatus status) {
        return record(sagaId, updatedAt, updatedAt, status);
    }

    private static SagaStore.SagaRecord record(String sagaId, Instant updatedAt, Instant startedAt, SagaStatus status) {
        return new SagaStore.SagaRecord(sagaId, "enrolment", "corr", status, "step", 1, null, null, updatedAt,
                startedAt);
    }

    private static String id(int index) {
        return UUID.nameUUIDFromBytes(("saga-" + index).getBytes()).toString();
    }
}
