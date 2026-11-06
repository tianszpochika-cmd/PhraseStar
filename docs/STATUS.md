# 项目状态总览

> 文档整理：2026-11-03；官网候选与 Figma Web 学员端设计审查分别见下节，其余源码 UI 和部署状态沿用 2026-10-30 的记录，本次未重新核验运行环境。本页是仓库**唯一的当前状态总览**；具名候选的签收不能直接证明后续提交或其他环境已通过验收。细节以下面链接的签收账与审查原件为准。

<!-- 2026-11-05 mobile resume -->

用户于 2026-11-05 恢复本轮移动端改造。暂停资源回执保留，当前用 Grok CLI 与 DSH CLI 分发，Grok 优先。本地 33/33 条路由进入 UI 候选。引导首次签署用三份模拟发布文档完成 9 个受控场景，IAM 本地 V18 到 V19 升级和 41 项候选检查通过，后续本机 Gateway 与 IAM TLS 合成签署链路 184 项通过。当前 H5 的本机 Chrome 复验三份模拟正文、签署落库、会话刷新与目标页过渡通过。本机学员服务完成学习目标保存、重试和读回，当前 H5 提交后到达定级入口。正式发布和部署后签署待验。当前组合通过 676 项移动端源码测试及 33 条匿名路由复验。旧综合练习接入共享画质。运行时画质降档通过源码和当前 H5 浏览器验证，真机帧率和内存压力待验。报告分享重试与跨周 54 项、关闭页及边界 255 项受控浏览器检查通过。报告分享经本机 Gateway 联调通过九次签发、读取和撤销请求。本机设备退出的同键回执、H5 键盘确认、列表读回及刷新拒绝通过。找回密码的 29 项本机隐私检查通过，实际验证码送达待验。33 条路由已登记源码调用边界，追溯签收仍待验。DEC-04 反馈时点待决策。真实服务、设备、读屏与部署单列待验。[移动监督账](takeover/mobile-figma-20261103/README.md)

移动端 B92 已整合 App 安全存储桥接，核对 748 个 App-Plus 资源、33 条路由与两端原生源码。H5 43 个离线浏览器场景通过。B98 的 iOS Keychain 和 B101 的 Android Keystore 均通过独立模拟器的写入、跨启动读回和删除验证。正式宿主、硬件密钥能力、实机读屏和部署待验。[iOS 模拟器 B98](takeover/mobile-figma-20261103/reviews/INTEGRATION-B98-IOS-SIMULATOR-KEYCHAIN.md) · [Android 模拟器 B101](takeover/mobile-figma-20261103/reviews/INTEGRATION-B101-ANDROID-SIMULATOR-KEYSTORE.md)

移动端 B87 本机定级会话创建和读回通过，真实目标与题库版本绑定，数据库确认 1 条会话和 0 条答案。B88 首题评分、同键重试和第二题读回通过，B89 当前 H5 复验通过，真实目标读回后键盘创建会话并显示首题。B90 本机十题定级和报告读回通过。B91 本机学习计划创建、同键重试及今日任务读回通过。B96 本机 H5 整轮作答、报告、自动计划及今日记录通过。B100 定级页暗色和高对比修正通过 34 项受控 H5 检查。真机和部署单列。[定级主题 B100](takeover/mobile-figma-20261103/reviews/INTEGRATION-B100-ASSESSMENT-THEME.md)[学习计划 B91](takeover/mobile-figma-20261103/reviews/INTEGRATION-B91-LOCAL-LEARNING-PLAN.md)[定级 B87](takeover/mobile-figma-20261103/reviews/INTEGRATION-B49-ASSESSMENT.md#b87-本机定级会话创建和读回)

移动端 B102 的逐题测评事件领取通过 4 项真实 MySQL 检查，含两个连接跳锁和过期凭据确认保护。B104 增加消息确认核心并通过 13 项受控发布测试和 5 项真实 MySQL 测试。默认本机启动检查通过，真实 Kafka、学习侧消费和错题详情分别验收。[测评事件领取 B102](takeover/mobile-figma-20261103/reviews/INTEGRATION-B102-ASSESSMENT-OUTBOX-LEASE.md)

移动端 B122 真实本机 Kafka 通过两条主题的 10 条权限和 25 项用例。Learning 实际消费继续验收。 [测评 Kafka 权限复验 B122](takeover/mobile-figma-20261103/reviews/INTEGRATION-B122-ASSESSMENT-KAFKA-ACL.md)

移动端 B121 登录 200 后进入个人页，注册 201 后进入引导。两条链路的浏览器 Cookie 与 IAM 响应一致。 [登录注册浏览器落点 B121](takeover/mobile-figma-20261103/reviews/INTEGRATION-B121-AUTH-H5-RETURN.md)

移动端 B120 本机语法作答的版本、归属和固定时间通过 Learning 服务身份读回。事件消费和进度写入继续验收。 [测评作答归属与版本读回 B120](takeover/mobile-figma-20261103/reviews/INTEGRATION-B120-ASSESSMENT-OWNER-BINDING.md)

移动端 B119 分级阅读字号及双语操作通过 86 项受控 H5 浏览器断言。实机读屏继续验收。 [分级阅读 B119](takeover/mobile-figma-20261103/reviews/INTEGRATION-B119-GRADED-READING-TOOLS.md)

移动端 B118 通过阅读文章的实库草稿、发布、独立绑定和学员详情读回。经网关进入 H5 练习与评分继续验收。 [阅读文章 B118](takeover/mobile-figma-20261103/reviews/INTEGRATION-B118-READING-ARTICLE-BINDING.md)

移动端 B117 通过本机报告分享匿名浏览器验证。同一链接撤销前显示实际报告空态，撤销后仅显示撤销状态。 [报告分享 B117](takeover/mobile-figma-20261103/reviews/INTEGRATION-B117-REPORT-SHARE-REAL-H5.md)

移动端 B116 通过两条阅读路由的键盘、鼠标、高对比和中英文 200% 字号复验。原生安装和读屏继续待验。 [阅读交互 B116](takeover/mobile-figma-20261103/reviews/INTEGRATION-B116-READING-KEYBOARD-AND-POINTER.md)

移动端 B115 核对 33 条路由和 71 处 Figma RC1 节点引用，各页继续追溯和签收。 [逐页追溯](takeover/mobile-figma-20261103/reviews/FIGMA-RC1-ROUTE-TRACE-20261106.md)

移动端 B114 复验找回密码 H5 的最后输入与即时提交。申请、确认和账号删短各有独立用例，实际验证码送达仍待验。 [找回密码 B114](takeover/mobile-figma-20261103/reviews/INTEGRATION-B114-RESET-IMMEDIATE-INPUT.md)

移动端 B113 完成阅读题内容版本的本机发布与受保护评分复验。四角色审批、正确和错误回执、仅阅读授权拒绝评分及撤回后拒绝通过。可读文章和移动端提交继续验收。[阅读评分 B113](takeover/mobile-figma-20261103/reviews/INTEGRATION-B113-READING-PROTECTED-SCORE.md)

移动端 B112 修复阅读草稿数据库测试入口。自动与手动隔离各通过 2 项，缺参拒绝，临时资源已释放。[数据库测试入口 B112](takeover/mobile-figma-20261103/reviews/INTEGRATION-B112-CONTENT-DRAFT-DB-GATE.md)

移动端 B111 将测评会话、作答和新报告的固定时间统一到库内会话起始值。真实 MySQL V12 上复现旧版差异，候选通过。既有回执保持原始快照。[固定时间 B111](takeover/mobile-figma-20261103/reviews/INTEGRATION-B111-ASSESSMENT-PIN-TIME.md)

移动端 B110 在本机完成同笔 H5 语法作答、服务端回执、测评库 19 项核对及真实 Kafka 读回。八个端口已释放。broker 权限、Learning 消费和部署分别验收。[语法作答到 Kafka B110](takeover/mobile-figma-20261103/reviews/INTEGRATION-B110-GRAMMAR-H5-KAFKA.md)

移动端 B109 合入阅读题草稿持久化。内容服务契约兼容及 309 项离线测试通过，真实 MySQL V34 两项通过。发布、评分、文章绑定和阅读页另行验收。[阅读草稿 B109](takeover/mobile-figma-20261103/reviews/INTEGRATION-B109-CONTENT-GRADABLE-DRAFT.md)

移动端 B108 合入默认关闭的测评消息发布开关。合并安装包通过 179 项离线测试和本机 Kafka 合成传输复验。实际浏览器作答接 broker 与 Learning 消费分别验收。[发布开关 B108](takeover/mobile-figma-20261103/reviews/INTEGRATION-B108-ASSESSMENT-KAFKA-OPT-IN.md)

移动端 B107 修正部分提交的逐题事件范围及重复判分。旧版差异复现，最终 175 项离线测试通过。现进入同一笔 H5 作答到 Kafka 的联合验收。[逐题作答 B107](takeover/mobile-figma-20261103/reviews/INTEGRATION-B107-ASSESSMENT-SUBMITTED-ITEMS.md)

移动端 B106 的独立测评候选通过本机 Kafka 模拟事件传输。数据库与 broker 的编号、关联字段和正文一致。部分作答事件修复进入发布合入门，真实浏览器作答接 broker、权限和 Learning 消费继续验收。[测评 Kafka B106](takeover/mobile-figma-20261103/reviews/INTEGRATION-B106-ASSESSMENT-KAFKA-TRANSPORT.md)

移动端 B105 在同一 H5 浏览器完成真实语法单题作答并显示服务端回执。测评库 17 项核对通过，包含题库快照与待发布事件。Kafka 和学习侧另行验收。[语法单题 B105](takeover/mobile-figma-20261103/reviews/INTEGRATION-B105-GRAMMAR-H5-OWNER.md)

移动端 B103 经本机 Gateway 读取真实内容目录，阅读精练空态与数据库的零篇可读文章一致。已发布文章详情分别验收。[阅读空态 B103](takeover/mobile-figma-20261103/reviews/INTEGRATION-B103-READING-EMPTY-OWNER.md)

移动端 B93 修正了「今日任务」误显示空态的问题。学习服务确认的到期条目进入就绪清单。原有课程任务导航与空态通过受控回归。真实浏览器确认三条到期记录逐项一致。B99 今日页 13 个受控视口场景通过，含四种高对比视口。练习完成与学习进度继续验收。[完整 H5 B96](takeover/mobile-figma-20261103/reviews/INTEGRATION-B96-H5-PLACEMENT-LEARNING.md)

## 分支

- **主线分支：`dev`**（跟踪 `origin/dev`）。原 `dev-redesign` 已并入 `dev` 并删除。
- 官网 V1 从隔离分支 `codex/official-site-v1-20261103` 整合，产品源码候选为 `0b45356d117735fdeff58fa9a6f477b742191f99`；源码整合不代表已部署，远端 `dev` 状态以远端引用为准。
- 整合基线 `origin/dev@0bafc67e` 与官网来源分支 `8a694055` 的共同基线为 `cb0b3d91`；合并保留 Web 学员端设计文档和官网候选两侧记录。`CHANGELOG.md`、`docs/STATUS.md` 的双方条目已合并，来源分支历史未重写。
- 历史证据、签收账与检查点里出现的 `dev-redesign` 是当时的分支名，保留原文。

## 官网 V1 候选（2026-11-03）

- 用户指定 11 月 2 日 Figma 定稿的 16 类页面、32 张桌面/手机主画板；确认“布局和素材 1:1，冲突文案统一为准确说明”。原文与调整见 [文案差异](06-design/v2-980plus/official-site-v1-20261103/COPY-DIFFERENCES.md)，不将准确说明称为逐字还原。
- C10 源码候选 `0b45356d` 的生产构建、类型检查、官网源码 53/53、64 组基础视口与两个真实 404 通过；本地视觉对照 32/32 主画板、20/20 UI MOCK 状态图通过，逐图继承与实际复看的范围见[独立审查](takeover/official-site-v1-20261103/REVIEW.md)。C8 的浏览器 15/15、延迟状态 52/52 单独归属 C8，见[追溯](06-design/v2-980plus/official-site-v1-20261103/TRACEABILITY.md)与 [QA](takeover/official-site-v1-20261103/QA.md)；全产品业务与上线验收为 `PARTIAL`。
- 真实 Gateway/内容/商业/IAM 联调、真实移动或低配设备、实际屏幕阅读器、真实服务器 HTTP 500 和部署均未验；运行中帧率/内存压力逐级降档未接入。模拟与历史 R1 签收不能代替这些证据。

## R1（迭代 2 第二轮重设计）

| 项目 | 状态 | 依据 |
|---|---|---|
| R1 卡墙 | **完成**：R1-001…R1-115 共 115/115 张，IT-1…IT-7 全部签收（2026-10-11，基于合并提交 `7a6ac0a2`） | [CARD-LEDGER](takeover/CARD-LEDGER.md) §0.1、§6；[LUNA-SIGNOFF](takeover/LUNA-SIGNOFF.md) |
| 原 114 卡墙 | 已被 115 卡账取代，GAP-WALL-114 / RES-WALL-114 已 CLOSED（2026-10-11）；过期材料已从当前工作树清理 | [CARD-LEDGER](takeover/CARD-LEDGER.md) §0.1 |
| R1 计划 | [dev-plan-R1](06-design/v2-980plus/redesign/dev-plan-R1.md)（IT-1～IT-7） | — |

## 移动端 Figma 新一轮改造（2026-11-03）

- [本轮监督账与交接](takeover/mobile-figma-20261103/README.md)：以 `f01cddc6` 为候选基线，33 条正式路由分批推进，Grok、DSH 使用隔离工作树执行，Root 分发与审核；用户后续已停止 Codex 子代理。当前仍为未签收候选，不代表新一轮页面、真实服务、设备或部署已验收。
- 2026-11-04移动改造增量：18/33条路由进入本地UI候选整合，最近错题报告Root13项源测试、55核心/21身份检查通过；共享会话44项与启动偏好18项源测试另行通过；完整DoD、实服与设备未签收。DSH已收到实际402额度用尽回执并冻结在途工作，Grok继续；[审核与停点](takeover/mobile-figma-20261103/README.md)保留失败与未验候选。
- 首批六个关闭状态页与个人页已按冻结作者源码合入本轮独立集成候选，类型检查、H5 构建和 55 项针对性测试通过；原作者本地浏览器证据与 Root 局部审图见[组合审核](takeover/mobile-figma-20261103/reviews/INTEGRATION-B01.md)。组合树浏览器、完整追溯、真实服务和设备仍待验，登录/首页/小游戏/社交未在此批合入。
- Figma UIUX2.0RC1 的 QA12 说明与逐页设计确认来源、`TRACE_PENDING`、唯一写者和未执行证据见监督账；定级反馈时点仍待 DEC-04 确认。历史 MB 与官网、Web 记录的适用范围保持不变。

## 移动端 UI 规格

| 轮次 | 状态 | 文档 |
|---|---|---|
| 第 1 轮（mobile-uispec-20261017） | **34/34 页已批准** | [页面清单](design/mobile-uispec-20261017/PAGES.md)、[交互](design/mobile-uispec-20261017/INTERACTIONS.md) |
| 第 2 轮（mobile-uispec-v2） | **3/34 已批准**：login、onboarding、home；**已暂停** | [页面清单](design/mobile-uispec-v2/PAGES.md)、[审查](design/mobile-uispec-v2/AUDIT.md) |

## 正式页面 UI 逐页重设计（MB 移动 / LW Web）

来源：[UI-PAGE-AUDIT](takeover/UI-PAGE-AUDIT-20261013.md)。下表所有提交均已在 `origin/dev`（2026-10-26 推送）。

| 页面 | 状态 |
|---|---|
| MB-001 登录 / MB-002 注册 / MB-003 找回密码 | 已签收并推送（PUSHED_SCOPED） |
| MB-004 新手引导 | 已签收并推送（PUSHED_UI_SCOPED） |
| MB-005 受限访问 | UI 本地验收通过（`758dc0fb`），现已在 dev |
| MB-006 测评 | C8 已签 UI_ACCEPTED_LOCAL（2026-10-21，`8a66cc73`） |
| MB-007 首页 | C8 候选稿未签（`b64db8e9`），2026-10-21 暂停 |
| MB-008 及以后 | 未开始（PENDING） |
| Web LW-001/002/003 登录/注册/找回 | 已签收并推送（PUSHED_SCOPED）；其余 Web 页 PENDING |

## Figma Web 学员端设计覆盖

- [当前覆盖清单与恢复入口](06-design/v2-980plus/redesign/figma-web-learner/README.md)：保留全部 980 条来源分类，当前成人 Phase 1 Web 范围为 484 条需求，另按 236 项业务义务、33 类 PAGE、14 条 JNY、8 条 RULE 建立 291 项独立核对清单；这些计数不能相加为页面数或产品完成率。
- 当前状态为**设计与交互核验进行中，尚未全量签收**。已写入的页面、准备稿、实际接线及未验证状态分别登记，不以移动端页面补足 Web 覆盖。
- 当前连接的原型计时已校准，159个明确归属旧计时器已原位迁移；[本轮复核快照](06-design/v2-980plus/redesign/figma-web-learner/review-v3.md)记录累计1074根、Auth/Consent原入口接线和阅读语法4/19原页批次。口语自评与汉译英保存确认v5仅固定浏览器样例通过。Auth视觉整理失败后已有指定原生完整性复核，失败原件保留，视觉仍待小批修正。484需求/291义务均未整项签收；普通学习空间、其余业务接线、完整草稿、响应式和无障碍仍在推进。本聊天每小时自动续办保持有效。
- 本节不升级上表 LW/MB 的实现签收、R1 历史签收或部署状态。

## 部署

- SJC 服务器 `173.249.208.210`，域名 `clyune.com`：`learn.clyune.com`（学员 Web）、`admin.clyune.com`（后台）、`mobile.clyune.com`（移动 H5）、`api.clyune.com`（网关）。运行版本 `4990dd29`（2026-10-13），落后 `origin/dev`（截至 2026-10-30 落后 132 个提交）。
- 旧德国服务器 `37.120.160.36` 与 `clyunedev.com` 域名已不是当前环境；其过期记录已从当前工作树清理。
- 编排资产仍在 `infra/docker/clyunedev/`（目录名沿用历史名称），操作步骤见[单机预发布手册](07-operations/clyunedev-single-host-pre-release-runbook.md)，域名与 IP 以本页为准。

## 文档入口

- 接手：本页 → [根交接](../CURRENT-HANDOFF.md) → [迭代 2 进度页](06-design/v2-980plus/redesign/CURRENT-PROGRESS.md) → [文档中心](README.md)。
- 旧交接和已取代的卡墙材料可通过 Git 历史追溯；签收账与证据仍在原位置。
