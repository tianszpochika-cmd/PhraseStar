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
        return new SagaStore.SagaRecord(sagaId, "enrolment", "corr", status, "step", 1, null, null, updatedAt);
    }

    private static String id(int index) {
        return UUID.nameUUIDFromBytes(("saga-" + index).getBytes()).toString();
    }
}
