package com.englishflow.assessment.adapter.jdbc;

import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;

import com.englishflow.assessment.domain.MistakeListPaging;

/**
 * Owner-scoped mistake list. Filters tenant and subject before the unique
 * {@code mistake_id} keyset; it never joins another service schema.
 */
public final class JdbcAssessmentMistakeList {

    private final JdbcTemplate jdbc;

    public JdbcAssessmentMistakeList(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public MistakeListPaging.Page<Map<String, Object>> page(String tenantId, String subjectId, String cursor,
            Integer pageSize) {
        int size = MistakeListPaging.requestPageSize(pageSize);
        Long afterId = MistakeListPaging.decode(cursor);
        List<Map<String, Object>> fetched;
        if (afterId == null) {
            fetched = jdbc.queryForList("""
                    SELECT * FROM assessment_mistake WHERE tenant_id = ? AND subject_id = ?
                     ORDER BY mistake_id LIMIT ?
                    """, tenantId, subjectId, size + 1);
        } else {
            fetched = jdbc.queryForList("""
                    SELECT * FROM assessment_mistake WHERE tenant_id = ? AND subject_id = ?
                       AND mistake_id > ?
                     ORDER BY mistake_id LIMIT ?
                    """, tenantId, subjectId, afterId, size + 1);
        }
        boolean hasMore = fetched.size() > size;
        List<Map<String, Object>> items = hasMore ? List.copyOf(fetched.subList(0, size)) : List.copyOf(fetched);
        String nextCursor = null;
        if (hasMore) {
            nextCursor = MistakeListPaging.encode(mistakeId(items.get(items.size() - 1)));
        }
        return new MistakeListPaging.Page<>(items, hasMore, nextCursor, size);
    }

    private static long mistakeId(Map<String, Object> row) {
        Object value = row.get("mistake_id");
        if (value instanceof Number number) {
            return number.longValue();
        }
        throw new IllegalStateException("mistake_id is missing");
    }
}
