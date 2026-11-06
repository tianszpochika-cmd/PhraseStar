package com.englishflow.gamification.port;

import com.englishflow.gamification.domain.UserFacts;
import java.util.function.Function;

/** Transaction seam for the service-owned gamification facts. */
public interface GamificationFactStore {

    <T> T inUserTransaction(String subjectId, Function<UserFacts, T> work);

    /**
     * Loads one subject's owned facts inside the store transaction and does not append them.
     * Callers must not observe a later write, and implementations must not publish the aggregate.
     */
    <T> T inUserReadTransaction(String subjectId, Function<UserFacts, T> work);
}
