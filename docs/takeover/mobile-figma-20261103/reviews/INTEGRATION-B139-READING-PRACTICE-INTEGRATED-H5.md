# B139 合入发布阅读练习

阅读页使用已发布文章的练习引用创建会话，按同一版本和题目读回。接收练习的页面核对归属与时效，保持原有练习入口。Assessment 使用受保护的 Content 快照服务验证题目。本机复验显式启用 `ASSESSMENT_PROTECTED_READING_ENABLED=true` 和隔离的服务凭据，发布环境按各自开关验收。 [复验回执](../evidence/ROOT-B139-READING-PRACTICE-INTEGRATED-H5-20261106.json)

合入后的 H5 重新构建，经本机 IAM、Gateway、Learner、Content 和 Assessment 复验。键盘触发一次，创建和读回均为 200，页面显示同一会话、发布版本和题目。会话编号未进入地址栏。Assessment 确认 1 条会话、0 条作答、0 条检查点和 0 条发件箱记录。隔离资源已释放。

680 项移动源码测试、类型检查和 H5 构建通过。Assessment 202 项离线检查通过，7 项环境测试跳过。真实评分、同键重试、学习事件消费、真机、部署与逐页签收继续待验。B137 保留原候选的独立回执。
