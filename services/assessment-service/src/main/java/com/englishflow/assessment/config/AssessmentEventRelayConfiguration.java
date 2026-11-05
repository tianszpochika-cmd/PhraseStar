package com.englishflow.assessment.config;

import com.englishflow.assessment.adapter.jdbc.JdbcAssessmentOutboxRelay;
import com.englishflow.assessment.integration.AssessmentOutboxKafkaRelay;
import com.englishflow.assessment.port.AssessmentOutboxRelayPort;

import java.time.Clock;
import java.util.HashMap;
import java.util.Map;

import javax.sql.DataSource;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Opt-in composition for the assessment outbox publisher. The configuration, its
 * scheduler, and the broker client exist only when both
 * {@code assessment.events.relay.enabled} and {@code assessment.persistence.enabled}
 * are true. An unconfigured broker must not change delivery, and the deterministic
 * suites keep running without a Kafka container.
 *
 * <p>The producer is idempotent so broker-internal retries cannot duplicate a record.
 * Delivery stays at-least-once. The JDBC transaction template is built from the owner
 * {@code assessmentDataSource} and is not registered as a platform transaction manager.
 * Shutdown closes the producer factory through {@code DisposableBean} and
 * {@code SmartLifecycle}; the factory does not open a producer until the first send.
 */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
@EnableConfigurationProperties({
        AssessmentEventRelayConfiguration.AssessmentEventRelayProperties.class,
        AssessmentPersistenceProperties.class
})
@ConditionalOnProperty(name = {
        "assessment.events.relay.enabled",
        "assessment.persistence.enabled"
}, havingValue = "true")
public class AssessmentEventRelayConfiguration {

    @Bean
    @ConditionalOnMissingBean(AssessmentOutboxRelayPort.class)
    AssessmentOutboxRelayPort assessmentOutboxRelayPort(
            @Qualifier("assessmentDataSource") DataSource assessmentDataSource,
            AssessmentPersistenceProperties persistence) {
        JdbcTemplate jdbc = new JdbcTemplate(assessmentDataSource, true);
        TransactionTemplate transactions = new TransactionTemplate(
                new DataSourceTransactionManager(assessmentDataSource));
        return new JdbcAssessmentOutboxRelay(jdbc, transactions, persistence.getSchema());
    }

    /**
     * Closed when the context stops. {@code start()} does not create a producer, so
     * context refresh does not contact the broker.
     */
    @Bean(destroyMethod = "destroy")
    @ConditionalOnMissingBean(name = "assessmentEventProducerFactory")
    ProducerFactory<String, String> assessmentEventProducerFactory(AssessmentEventRelayProperties properties) {
        return new DefaultKafkaProducerFactory<>(producerConfig(properties));
    }

    @Bean(destroyMethod = "destroy")
    @ConditionalOnMissingBean(name = "assessmentEventKafkaTemplate")
    KafkaTemplate<String, String> assessmentEventKafkaTemplate(
            ProducerFactory<String, String> assessmentEventProducerFactory) {
        return new KafkaTemplate<>(assessmentEventProducerFactory);
    }

    @Bean
    @ConditionalOnMissingBean(AssessmentOutboxKafkaRelay.class)
    AssessmentOutboxKafkaRelay assessmentOutboxKafkaRelay(
            AssessmentOutboxRelayPort assessmentOutboxRelayPort,
            KafkaTemplate<String, String> assessmentEventKafkaTemplate,
            @Qualifier("assessmentClock") Clock assessmentClock) {
        return new AssessmentOutboxKafkaRelay(
                assessmentOutboxRelayPort, assessmentEventKafkaTemplate, assessmentClock);
    }

    /**
     * Idempotent producer settings. {@code max.block.ms} is the relay's 3 second block
     * bound. Request and delivery timeouts stay under the 30 second lease. Kafka 4
     * defaults {@code linger.ms} to 5, so linger is pinned to 0 and the delivery timeout
     * equals the request timeout. That satisfies
     * {@code delivery.timeout.ms >= linger.ms + request.timeout.ms} without extending
     * either timeout to the lease.
     */
    static Map<String, Object> producerConfig(AssessmentEventRelayProperties properties) {
        Map<String, Object> config = new HashMap<>();
        config.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, properties.getBootstrapServers());
        config.put(ProducerConfig.CLIENT_ID_CONFIG, "assessment-service");
        config.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        config.put(ProducerConfig.ACKS_CONFIG, "all");
        config.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        config.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        config.put(ProducerConfig.LINGER_MS_CONFIG, 0L);
        config.put(ProducerConfig.MAX_BLOCK_MS_CONFIG, AssessmentOutboxKafkaRelay.MAX_BLOCK.toMillis());
        int acknowledgementMs = (int) AssessmentOutboxKafkaRelay.ACK_WAIT.toMillis();
        config.put(ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG, acknowledgementMs);
        config.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, acknowledgementMs);
        return config;
    }

    /** Broker endpoint for the opt-in relay. The topic stays the publisher constant. */
    @ConfigurationProperties(prefix = "assessment.events.relay")
    public static class AssessmentEventRelayProperties {

        private boolean enabled = false;

        /** Registered loopback broker. Non-local values come from the environment. */
        private String bootstrapServers = "127.0.0.1:19092";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getBootstrapServers() {
            return bootstrapServers;
        }

        public void setBootstrapServers(String bootstrapServers) {
            this.bootstrapServers = bootstrapServers;
        }
    }
}
