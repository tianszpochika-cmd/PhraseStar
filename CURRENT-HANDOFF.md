# CloudStudy 接手入口

> 更新：2026-11-06。当前状态只看 [docs/STATUS.md](docs/STATUS.md)；本页只给接手顺序。

1. 迭代 2 和移动端 Figma 改造统一从 `dev` 接手，接手时与 `origin/dev` 对比。保留当前工作树的未提交文件和 stash。
2. 读 [STATUS](docs/STATUS.md)：分支、R1（115/115 已签收）、移动端 UI 规格、MB 页面状态和部署版本。
3. 按任务读：[迭代 2 进度页](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)、[R1 计划](docs/06-design/v2-980plus/redesign/dev-plan-R1.md)、[CARD-LEDGER](docs/takeover/CARD-LEDGER.md)、[UI-PAGE-AUDIT](docs/takeover/UI-PAGE-AUDIT-20261013.md)、[文档中心](docs/README.md)、[AGENTS](AGENTS.md)。
4. Figma Web 学员端继续任务先读[业务覆盖与恢复入口](docs/06-design/v2-980plus/redesign/figma-web-learner/README.md)。先核对原型计时校准和实际停点，再处理未执行批；已成功主体禁止重复创建，单条浏览器样例不代替全量签收。

5. 本轮移动端改造先读[监督账](docs/takeover/mobile-figma-20261103/README.md)，核对监督账中的工作树、唯一写者、18183 租约和实际 CLI 检查点（不查看额度面板，以两家实际耗尽停机回执为准）；旧页面签收不自动继承到新候选。

App 构建使用同版 App-Plus 与 UTS 工具链。B92 已核对 33 条路由和原生安全存储桥接源码。B98 的 iOS Keychain 与 B101 的 Android Keystore 均通过独立模拟器写入、跨启动读回和删除。DCloud 正式宿主、实机与读屏继续验收。 [iOS B98](docs/takeover/mobile-figma-20261103/reviews/INTEGRATION-B98-IOS-SIMULATOR-KEYCHAIN.md) · [Android B101](docs/takeover/mobile-figma-20261103/reviews/INTEGRATION-B101-ANDROID-SIMULATOR-KEYSTORE.md)

过期交接记录已从当前工作树清理；需要追溯时可查阅 Git 历史。签收账和验收证据保留在原位置。

## 移动端跨电脑接手（2026-11-06）

移动端处于用户暂停状态。从 `origin/dev` 取回已审核源码和交接。已审核证据停在 `230d19ec`（B146），33 条路由进入本地 UI 候选，逐页均为 `TRACE_PENDING`。 [暂停交接](docs/takeover/mobile-figma-20261103/PAUSE-20261106.md) · [逐页追溯](docs/takeover/mobile-figma-20261103/ROUTE-TRACE-CURRENT.md)

待复核的 61 份工作树快照与冻结探针通过标签 `archive/cloudstudy-20261106` 保存。清单按候选列出原基线、快照提交和文件指纹。 [跨机快照清单](docs/takeover/mobile-figma-20261103/cross-machine-20261106/README.md)

恢复须由用户明确提出。优先核对已准备的书架 H5、设备批量退出、定级同键重试、阅读反馈和成长世界 H5。Figma 正式冻结、正式协议、DEC-04、部署与原生验收分开跟踪。
