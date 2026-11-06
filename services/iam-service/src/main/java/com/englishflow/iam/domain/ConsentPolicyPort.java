package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Server-owned published consent policy boundary. */
public interface ConsentPolicyPort {

    ConsentPolicyDescriptor descriptor(ConsentType type);

    default ConsentVersion currentVersion(ConsentType type) {
        return descriptor(type).documentVersion();
    }

    /** Whether this policy has been explicitly provisioned for write decisions. */
    default boolean writesEnabled() {
        return true;
    }

    /** Whether the descriptors may be used as authorization facts, not merely displayed. */
    default boolean evaluationEnabled() {
        return true;
    }

    /**
     * First ACTIVE row of each storage spelling, with that row's body, in control-plane order.
     * Empty when the read fails. Older and missing rows are not included. Token issuance and
     * consent writes must not call this method.
     */
    default Optional<List<ActivePublishedDocument>> activePublishedDocuments() {
        return Optional.empty();
    }

    /** One ACTIVE control-plane row and the plain text stored on that same row. */
    record ActivePublishedDocument(ConsentPolicyDescriptor descriptor, String body) {}

    default Set<ConsentPolicyDescriptor> descriptors() {
        return Set.copyOf(Arrays.stream(ConsentType.values())
                .map(this::descriptor)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
    }

    default Set<String> requiredPurposesFor(String capability) {
        return descriptors().stream()
                .filter(value -> value.requiredFor(capability))
                .map(ConsentPolicyDescriptor::purpose)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    default boolean current(ConsentPolicyDescriptor descriptor, Instant now) {
        return descriptor != null && descriptor.isPublishedAt(now);
    }
}
