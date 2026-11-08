package com.englishflow.workflow.adapter.http;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.englishflow.workflow.application.SagaService;
import com.englishflow.workflow.application.WorkflowRequestIdempotency;
import com.englishflow.workflow.domain.SagaStatus;
import com.englishflow.workflow.domain.SagaStore;
import com.englishflow.workflow.domain.UnfinishedSagaPaging;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class SagaUnfinishedPaginationTest {

    @Test
    void unfinishedHonorsCursorPageSizeAndEnvelope() {
        MemoryStore store = MemoryStore.withUnfinished(5);
        SagaController controller = controller(store);

        ResponseEntity<Map<String, Object>> first = controller.unfinished(null, 2, "req_pagination01",
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        assertEquals(200, first.getStatusCode().value());
        assertEquals("req_pagination01", first.getHeaders().getFirst("X-Request-Id"));
        assertEquals("v1", first.getHeaders().getFirst("X-API-Version"));
        List<String> firstIds = ids(first);
        assertEquals(List.of(store.id(0), store.id(1)), firstIds);
        Map<?, ?> firstMeta = meta(first);
        assertEquals(Boolean.TRUE, firstMeta.get("hasMore"));
        assertEquals(2, firstMeta.get("pageSize"));
        String next = (String) firstMeta.get("nextCursor");

        ResponseEntity<Map<String, Object>> second = controller.unfinished(next, 2, null, null);
        List<String> secondIds = ids(second);
        assertEquals(List.of(store.id(2), store.id(3)), secondIds);
        assertTrue(java.util.Collections.disjoint(firstIds, secondIds));

        ResponseEntity<Map<String, Object>> last = controller.unfinished((String) meta(second).get("nextCursor"), 2,
                null, null);
        assertEquals(List.of(store.id(4)), ids(last));
        assertEquals(Boolean.FALSE, meta(last).get("hasMore"));
        assertNull(meta(last).get("nextCursor"));
    }

    @Test
    void unfinishedRejectsInvalidCursorAndPageSize() {
        SagaController controller = controller(MemoryStore.withUnfinished(1));
        ResponseStatusException cursor = assertThrows(ResponseStatusException.class,
                () -> controller.unfinished("!!!!!!!!", 2, null, null));
        assertEquals(400, cursor.getStatusCode().value());
        ResponseStatusException size = assertThrows(ResponseStatusException.class,
                () -> controller.unfinished(null, 0, null, null));
        assertEquals(400, size.getStatusCode().value());
    }

    @Test
    void unfinishedEmptyPageKeepsCanonicalMeta() {
        ResponseEntity<Map<String, Object>> response = controller(new MemoryStore()).unfinished(null, null, null, null);
        assertEquals(List.of(), ids(response));
        Map<?, ?> meta = meta(response);
        assertEquals(Boolean.FALSE, meta.get("hasMore"));
        assertEquals(20, meta.get("pageSize"));
        assertNull(meta.get("nextCursor"));
        assertEquals("v1", meta.get("apiVersion"));
    }

    @SuppressWarnings("unchecked")
    private static List<String> ids(ResponseEntity<Map<String, Object>> response) {
        return (List<String>) response.getBody().get("data");
    }

    private static Map<?, ?> meta(ResponseEntity<Map<String, Object>> response) {
        return (Map<?, ?>) response.getBody().get("meta");
    }

    private static SagaController controller(SagaStore store) {
        return new SagaController(new SagaService(store, new com.englishflow.workflow.application.SagaCompensationExecutor(store)),
                (step) -> { }, (name) -> { }, mock(WorkflowRequestIdempotency.class));
    }

    private static final class MemoryStore implements SagaStore {
        private final Map<String, SagaRecord> rows = new LinkedHashMap<>();

        static MemoryStore withUnfinished(int count) {
            MemoryStore store = new MemoryStore();
            Instant start = Instant.parse("2026-01-01T00:00:00Z");
            for (int index = 0; index < count; index++) {
                String sagaId = store.id(index);
                store.rows.put(sagaId, new SagaRecord(sagaId, "enrolment", "corr-" + index, SagaStatus.STARTED,
                        "step", 1, null, null, start.plusMillis(index)));
            }
            return store;
        }

        String id(int index) {
            return UUID.nameUUIDFromBytes(("unfinished-" + index).getBytes()).toString();
        }

        @Override
        public void start(String sagaId, String sagaName, String correlationId) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void recordStepPlanned(String sagaId, String stepName, int stepOrder, String compensationName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void markStepStarted(String sagaId, String stepName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void markStepCompleted(String sagaId, String stepName) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void markStepFailed(String sagaId, String stepName, String errorCode, String errorMessage) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void markCompensation(String sagaId, String stepName, boolean succeeded, String errorMessage) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void updateStatus(String sagaId, SagaStatus status, String currentStep, String errorCode, String errorMessage) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Optional<SagaRecord> find(String sagaId) {
            return Optional.ofNullable(rows.get(sagaId));
        }

        @Override
        public List<SagaStepRecord> steps(String sagaId) {
            return List.of();
        }

        @Override
        public UnfinishedPage unfinishedPage(String cursor, int pageSize) {
            return UnfinishedSagaPaging.slice(new ArrayList<>(rows.values()), cursor, pageSize);
        }
    }
}
