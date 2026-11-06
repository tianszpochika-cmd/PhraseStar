package com.englishflow.assessment.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.englishflow.assessment.adapter.jdbc.JdbcAssessmentOutboxRelay;
import com.englishflow.assessment.integration.AssessmentOutboxKafkaRelay;
import com.englishflow.assessment.port.AssessmentOutboxRelayPort;

import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import javax.sql.DataSource;

import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.AbstractDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.TaskExecutionOutcome;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Context composition only. The guarded owner DataSource rejects connections, and the
 * producer factory is left unopened, so these checks do not use a broker or a database.
 */
class AssessmentEventRelayConfigurationTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(AssessmentEventRelayConfiguration.class, OwnerFixtures.class);

    @Test
    void relayIsAbsentByDefault() throws Exception {
        String yaml = new ClassPathResource("application.yml").getContentAsString(StandardCharsets.UTF_8);
        assertTrue(yaml.contains("enabled: ${ASSESSMENT_EVENT_RELAY_ENABLED:false}"));
        assertTrue(yaml.contains("bootstrap-servers: ${ASSESSMENT_KAFKA_BOOTSTRAP_SERVERS:127.0.0.1:19092}"));
        assertTrue(yaml.contains("poll-interval: ${ASSESSMENT_EVENT_RELAY_POLL_INTERVAL:5s}"));
        assertTrue(yaml.contains("initial-delay: ${ASSESSMENT_EVENT_RELAY_INITIAL_DELAY:10s}"));
        assertFalse(yaml.contains("topic:"));

        runner.run(context -> assertAbsent(context));
    }

    @Test
    void relayFlagAloneLeavesThePublisherAbsent() {
        runner.withPropertyValues("assessment.events.relay.enabled=true")
                .run(context -> assertAbsent(context));
        runner.withPropertyValues(
                "assessment.events.relay.enabled=true",
                "assessment.persistence.enabled=false")
                .run(context -> assertAbsent(context));
    }

    @Test
    void persistenceFlagAloneLeavesThePublisherAbsent() {
        runner.withPropertyValues("assessment.persistence.enabled=true")
                .run(context -> assertAbsent(context));
        runner.withPropertyValues(
                "assessment.events.relay.enabled=false",
                "assessment.persistence.enabled=true")
                .run(context -> assertAbsent(context));
    }

    @Test
    void bothFlagsWireTheDelayedRelayWithoutOpeningTheBroker() {
        runner.withPropertyValues(
                "assessment.events.relay.enabled=true",
                "assessment.persistence.enabled=true")
                .run(context -> {
                    AssessmentOutboxKafkaRelay relay = context.getBean(AssessmentOutboxKafkaRelay.class);
                    assertSame(context.getBean(KafkaTemplate.class), field(relay, "kafka"));
                    assertSame(context.getBean("assessmentClock"), field(relay, "clock"));
                    assertNull(context.getBean(KafkaTemplate.class).getDefaultTopic());
                    assertEquals("platform.assessment.v1", AssessmentOutboxKafkaRelay.TOPIC);

                    JdbcAssessmentOutboxRelay port = context.getBean(JdbcAssessmentOutboxRelay.class);
                    assertSame(port, context.getBean(AssessmentOutboxRelayPort.class));
                    assertTrue(String.valueOf(field(port, "claimSql"))
                            .contains("`assessment_service`.`assessment_outbox_event`"));
                    JdbcTemplate jdbc = (JdbcTemplate) field(port, "jdbc");
                    TransactionTemplate transactions = (TransactionTemplate) field(port, "transactions");
                    assertSame(context.getBean("assessmentDataSource"), jdbc.getDataSource());
                    DataSourceTransactionManager manager = assertInstanceOf(
                            DataSourceTransactionManager.class, transactions.getTransactionManager());
                    assertSame(context.getBean("assessmentDataSource"), manager.getDataSource());
                    assertEquals(0, context.getBeansOfType(PlatformTransactionManager.class).size());
                    assertEquals(0, context.getBeansOfType(TransactionTemplate.class).size());

                    DefaultKafkaProducerFactory<?, ?> factory = assertInstanceOf(
                            DefaultKafkaProducerFactory.class, context.getBean(ProducerFactory.class));
                    assertSame(factory, context.getBean(KafkaTemplate.class).getProducerFactory());
                    Map<String, Object> config = factory.getConfigurationProperties();
                    assertEquals("127.0.0.1:19092", config.get(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG));
                    assertEquals("assessment-service", config.get(ProducerConfig.CLIENT_ID_CONFIG));
                    assertEquals(StringSerializer.class, config.get(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG));
                    assertEquals(StringSerializer.class, config.get(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG));
                    assertEquals("all", config.get(ProducerConfig.ACKS_CONFIG));
                    assertEquals(true, config.get(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG));
                    assertEquals(5, ((Number) config.get(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION)).intValue());
                    long linger = ((Number) config.get(ProducerConfig.LINGER_MS_CONFIG)).longValue();
                    long maxBlock = ((Number) config.get(ProducerConfig.MAX_BLOCK_MS_CONFIG)).longValue();
                    long request = ((Number) config.get(ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG)).longValue();
                    long delivery = ((Number) config.get(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG)).longValue();
                    assertEquals(0L, linger);
                    assertEquals(AssessmentOutboxKafkaRelay.MAX_BLOCK.toMillis(), maxBlock);
                    assertEquals(AssessmentOutboxKafkaRelay.ACK_WAIT.toMillis(), request);
                    assertEquals(AssessmentOutboxKafkaRelay.ACK_WAIT.toMillis(), delivery);
                    assertTrue(request < AssessmentOutboxKafkaRelay.LEASE.toMillis());
                    assertTrue(delivery < AssessmentOutboxKafkaRelay.LEASE.toMillis());
                    assertTrue(delivery >= linger + request);
                    assertTrue(factory.isRunning());
                    assertNull(field(factory, "producer"));
                    assertEquals(0, context.getBeansOfType(KafkaAdmin.class).size());
                    assertEquals(0, context.getBeansOfType(ConsumerFactory.class).size());

                    var delays = context.getBean(ScheduledAnnotationBeanPostProcessor.class)
                            .getScheduledTasks()
                            .stream()
                            .map(ScheduledTask::getTask)
                            .filter(FixedDelayTask.class::isInstance)
                            .map(FixedDelayTask.class::cast)
                            .toList();
                    assertEquals(1, delays.size());
                    FixedDelayTask task = delays.get(0);
                    assertEquals(Duration.ofSeconds(5), task.getIntervalDuration());
                    assertEquals(Duration.ofSeconds(10), task.getInitialDelayDuration());
                    assertEquals(TaskExecutionOutcome.Status.NONE, task.getLastExecutionOutcome().status());
                    assertTrue(task.getRunnable().toString().contains("AssessmentOutboxKafkaRelay.poll"));
                });
    }

    private static void assertAbsent(ConfigurableApplicationContext context) {
        assertEquals(0, context.getBeansOfType(AssessmentOutboxKafkaRelay.class).size());
        assertEquals(0, context.getBeansOfType(AssessmentOutboxRelayPort.class).size());
        assertEquals(0, context.getBeansOfType(ProducerFactory.class).size());
        assertEquals(0, context.getBeansOfType(KafkaTemplate.class).size());
        assertEquals(0, context.getBeansOfType(ScheduledAnnotationBeanPostProcessor.class).size());
        assertEquals(0, context.getBeansOfType(KafkaAdmin.class).size());
        assertEquals(0, context.getBeansOfType(ConsumerFactory.class).size());
    }

    private static Object field(Object target, String name) {
        try {
            Field found = target.getClass().getDeclaredField(name);
            found.setAccessible(true);
            return found.get(target);
        }
        catch (ReflectiveOperationException ex) {
            throw new AssertionError(name, ex);
        }
    }

    @Configuration(proxyBeanMethods = false)
    static class OwnerFixtures {

        @Bean(name = "assessmentDataSource")
        DataSource assessmentDataSource() {
            return new GuardedDataSource();
        }

        @Bean(name = "assessmentClock")
        Clock assessmentClock() {
            return Clock.fixed(Instant.parse("2026-11-06T00:00:00Z"), ZoneOffset.UTC);
        }
    }

    private static final class GuardedDataSource extends AbstractDataSource {

        @Override
        public Connection getConnection() {
            throw new AssertionError("owner DataSource was asked for a connection");
        }

        @Override
        public Connection getConnection(String username, String password) {
            throw new AssertionError("owner DataSource was asked for a connection");
        }
    }
}
