package com.englishflow.learning.adapter.http;

/**
 * The assessment mistake walk did not finish. Callers must not treat a prefix
 * or an empty list as the owner book.
 */
public final class AssessmentMistakeFeedException extends RuntimeException {
    private final int statusCode;

    public AssessmentMistakeFeedException(int statusCode, String message) {
        super(message);
        this.statusCode = statusCode;
    }

    public AssessmentMistakeFeedException(int statusCode, String message, Throwable cause) {
        super(message, cause);
        this.statusCode = statusCode;
    }

    public int statusCode() {
        return statusCode;
    }
}
