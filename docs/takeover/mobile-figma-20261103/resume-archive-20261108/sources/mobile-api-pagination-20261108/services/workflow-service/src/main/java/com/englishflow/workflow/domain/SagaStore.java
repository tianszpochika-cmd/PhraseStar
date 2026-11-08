package com.englishflow.workflow.domain;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Where a saga's state lives.
 *
 * <p>A port rather than a repository class so the service can be tested against real MySQL and against an
 * in-memory implementation, and so nothing in the domain layer reaches for a DataSource.
 */
public interface SagaStore {

    /** Creates a saga row. The correlation is what lets a caller find a saga from the request that started it. */
    void start(String sagaId, String sagaName, String correlationId);

    /**
     * Records a step's compensation before the step is attempted.
     *
     * <p>This ordering is the whole point: if the compensation is recorded afterwards, a crash between doing
     * the work and recording how to undo it leaves a step that can never be compensated. Recording first
     * means the worst case is a compensation for work that did not happen, which is recoverable, rather than
     * work that cannot be undone at all.
     */
    void recordStepPlanned(String sagaId, String stepName, int stepOrder, String compensationName);

    /** Marks a step as started. */
    void markStepStarted(String sagaId, String stepName);

    /** Marks a step as completed, which is what makes it eligible for compensation. */
    void markStepCompleted(String sagaId, String stepName);

    /** Marks a step as failed with the code and message to keep. */
    void markStepFailed(String sagaId, String stepName, String errorCode, String errorMessage);

    /** Marks a compensation as applied or failed. */
    void markCompensation(String sagaId, String stepName, boolean succeeded, String errorMessage);

    /** Sets the saga's own status and current step. */
    void updateStatus(String sagaId, SagaStatus status, String currentStep, String errorCode, String errorMessage);

    /** Reads a saga. */
    Optional<SagaRecord> find(String sagaId);

    /** The steps of a saga in the order they were planned. */
    List<SagaStepRecord> steps(String sagaId);

    /** One cursor page of unfinished sagas. {@code nextCursor} is derived from the last returned row. */
    record UnfinishedPage(List<SagaRecord> items, boolean hasMore, String nextCursor, int pageSize) {
        public UnfinishedPage {
            items = items == null ? List.of() : List.copyOf(items);
        }
    }

    /**
     * Unfinished sagas after owner/status filters, oldest first, then {@code saga_id}.
     * {@code cursor} is opaque; a blank cursor is the first page.
     */
    UnfinishedPage unfinishedPage(String cursor, int pageSize);

    /** Statuses of every unfinished saga, oldest first, for the recovery sweep. */
    default List<SagaRecord> unfinished(int limit) {
        return unfinishedPage(null, UnfinishedSagaPaging.clampLimit(limit)).items();
    }

    /** A saga's own row. {@code updatedAt} participates in the unfinished list keyset. */
    record SagaRecord(String sagaId, String sagaName, String correlationId, SagaStatus status, String currentStep,
                      int attemptCount, String lastErrorCode, String lastErrorMessage, java.time.Instant updatedAt) {
    }

    /** A step's row. */
    record SagaStepRecord(String sagaId, String stepName, int stepOrder, String status, String compensationName,
                          String compensationState, int attemptCount, String lastErrorCode, String lastErrorMessage) {
    }

    /** The compensation recorded for each of a saga's completed steps, keyed by step name. */
    static Map<String, String> completedCompensations(List<SagaStepRecord> steps) {
        Map<String, String> compensations = new java.util.LinkedHashMap<>();
        for (SagaStepRecord step : steps) {
            if ("COMPLETED".equals(step.status()) && step.compensationName() != null) {
                compensations.put(step.stepName(), step.compensationName());
            }
        }
        return compensations;
    }
}
