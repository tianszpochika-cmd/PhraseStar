package com.englishflow.learning.adapter.http;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import tools.jackson.databind.ObjectMapper;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import com.sun.net.httpserver.HttpServer;

class AssessmentMistakeQueueProjectorTest {
    @Test
    void aZeroFactIsWrittenOnceAndAFullFactIsNot() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(), any(), any())).thenReturn(0);
        AssessmentMistakeQueueProjector projector = AssessmentMistakeQueueProjector.http(
                new ObjectMapper(), "http://127.0.0.1:18091");
        int written = projector.write(jdbc, "prn_learner", List.of(
                Map.of("scoreBucket", "FULL", "itemId", "1", "sourceAttemptId", "aatm_full"),
                Map.of("scoreBucket", "ZERO", "itemId", "266004", "sourceAttemptId", "aatm_1",
                        "contentCode", "p1.placement.v1", "errorCategory", "UNCLASSIFIED")));
        org.junit.jupiter.api.Assertions.assertEquals(1, written);
        verify(jdbc).update(org.mockito.ArgumentMatchers.contains("INSERT INTO b3_learning_interaction"),
                any(), eq("platform"), eq("prn_learner"), eq("GRAMMAR"), eq("ASSESSMENT_ZERO"),
                eq("266004"), eq("assessment-zero:prn_learner:266004"), any(), any());
    }

    @Test
    void anExistingTargetIsNotInsertedAgain() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(Integer.class), any(), any(), any())).thenReturn(1);
        AssessmentMistakeQueueProjector projector = AssessmentMistakeQueueProjector.http(
                new ObjectMapper(), "http://127.0.0.1:18091");
        int written = projector.write(jdbc, "prn_learner", List.of(
                Map.of("scoreBucket", "ZERO", "itemId", "266004", "sourceAttemptId", "aatm_1")));
        org.junit.jupiter.api.Assertions.assertEquals(0, written);
        verify(jdbc, never()).update(anyString(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void projectDoesNotWriteWhenTheHttpWalkFailsOnTheFirstPage() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/assessment/mistakes", exchange -> {
            byte[] body = "denied".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(403, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        try {
            JdbcTemplate jdbc = mock(JdbcTemplate.class);
            AssessmentMistakeQueueProjector projector = AssessmentMistakeQueueProjector.http(
                    new ObjectMapper(), "http://127.0.0.1:" + server.getAddress().getPort());
            ResponseStatusException thrown = assertThrows(ResponseStatusException.class,
                    () -> projector.project(jdbc, "prn_learner", "token"));
            assertEquals(HttpStatus.FORBIDDEN, thrown.getStatusCode());
            verify(jdbc, never()).update(anyString(), any(), any(), any(), any(), any(), any(), any(), any(), any());
            verify(jdbc, never()).queryForObject(anyString(), eq(Integer.class), any(), any(), any());
        } finally {
            server.stop(0);
        }
    }

    @Test
    void projectDoesNotWriteWhenALaterPageFails() throws Exception {
        java.util.concurrent.atomic.AtomicInteger calls = new java.util.concurrent.atomic.AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/assessment/mistakes", exchange -> {
            int n = calls.incrementAndGet();
            if (n == 1) {
                byte[] body = """
                        {"data":{"items":[{"itemId":1,"scoreBucket":"ZERO"}],"count":1},
                         "meta":{"hasMore":true,"pageSize":100,"nextCursor":"cursor-a"}}
                        """.getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, body.length);
                exchange.getResponseBody().write(body);
            } else {
                byte[] body = "denied".getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(401, body.length);
                exchange.getResponseBody().write(body);
            }
            exchange.close();
        });
        server.start();
        try {
            JdbcTemplate jdbc = mock(JdbcTemplate.class);
            AssessmentMistakeQueueProjector projector = AssessmentMistakeQueueProjector.http(
                    new ObjectMapper(), "http://127.0.0.1:" + server.getAddress().getPort());
            ResponseStatusException thrown = assertThrows(ResponseStatusException.class,
                    () -> projector.project(jdbc, "prn_learner", "token"));
            assertEquals(HttpStatus.UNAUTHORIZED, thrown.getStatusCode());
            verify(jdbc, never()).update(anyString(), any(), any(), any(), any(), any(), any(), any(), any(), any());
            verify(jdbc, never()).queryForObject(anyString(), eq(Integer.class), any(), any(), any());
        } finally {
            server.stop(0);
        }
    }
}
