# B148 CI 运行依赖与命令参数修复

Java 25 测试所在的独立 runner 未启动 MinIO，媒体集成测试连接本地 19000 失败。本次由 Grok 补齐专属临时 MinIO、每次生成并掩码的凭据、健康等待和 always 清理。完整 Maven 测试保留。

Kafka 主题脚本只忽略 pnpm 转发的一个前置 `--`。其他未知参数在接触 broker 前拒绝。Root 独立复跑 3 项参数回归与 80 项 CI 规则均通过。实际 MinIO、broker 及本候选远程 CI 继续核对。 [复验回执](../evidence/ROOT-B148-CI-RUNTIME-BOUNDARIES-20261107.json)

B147 对应的远程 CI 已通过 Linux／Windows 治理、Linux／macOS 前端和 Java 17；另四个作业失败。本次处理其中的 MinIO 和参数问题，历史证据摘要及依赖审计分别跟踪。移动端逐页签收继续为 TRACE_PENDING。

后续 f69fd71f 远程 CI 已通过 Java 25 媒体集成测试和全新基础设施／Kafka 启动，7 个作业通过。契约数据与依赖审计两个作业继续失败。
