package com.englishflow.iam.domain;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * Server-owned consent policy source backed by the IAM consent-document control table. Only
 * ACTIVE rows are selectable and the latest published document wins per type. A missing, revoked,
 * corrupt or unreadable row is an unavailable policy, never an implicit grant.
 */
public class JdbcConsentPolicy implements ConsentPolicyPort {

    // Metadata only. Plain text stays out of descriptor reads used by token issuance and consent writes.
    private static final String ACTIVE_COLUMNS =
            "consent_type, document_version, document_digest, published_at, policy_version, "
                    + "policy_digest, requirement, capabilities, withdrawal_effect, revoke_sessions, "
                    + "policy_ref, runtime_status";
    private static final String ACTIVE_SELECT =
            "SELECT " + ACTIVE_COLUMNS + " FROM iam_consent_document_version "
                    + "WHERE tenant_id = ? AND lifecycle_status = 'ACTIVE' "
                    + "ORDER BY consent_type ASC, published_at DESC, consent_document_id DESC";
    // Rank without the body, then read document_body only for that winning row of each spelling.
    private static final String ACTIVE_BODY_SELECT =
            "SELECT " + ACTIVE_COLUMNS + ", document_body FROM iam_consent_document_version src "
                    + "INNER JOIN (SELECT consent_document_id FROM ("
                    + "SELECT consent_document_id, ROW_NUMBER() OVER (PARTITION BY consent_type "
                    + "ORDER BY published_at DESC, consent_document_id DESC) AS body_rank "
                    + "FROM iam_consent_document_version "
                    + "WHERE tenant_id = ? AND lifecycle_status = 'ACTIVE') ranked WHERE body_rank = 1"
                    + ") winner ON winner.consent_document_id = src.consent_document_id "
                    + "ORDER BY src.consent_type ASC, src.published_at DESC, src.consent_document_id DESC";

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public JdbcConsentPolicy(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = Objects.requireNonNull(jdbc, "jdbc");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    }

    @Override
    public ConsentPolicyDescriptor descriptor(ConsentType type) {
        Objects.requireNonNull(type, "type");
        ConsentPolicyDescriptor descriptor = activeDescriptors().get(type);
        if (descriptor == null) {
            throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                    "iam.consent.version_unavailable");
        }
        return descriptor;
    }

    @Override
    public Set<ConsentPolicyDescriptor> descriptors() {
        return Set.copyOf(activeDescriptors().values());
    }

    @Override
    public boolean writesEnabled() {
        return true;
    }

    @Override
    public boolean evaluationEnabled() {
        return true;
    }

    /**
     * One snapshot of the first ACTIVE row per storage spelling. Alias mapping uses the same
     * {@code map} row reader and source order as descriptor reads.
     */
    @Override
    public Optional<List<ConsentPolicyPort.ActivePublishedDocument>> activePublishedDocuments() {
        try {
            List<ConsentPolicyPort.ActivePublishedDocument> rows = jdbc.query(ACTIVE_BODY_SELECT,
                    (ResultSet rs, int rowNum) -> new ConsentPolicyPort.ActivePublishedDocument(
                            map(rs), rs.getString("document_body")),
                    TenantScope.PLATFORM_TENANT);
            EnumMap<ConsentType, ConsentPolicyPort.ActivePublishedDocument> first = new EnumMap<>(ConsentType.class);
            List<ConsentPolicyPort.ActivePublishedDocument> winners = new ArrayList<>();
            for (ConsentPolicyPort.ActivePublishedDocument row : rows) {
                if (first.putIfAbsent(row.descriptor().type(), row) == null) {
                    winners.add(row);
                }
            }
            return Optional.of(List.copyOf(winners));
        } catch (RuntimeException exception) {
            return Optional.empty();
        }
    }

    private Map<ConsentType, ConsentPolicyDescriptor> activeDescriptors() {
        try {
            List<ConsentPolicyDescriptor> rows = jdbc.query(ACTIVE_SELECT,
                    (ResultSet rs, int rowNum) -> map(rs), TenantScope.PLATFORM_TENANT);
            EnumMap<ConsentType, ConsentPolicyDescriptor> byType = new EnumMap<>(ConsentType.class);
            for (ConsentPolicyDescriptor descriptor : rows) {
                // The ordered select puts the latest published document first for every type, so
                // the first row wins without a per-type query.
                byType.putIfAbsent(descriptor.type(), descriptor);
            }
            return byType;
        } catch (DataAccessException | IllegalArgumentException exception) {
            throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE,
                    "iam.consent.policy_unavailable");
        }
    }

    private ConsentPolicyDescriptor map(ResultSet rs) throws java.sql.SQLException {
        ConsentType type = ConsentType.fromLegacyStorage(rs.getString("consent_type"));
        return new ConsentPolicyDescriptor(type, type.purpose(),
                new ConsentVersion(rs.getString("document_version")), rs.getString("document_digest"),
                Instant.ofEpochMilli(rs.getTimestamp("published_at").getTime()),
                new ConsentVersion(rs.getString("policy_version")), rs.getString("policy_digest"),
                ConsentPolicyDescriptor.Requirement.valueOf(rs.getString("requirement")),
                capabilities(rs.getString("capabilities")),
                ConsentPolicyDescriptor.WithdrawalEffect.valueOf(rs.getString("withdrawal_effect")),
                rs.getBoolean("revoke_sessions"), rs.getString("policy_ref"),
                rs.getString("runtime_status"));
    }

    private Set<String> capabilities(String json) {
        try {
            List<String> values = objectMapper.readValue(json, new TypeReference<List<String>>() {});
            return values == null ? Set.of() : Set.copyOf(values);
        } catch (IOException exception) {
            throw new IllegalArgumentException("consent document capabilities are invalid", exception);
        }
    }
}
