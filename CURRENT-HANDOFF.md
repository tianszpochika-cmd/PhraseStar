# 根交接（dev）

> 更新：2026-11-03。当前状态只看 [docs/STATUS.md](docs/STATUS.md)；本页只给接手顺序。

1. 确认 `git branch --show-current` 为 `dev`，并与 `origin/dev` 对比；保留工作区里已有的未提交文件和 stash。
2. 读 [STATUS](docs/STATUS.md)：分支、R1（115/115 已签收）、移动端 UI 规格、MB 页面状态和部署版本。
3. 按任务读：[迭代 2 进度页](docs/06-design/v2-980plus/redesign/CURRENT-PROGRESS.md)、[R1 计划](docs/06-design/v2-980plus/redesign/dev-plan-R1.md)、[CARD-LEDGER](docs/takeover/CARD-LEDGER.md)、[UI-PAGE-AUDIT](docs/takeover/UI-PAGE-AUDIT-20261013.md)、[文档中心](docs/README.md)、[AGENTS](AGENTS.md)。
4. Figma Web 学员端继续任务先读[业务覆盖与恢复入口](docs/06-design/v2-980plus/redesign/figma-web-learner/README.md)。先核对原型计时校准和实际停点，再处理未执行批；已成功主体禁止重复创建，单条浏览器样例不代替全量签收。

5. 本轮移动端改造先读[监督账](docs/takeover/mobile-figma-20261103/README.md)，核对监督账中的工作树、唯一写者、18183 租约和实际 CLI 检查点（不查看额度面板，以两家实际耗尽停机回执为准）；旧页面签收不自动继承到新候选。

过期交接记录已从当前工作树清理；需要追溯时可查阅 Git 历史。签收账和验收证据保留在原位置。

移动端恢复（2026-11-05）。沿用[暂停收口](docs/takeover/mobile-figma-20261103/PAUSE-20261104.md)的六棵冻结快照，从各实际停点恢复 Grok，DSH 完成首页平板布局和共享设计令牌，Grok 补齐组合测试。目前 33/33 条进入本地 UI 候选，33 条匿名访问已通过受控复验。引导首次签署通过 9 个模拟场景和 213 项组合检查，IAM 本地 V18 到 V19 升级和 41 项候选检查通过，本机 Gateway 与 IAM TLS 合成签署链路 184 项通过。本机 Chrome 签署与 IAM 读回复验通过，正式发布与部署后签署待验。本机学习目标保存、设备退出、报告分享和找回密码隐私验证已记录。33 条路由已登记源码调用边界，错题详情、客服兼容查询和未齐需求标识继续跟踪。最新候选和唯一写者以[监督账](docs/takeover/mobile-figma-20261103/README.md)为准。CloudStudy 常驻服务保持关闭。本机接口验收的临时进程、容器和端口已释放。
