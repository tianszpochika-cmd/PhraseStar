package com.englishflow.workflow.adapter.http;

import com.englishflow.workflow.application.CompensationTransport;
import com.englishflow.workflow.application.SagaService;
import com.englishflow.workflow.application.WorkflowRequestIdempotency;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.englishflow.workflow.domain.SagaStore;
import com.englishflow.workflow.domain.UnfinishedSagaPaging;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The saga boundary.
 *
 * <p>Compensation is a separate endpoint from starting a saga, and it is not automatic on failure. Deciding
 * when to undo completed work is an operational judgement — the failure may be transient and the work still
 * wanted — so the service moves the saga to compensating and leaves the decision, and the audit of who made
 * it, to a caller that can be held responsible.
 */
@RestController
@RequestMapping("/internal/v1/workflow/sagas")
public class SagaController {

    private final SagaService service;
    private final SagaCompensationExecutorAdapter compensation;
    private final CompensationTransport compensationTransport;
    private final WorkflowRequestIdempotency idempotency;

    public SagaController(SagaService service, SagaCompensationExecutorAdapter compensation,
            CompensationTransport compensationTransport, WorkflowRequestIdempotency idempotency) {
        this.service = service;
        this.compensation = compensation;
        this.compensationTransport = compensationTransport;
        this.idempotency = idempotency;
    }

    /** Starts a saga and reports where it got to. */
    @PostMapping
    public ResponseEntity<Map<String, Object>> start(@RequestBody StartSagaBody body) {
        List<SagaService.Step> steps = body.steps().stream()
                .map((step) -> new SagaService.Step(step.name(), step.compensation(),
                        () -> compensation.run(step.name())))
                .toList();
        SagaService.SagaView view = service.start(body.sagaName(), body.correlationId(), steps);
        return ResponseEntity.status(201).body(view.toMap());
    }

    /** Reads a saga and its steps. */
    @GetMapping("/{sagaId}")
    public ResponseEntity<Map<String, Object>> find(@PathVariable String sagaId) {
        return ResponseEntity.ok(service.find(sagaId).toMap());
    }

    /** Compensates a failed saga. Refused unless it is awaiting compensation. */
    @PostMapping("/{sagaId}/compensate")
    public ResponseEntity<Map<String, Object>> compensate(@AuthenticationPrincipal Jwt jwt,
                                                            @PathVariable String sagaId,
                                                            @RequestBody(required = false) Map<String, Object> body,
                                                            @RequestHeader(value = "Idempotency-Key", required = false) String key) {
        Map<String, Object> input = body == null ? Map.of() : body;
        String actor = jwt == null ? null : jwt.getSubject();
        String tenant = jwt == null ? null : jwt.getClaimAsString("tenant_id");
        return ResponseEntity.ok(idempotency.executeSagaCompensation(tenant, actor, key, sagaId, input, () -> {
            if (!input.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "compensation body must be empty");
            }
            try {
                return service.compensate(sagaId, compensationTransport::send).toMap();
            } catch (IllegalStateException conflict) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "saga is not awaiting compensation", conflict);
            }
        }));
    }

    /** Sagas still in flight, for the recovery sweep and for an operator looking at what is stuck. */
    @GetMapping("/unfinished")
    public ResponseEntity<Map<String, Object>> unfinished(
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Trace-Id", required = false) String traceId) {
        try {
            int size = UnfinishedSagaPaging.requestPageSize(pageSize);
            SagaStore.UnfinishedPage page = service.unfinishedPage(cursor, size);
            List<String> ids = page.items().stream().map(SagaStore.SagaRecord::sagaId).toList();
            String resolvedRequestId = canonicalRequestId(requestId);
            String resolvedTraceId = canonicalTraceId(traceId);
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("requestId", resolvedRequestId);
            meta.put("traceId", resolvedTraceId);
            meta.put("apiVersion", "v1");
            meta.put("schemaVersion", "1.0.0");
            meta.put("serverTime", Instant.now().toString());
            meta.put("hasMore", page.hasMore());
            meta.put("pageSize", page.pageSize());
            meta.put("nextCursor", page.nextCursor());
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("data", ids);
            body.put("meta", meta);
            return ResponseEntity.ok()
                    .header("X-Request-Id", resolvedRequestId)
                    .header("X-Trace-Id", resolvedTraceId)
                    .header("X-API-Version", "v1")
                    .body(body);
        } catch (IllegalArgumentException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, invalid.getMessage(), invalid);
        }
    }

    private static String canonicalRequestId(String value) {
        String candidate = value == null ? "" : value.trim();
        if (candidate.matches("^[A-Za-z][A-Za-z0-9._-]{7,127}$")) {
            return candidate;
        }
        return "req_" + UUID.randomUUID().toString().replace("-", "");
    }

    private static String canonicalTraceId(String value) {
        String candidate = value == null ? "" : value.trim();
        if (candidate.matches("^[a-f0-9]{32}$")) {
            return candidate;
        }
        return UUID.randomUUID().toString().replace("-", "");
    }

    /** The body of a start request. */
    public record StartSagaBody(String sagaName, String correlationId, List<StepBody> steps) {
    }

    /** One requested step. */
    public record StepBody(String name, String compensation) {
    }

    /**
     * Where the actual work happens.
     *
     * <p>An interface rather than a bean holding logic: this service owns saga state and never performs
     * another owner's work, so the boundary has to be told what running a step means. A caller that wires this
     * to something that writes another owner's tables would be doing so through this type, visibly.
     */
    public interface SagaCompensationExecutorAdapter {
        void run(String stepName);
    }
}
