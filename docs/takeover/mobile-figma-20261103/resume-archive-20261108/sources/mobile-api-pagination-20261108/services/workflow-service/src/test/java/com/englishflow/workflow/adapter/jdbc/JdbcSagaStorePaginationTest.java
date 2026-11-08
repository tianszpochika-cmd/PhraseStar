package com.englishflow.workflow.adapter.jdbc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.englishflow.workflow.domain.SagaStatus;
import com.englishflow.workflow.domain.SagaStore;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JdbcSagaStorePaginationTest {

    @Test
    void repositoryPagesFromFetchedRowsAndBindsCursor() {
        FakeJdbc jdbc = new FakeJdbc();
        JdbcSagaStore store = new JdbcSagaStore(jdbc);
        Instant start = Instant.parse("2026-01-01T00:00:00Z");
        jdbc.rows = List.of(
                record("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", start),
                record("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", start.plusMillis(1)),
                record("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", start.plusMillis(2)));

        SagaStore.UnfinishedPage first = store.unfinishedPage(null, 2);
        assertEquals(2, first.items().size());
        assertTrue(first.hasMore());
        assertTrue(jdbc.sql.contains("ORDER BY updated_at, saga_id"));
        assertTrue(jdbc.sql.contains("status NOT IN"));
        assertEquals(3, jdbc.args[0]);

        jdbc.rows = List.of(record("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", start.plusMillis(2)));
        SagaStore.UnfinishedPage next = store.unfinishedPage(first.nextCursor(), 2);
        assertEquals(List.of("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3"),
                next.items().stream().map(SagaStore.SagaRecord::sagaId).toList());
        assertFalse(next.hasMore());
        assertNull(next.nextCursor());
        assertEquals(4, jdbc.args.length);
        assertEquals("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", jdbc.args[2]);
        assertEquals(3, jdbc.args[3]);
    }

    private static SagaStore.SagaRecord record(String sagaId, Instant updatedAt) {
        return new SagaStore.SagaRecord(sagaId, "enrolment", "corr", SagaStatus.STARTED, "step", 1, null, null,
                updatedAt);
    }

    private static final class FakeJdbc extends JdbcTemplate {
        String sql;
        Object[] args;
        List<SagaStore.SagaRecord> rows = List.of();

        @Override
        @SuppressWarnings("unchecked")
        public <T> List<T> query(String sql, RowMapper<T> rowMapper, @org.springframework.lang.Nullable Object... args) {
            this.sql = sql;
            this.args = args;
            return (List<T>) rows;
        }
    }
}
