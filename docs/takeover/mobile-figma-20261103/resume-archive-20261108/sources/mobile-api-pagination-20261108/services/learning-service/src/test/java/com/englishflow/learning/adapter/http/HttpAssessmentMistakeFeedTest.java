package com.englishflow.learning.adapter.http;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HttpAssessmentMistakeFeedTest {
    @Test
    void theFeedReadsTheAdmittedFactWithoutTheAnswer() {
        String body = """
                {"data":{"items":[{"itemId":266004,"scoreBucket":"ZERO","errorCategory":"UNCLASSIFIED",
                "contentCode":"p1.placement.v1","reasonTrace":[{"sourceAttemptId":"aatm_1","errorCategory":"UNCLASSIFIED"}],
                "answerHash":"hidden"}],"count":1}}
                """;
        List<Map<String, Object>> facts = new HttpAssessmentMistakeFeed(new ObjectMapper(), "http://127.0.0.1:18091")
                .parse(body);
        assertEquals(1, facts.size());
        assertEquals(266004, facts.getFirst().get("itemId"));
        assertEquals("ZERO", facts.getFirst().get("scoreBucket"));
        assertEquals("aatm_1", facts.getFirst().get("sourceAttemptId"));
        org.junit.jupiter.api.Assertions.assertFalse(facts.getFirst().containsKey("answerHash"));
    }

    @Test
    void theFeedReadsCanonicalCursorMetaAndLeavesCursorStateOutOfFacts() {
        String body = """
                {"data":{"items":[{"itemId":7,"scoreBucket":"ZERO","errorCategory":"UNCLASSIFIED",
                "contentCode":"p1.placement.v1","sourceAttemptId":"aatm_2"}],"count":1},
                "meta":{"hasMore":true,"pageSize":1,"nextCursor":"v1.mid.7xxxxxxxx"}}
                """;
        HttpAssessmentMistakeFeed feed = new HttpAssessmentMistakeFeed(new ObjectMapper(), "http://127.0.0.1:18091");
        HttpAssessmentMistakeFeed.Page page = feed.parsePage(body);
        assertEquals(1, page.facts().size());
        assertEquals(7, page.facts().getFirst().get("itemId"));
        assertEquals(true, page.hasMore());
        assertEquals("v1.mid.7xxxxxxxx", page.nextCursor());
        org.junit.jupiter.api.Assertions.assertFalse(page.facts().getFirst().containsKey("nextCursor"));
        org.junit.jupiter.api.Assertions.assertFalse(page.facts().getFirst().containsKey("hasMore"));
    }
}
