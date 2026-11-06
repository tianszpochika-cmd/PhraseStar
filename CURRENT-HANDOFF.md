# 根交接（dev）

> 更新：2026-11-06。当前状态只看 [docs/STATUS.md](docs/STATUS.md)；本页只给接手顺序。

1. 确认 `git branch --show-current` 为 `dev`，并与 `origin/dev` 对比；保留工作区里已有的未提交文件和 stash。
2. 读 [STATUS](docs/STATUS.md)：分支、R1（115/115 已签收）、移动端 UI 规格、MB 页面状态和部署版本。
3. 按任务读：[迭代 2 进度页](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)、[R1 计划](docs/06-design/v2-980plus/redesign/dev-plan-R1.md)、[CARD-LEDGER](docs/takeover/CARD-LEDGER.md)、[UI-PAGE-AUDIT](docs/takeover/UI-PAGE-AUDIT-20261013.md)、[文档中心](docs/README.md)、[AGENTS](AGENTS.md)。
4. Figma Web 学员端继续任务先读[业务覆盖与恢复入口](docs/06-design/v2-980plus/redesign/figma-web-learner/README.md)。先核对原型计时校准和实际停点，再处理未执行批；已成功主体禁止重复创建，单条浏览器样例不代替全量签收。

5. 本轮移动端改造先读[监督账](docs/takeover/mobile-figma-20261103/README.md)，核对监督账中的工作树、唯一写者、18183 租约和实际 CLI 检查点（不查看额度面板，以两家实际耗尽停机回执为准）；旧页面签收不自动继承到新候选。

App 构建使用同版 App-Plus 与 UTS 工具链。B92 已核对 33 条路由和原生安全存储桥接源码。B98 的 iOS Keychain 与 B101 的 Android Keystore 均通过独立模拟器写入、跨启动读回和删除。DCloud 正式宿主、实机与读屏继续验收。 [iOS B98](docs/takeover/mobile-figma-20261103/reviews/INTEGRATION-B98-IOS-SIMULATOR-KEYCHAIN.md) · [Android B101](docs/takeover/mobile-figma-20261103/reviews/INTEGRATION-B101-ANDROID-SIMULATOR-KEYSTORE.md)

过期交接记录已从当前工作树清理；需要追溯时可查阅 Git 历史。签收账和验收证据保留在原位置。

## 移动端集成工作点（2026-11-06）

移动端在独立本地分支 `codex/mobile-figma-integration-20261103` 继续。工作点 `5d772b11` 包含 B135–B143 及合并后 H5 的回归。33 条进入本地 UI 候选，逐页状态均为 `TRACE_PENDING`。已实测定级重测、设置外观保存与恢复、发布阅读练习创建与读回、客服及权益空态。课程书架已通过真实接口，成长世界已通过 MySQL 只读凭据。 [监督账](docs/takeover/mobile-figma-20261103/README.md) · [逐页追溯](docs/takeover/mobile-figma-20261103/ROUTE-TRACE-CURRENT.md)

Grok 承接新任务，DSH 已返回本周额度耗尽。阅读评分与同键重试、批量设备退出、书架和成长世界的页面读回继续验证。Figma 正式冻结、三份正式协议、DEC-04、部署与实机读屏各有独立门槛。
