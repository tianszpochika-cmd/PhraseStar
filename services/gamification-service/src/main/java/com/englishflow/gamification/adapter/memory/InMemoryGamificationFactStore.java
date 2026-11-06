package com.englishflow.gamification.adapter.memory;

import com.englishflow.gamification.domain.UserFacts;
import com.englishflow.gamification.port.GamificationFactStore;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/** Deterministic local adapter used by smoke tests and the no-infrastructure dev profile. */
public final class InMemoryGamificationFactStore implements GamificationFactStore {

    private final ConcurrentHashMap<String, UserFacts> factsBySubject = new ConcurrentHashMap<>();

    @Override
    public <T> T inUserTransaction(String subjectId, Function<UserFacts, T> work) {
        UserFacts facts = factsBySubject.computeIfAbsent(subjectId, UserFacts::new);
        synchronized (facts) {
            return work.apply(facts);
        }
    }

    @Override
    public <T> T inUserReadTransaction(String subjectId, Function<UserFacts, T> work) {
        Objects.requireNonNull(work, "work");
        UserFacts current = factsBySubject.get(subjectId);
        if (current == null) {
            return work.apply(new UserFacts(subjectId));
        }
        UserFacts snapshot;
        synchronized (current) {
            snapshot = detachedCopy(current);
        }
        return work.apply(snapshot);
    }

    /** Copies owned facts so a read callback cannot mutate the shared aggregate. */
    private static UserFacts detachedCopy(UserFacts source) {
        return source.ownedCopy();
    }
}
