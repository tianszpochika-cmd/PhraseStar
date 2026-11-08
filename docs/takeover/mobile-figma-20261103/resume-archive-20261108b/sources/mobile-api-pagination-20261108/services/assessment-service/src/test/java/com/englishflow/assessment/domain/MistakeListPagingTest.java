package com.englishflow.assessment.domain;

import java.time.Instant;
import java.util.List;
import java.util.stream.IntStream;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MistakeListPagingTest {

    @Test
    void firstNextEmptyBoundaryAndInvalidCursor() {
        List<AssessmentMistake> rows = IntStream.rangeClosed(1, 5).mapToObj(MistakeListPagingTest::mistake).toList();
        MistakeListPaging.Page<AssessmentMistake> first = MistakeListPaging.slice(rows, null, 2, AssessmentMistake::mistakeId);
        assertEquals(List.of(1L, 2L), ids(first));
        assertTrue(first.hasMore());
        assertEquals(2, first.pageSize());

        MistakeListPaging.Page<AssessmentMistake> next = MistakeListPaging.slice(rows, first.nextCursor(), 2,
                AssessmentMistake::mistakeId);
        assertEquals(List.of(3L, 4L), ids(next));
        assertTrue(java.util.Collections.disjoint(ids(first), ids(next)));

        MistakeListPaging.Page<AssessmentMistake> last = MistakeListPaging.slice(rows, next.nextCursor(), 2,
                AssessmentMistake::mistakeId);
        assertEquals(List.of(5L), ids(last));
        assertFalse(last.hasMore());
        assertNull(last.nextCursor());

        MistakeListPaging.Page<AssessmentMistake> empty = MistakeListPaging.slice(List.of(), null, 20,
                AssessmentMistake::mistakeId);
        assertTrue(empty.items().isEmpty());
        assertFalse(empty.hasMore());
        assertEquals(20, empty.pageSize());

        MistakeListPaging.Page<AssessmentMistake> exact = MistakeListPaging.slice(rows.subList(0, 2), null, 2,
                AssessmentMistake::mistakeId);
        assertFalse(exact.hasMore());
        assertNull(exact.nextCursor());

        assertThrows(AssessmentDomainException.class, () -> MistakeListPaging.decode("short"));
        assertThrows(AssessmentDomainException.class, () -> MistakeListPaging.decode("!!!!!!!!"));
        assertThrows(AssessmentDomainException.class, () -> MistakeListPaging.requestPageSize(0));
        assertThrows(AssessmentDomainException.class, () -> MistakeListPaging.requestPageSize(101));
        assertEquals(20, MistakeListPaging.requestPageSize(null));
    }

    private static List<Long> ids(MistakeListPaging.Page<AssessmentMistake> page) {
        return page.items().stream().map(AssessmentMistake::mistakeId).toList();
    }

    private static AssessmentMistake mistake(int id) {
        return new AssessmentMistake(id, AssessmentPrincipal.authenticated("prn_learner0000000001", "platform"),
                id, id, "UNCLASSIFIED", "v1", "a".repeat(64), Instant.parse("2026-01-01T00:00:00Z"));
    }
}
