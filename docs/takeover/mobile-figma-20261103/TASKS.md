# 33 条正式路由任务与来源账

各页当前状态与具名验证范围以 [CHECKPOINT.json](CHECKPOINT.json) 为准；下表是范围和来源账，不是完成清单。本轮已有局部候选整合与验证，尚无完整 DoD 签收。页面路径以 `apps/mobile/src/pages.json` 为准，`MB-*` 保留 [UI 页面审计](../UI-PAGE-AUDIT-20261013.md) 编号，不是新建 R1 卡或批准新增路由。每行的来源是**可追索的准备锚点，不是完整实现范围或验收结论**；`TRACE_PENDING` 阻止将该页宣称为完整审签。

页面登记册有历史“缺失/合并”描述，而当前源码已出现部分注册、设备和客服路由；实施时以 `pages.json`、文件、当前契约与实际受限能力交叉核验，保留旧文档历史语义。

| 编号 | 正式路由 | 当前执行批 / 写者 | 页面范围与须保留的边界 | 服务/数据 owner | R1 / BC / IC 参考 | PAGE | 来源与追溯 |
|---|---|---|---|---|---|---|---|
| MB-001 登录 | `#/pages/login/login` | G1 / GROK | 输入校验、提交中、失败、会话恢复与安全回跳；凭据只经 IAM TLS | iam-service | R1-004、R1-015、BC-004、IC-053 | PAGE-P1-AUTH-LOGIN | FEAT-USR-001→V2-980-0359；PRD-ATOM-1044→V2-980-0366；TRACE_PENDING |
| MB-002 注册 | `#/pages/register/register` | G1 / GROK | 字段、去重、回执和成人门分流，不因注册成功直接放行学习 | iam-service | R1-002、R1-003、R1-015、BC-002、BC-003、IC-052 | PAGE-P1-AUTH-REGISTER-RESET | FEAT-USR-001→V2-980-0359；PRD-ATOM-1044→V2-980-0366；TRACE_PENDING |
| MB-003 找回密码 | `#/pages/reset-password/reset-password` | 本地 UI 候选 B34 / B79 本机 IAM 隐私通过 | 申请与确认两步、恒定回执、过期及返回登录；不枚举账号 | iam-service | R1-012、R1-015、BC-012、IC-054 | PAGE-P1-AUTH-REGISTER-RESET | FEAT-USR-002→V2-980-0360；TRACE_PENDING |
| MB-004 成人门、同意与目标 | `#/pages/onboarding/onboarding` | 本地 UI 候选 B57 / B84 模拟签署与 B85 H5 目标通过 | 服务端资格、版本化同意、目标/时长、草稿恢复；不新增敏感采集 | iam-service、learner-service | R1-006、R1-008、R1-010、R1-011、R1-016、R1-017、BC-006、BC-008、BC-010、BC-011、IC-055、IC-056、IC-057 | PAGE-P1-ADULT-CONSENT、PAGE-P1-ONB-GOAL | FEAT-ONB-001→V2-980-0001；PRD-ATOM-1044→V2-980-0366；TRACE_PENDING |
| MB-005 访问受限 | `#/pages/forbidden/forbidden` | 本地 UI 候选 B53 / TRACE_PENDING | 拒绝原因、安全出口和退出；403 不伪装空态或越过 Gate | iam-service | R1-007、R1-013、BC-007、BC-201、IC-055 | PAGE-P1-ADULT-CONSENT | FEAT-USR-001→V2-980-0359；PRD-ATOM-1044→V2-980-0366；TRACE_PENDING |
| MB-006 定级 | `#/pages/assessment/assessment` | 本地 UI 候选 B100 / B87 本机会话建读通过 / B96 当前 H5 十题及报告通过 / DEC-04 待定 | 10 题与版本、checkpoint、未知结果/冲突、跳过和重测；反馈时点 DEC-04 不代签 | assessment-service、content-service、learning-service | R1-018、R1-020、R1-021、R1-022、R1-023、R1-024、R1-027、R1-028、BC-013、BC-014、BC-015、BC-016、BC-017、BC-018、BC-022、IC-010、IC-011、IC-012、IC-058、IC-059 | PAGE-P1-ASSESSMENT、PAGE-P1-ASSESSMENT-RESULT | FEAT-ONB-003→V2-980-0003；FEAT-ONB-004→V2-980-0004；TRACE_PENDING |
| MB-007 首页 | `#/pages/home/home` | 本地 UI 候选 B50 / B91 本机计划创建通过 / TRACE_PENDING | 真实计划摘要、首学、空/错/401、切号及迟到响应 | learner-service、learning-service | R1-032、R1-037、R1-039、R1-041、BC-025、BC-030、BC-032、IC-013、IC-021 | PAGE-P1-LEARN-HOME | FEAT-ONB-010→V2-980-0010；TRACE_PENDING |
| MB-008 今日任务 | `#/pages/today/today` | 本地 UI 候选 B99 / B96 本机 H5 今日三条读回与显示通过 / TRACE_PENDING | 区分无计划/已完成/无内容/无到期/失败；无有效 practiceRef 不编题 | learning-service | R1-034、R1-035、R1-037、R1-041、BC-027、BC-028、BC-030、IC-017、IC-018 | PAGE-P1-TODAY | FEAT-ONB-012→V2-980-0012；PRD-ATOM-0494→V2-980-0255；TRACE_PENDING |
| MB-009 学习与课程 | `#/pages/learn/learn` | 本地 UI 候选 B47 / TRACE_PENDING | 书架/继续学习、内容授权与版本、空目录/无结果/失败分开 | content-service、learner-service、learning-service | R1-037、R1-040、R1-041、BC-199、IC-029、IC-039 | PAGE-P1-PLAN-MAP、PAGE-P1-COURSE-SHELF | FEAT-ONB-014→V2-980-0014；TRACE_PENDING |
| MB-010 练习入口 | `#/pages/practice/practice` | 本地 UI 候选 B52 / TRACE_PENDING | 真实可用入口、队列、能力关闭原因；不开放隐藏功能 | assessment-service、learning-service、content-service | R1-043、R1-048、R1-058、BC-033、BC-043、IC-022 | PAGE-P1-PRACTICE-HUB | FEAT-ASM-012→V2-980-0226；PRD-ATOM-0474→V2-980-0236；TRACE_PENDING |
| MB-011 旧综合练习入口 | `#/pages/b2-practice/b2-practice` | 本地 UI 候选 B52 / B81 共享画质通过 | 迁移说明与替代入口，获准会话保留答题、尝试级断点和报告跳转 | assessment-service、content-service | R1-043、R1-048、BC-033、BC-043、IC-022 | PAGE-P1-PRACTICE-SESSION | FEAT-ASM-012→V2-980-0226；PRD-ATOM-0474→V2-980-0236；TRACE_PENDING |
| MB-012 词汇与复习 | `#/pages/b2-vocabulary/b2-vocabulary` | 本地 UI 候选 B54 / TRACE_PENDING | 词义/例句/音频真实资源、SRS 与空/错态；缺音频不假播放 | content-service、learning-service | R1-048、R1-054、R1-055、R1-056、BC-042、BC-055、BC-056、IC-025、IC-032 | PAGE-P1-VOCAB、PAGE-P1-SRS | FEAT-VOC-005→V2-980-0027；PRD-ATOM-0176→V2-980-0068；TRACE_PENDING |
| MB-013 语法与长难句 | `#/pages/b3-grammar/b3-grammar` | 本地 UI 候选 B54 / B110 本机单题到 Kafka / TRACE_PENDING | 内容与练习版本、已保存再反馈、缺题关闭和降级 | content-service、assessment-service | R1-043、R1-044、R1-045、R1-046、R1-058、BC-033、BC-034、BC-036、BC-037、IC-022、IC-023 | PAGE-P1-GRAMMAR、PAGE-P1-PRACTICE-SESSION | FEAT-GRM-001→V2-980-0071；PRD-ATOM-0474→V2-980-0236；TRACE_PENDING |
| MB-014 阅读精练 | `#/pages/b3-reading/b3-reading` | 本地 UI 候选 B45 / B103 本机真实空态 / B109 内容草稿 / 正向详情待验 | 阅读内容/题目授权、保存后反馈、返回原位置 | content-service、assessment-service | R1-043、R1-044、R1-045、R1-046、BC-035、BC-036、BC-038、IC-022、IC-023 | PAGE-P1-READING、PAGE-P1-PRACTICE-SESSION | FEAT-RDG-002→V2-980-0136；PRD-ATOM-0392→V2-980-0151；TRACE_PENDING |
| MB-015 分级阅读 | `#/pages/b11-reading/b11-reading` | 本地 UI 候选 B45 / TRACE_PENDING | 正文长文、进度与内容下线；恢复身份与内容版本 | content-service、learning-service | R1-040、R1-046、BC-038、BC-199、BC-200、IC-023、IC-029 | PAGE-P1-READING | FEAT-RDG-002→V2-980-0136；PRD-ATOM-0392→V2-980-0151；TRACE_PENDING |
| MB-016 错题与报告 | `#/pages/b10-report/b10-report` | ROOT本地候选 B37 / B102 测评事件领取通过 / 详情待验 | 报告/错题/补救，空/未就绪/失败/部分与真实数据区分 | assessment-service、learning-service | R1-050、R1-051、R1-052、R1-053、R1-060、R1-061、R1-066、R1-067、R1-068、BC-045、BC-048、BC-052、BC-063、BC-064、BC-069、IC-030、IC-031、IC-033 | PAGE-P1-MISTAKES-MASTERY、PAGE-P1-REPORT | FEAT-ASM-019→V2-980-0233、FEAT-ASM-011→V2-980-0225；TRACE_PENDING |
| MB-017 报告分享 | `#/pages/report-share/report-share` | 本地 UI 候选 B73 / B77 本机分享接口通过 | 有效/过期/撤销/错误只读，公开字段与访问权限按契约 | assessment-service、learning-service | R1-065、R1-068、BC-068、IC-033 | PAGE-P1-REPORT | FEAT/PRD-ATOM 待查；TRACE_PENDING |
| MB-018 成长世界 | `#/pages/world/world` | 本地 UI 候选 B46 / TRACE_PENDING | 成长事实、赛季、空态及关闭模块；无权威事实不造奖励 | gamification-service、social-service | R1-049、BC-044 | PAGE-P1-WORLD | FEAT-GAM-022→V2-980-0288；TRACE_PENDING |
| MB-019 游戏目录边界 | `#/pages/b4-games/b4-games` | D1 / DSH | 说明开放状态与返回；无游戏可用契约不可伪造可玩或奖励 | gamification-service、content-service | R1-049、BC-044 | PAGE-P1-GAME | FEAT-GAM-009→V2-980-0275；PRD-ATOM-0729→V2-980-0318；TRACE_PENDING |
| MB-020 自习室和社交边界 | `#/pages/b4-social/b4-social` | D1 / DSH | 当前允许范围、空态与返回；禁止伪造席位/社交事实 | social-service | TRACE_PENDING | PAGE-P1-SOCIAL | FEAT-SOC-001→V2-980-0335；PRD-ATOM-1097→V2-980-0447；TRACE_PENDING |
| MB-021 头像与衣柜 | `#/pages/b4-avatar/b4-avatar` | 本地 UI 候选 B44 / TRACE_PENDING | 可操作与仅展示分开，权属和奖励来自真实服务 | gamification-service | TRACE_PENDING | PAGE-P1-AVATAR-REWARD | FEAT-GAM-013→V2-980-0279；PRD-ATOM-0718→V2-980-0307；TRACE_PENDING |
| MB-022 离线服务边界 | `#/pages/b4-offline/b4-offline` | D1 / DSH | 未开放不显示可点必败下载；不把 PWA 当离线可学 | learning-service、media-service、workflow-service（恢复编排；具体 owner 待核） | IC-062 | PAGE-P1-SYNC-OFFLINE | FEAT-INF-004→V2-980-0408；TRACE_PENDING |
| MB-023 我的 | `#/pages/profile/profile` | D2 / DSH | 账号和入口、会话状态、退出反馈；页面身份映射待核 | iam-service、learner-service | R1-004、R1-010、BC-004、BC-010 | PAGE-P1-ONB-GOAL、PAGE-P1-SETTINGS | FEAT-USR-006→V2-980-0364；PRD-ATOM-1052→V2-980-0373；TRACE_PENDING |
| MB-024 设置与隐私 | `#/pages/settings/settings` | D2 / DSH-PROFILE | 偏好/通知/隐私撤回读回与失败；受理不等于删除完成 | learner-service.privacy、iam-service、notification-service | R1-009、R1-103、R1-104、R1-105、R1-106、R1-114、BC-009、BC-188、BC-189、BC-190、BC-191、BC-192、IC-034、IC-036、IC-061、IC-105、IC-106、IC-107、IC-108 | PAGE-P1-SETTINGS、PAGE-P1-PRIVACY | FEAT-INF-003→V2-980-0407；PRD-ATOM-1631→V2-980-0386；TRACE_PENDING |
| MB-025 设备与会话 | `#/pages/devices/devices` | 本地 UI 候选 B23 / B78 本机 H5 与 IAM 退出通过 | 当前设备标识、确认、撤销读回与被踢登录状态 | iam-service | R1-005、BC-005、IC-035 | PAGE-P1-DEVICES | FEAT-USR-005→V2-980-0363；PRD-ATOM-1050→V2-980-0371；TRACE_PENDING |
| MB-026 权益与兑换 | `#/pages/b5-commerce/b5-commerce` | D2 / DSH-COMMERCE | 权益/兑换真实可用范围；支付关闭且不伪造支付或权益 | commerce-service | IC-038 | PAGE-P1-COMMERCE | FEAT-COM-009→V2-980-0469；PRD-ATOM-1104→V2-980-0475；TRACE_PENDING |
| MB-027 语言主题与性能 | `#/pages/b6-platform/b6-platform` | 本地 UI 候选 B40 / B80 运行时画质通过源码检查 | 主题、语言、画质和动效的可用偏好及持久化失败；共享 token 由 Grok 写 | learner-service | IC-034 | PAGE-P1-SETTINGS | PRD-ATOM-1738→V2-980-0397；TRACE_PENDING |
| MB-028 帮助与客服 | `#/pages/support/support` | D2 / DSH | 工单和帮助实际边界，安全内容引用；不伪造发送/回复 | admin-ops-service.support | R1-100、R1-101、R1-114、BC-185、BC-186、IC-037、IC-103、IC-104 | PAGE-P1-SUPPORT | FEAT-INF-008→V2-980-0412；PRD-ATOM-1545→V2-980-0530；TRACE_PENDING |
| MB-029 听力旧入口 | `#/pages/b3-listening/b3-listening` | D1 / DSH | 旧入口关闭说明与安全出口；不得假装提供音频 | media-service、content-service | R1-048、BC-043、IC-026 | PAGE-P1-LISTENING | FEAT-LST-001→V2-980-0107；PRD-ATOM-0476→V2-980-0238；TRACE_PENDING |
| MB-030 听力与 Clips | `#/pages/b11-listening/b11-listening` | D1 / DSH | 当前关闭原因与返回；素材未准入不得开放 | media-service、content-service | R1-048、BC-043、IC-026 | PAGE-P1-LISTENING | FEAT-LST-001→V2-980-0107；PRD-ATOM-0476→V2-980-0238；TRACE_PENDING |
| MB-031 口语旧入口 | `#/pages/b3-speaking/b3-speaking` | D1 / DSH | 旧入口不可用说明与返回，不伪造语音评分 | media-service、assessment-service | R1-048、BC-043、IC-027 | PAGE-P1-SPEAKING | FEAT-SPK-004→V2-980-0162；PRD-ATOM-0170→V2-980-0063；TRACE_PENDING |
| MB-032 音标与跟读 | `#/pages/b11-speaking/b11-speaking` | D1 / DSH | 关闭说明与返回，不提前申请麦克风或伪造评分 | media-service、assessment-service | R1-048、BC-043、IC-027 | PAGE-P1-SPEAKING | FEAT-SPK-004→V2-980-0162；PRD-ATOM-0170→V2-980-0063；TRACE_PENDING |
| MB-033 写作 | `#/pages/b3-writing/b3-writing` | D1 / DSH | 当前关闭说明/返回；无题或提交链不得提供虚假编辑成功 | content-service、assessment-service | R1-048、BC-043、IC-028 | PAGE-P1-WRITING | FEAT-WRT-002→V2-980-0190；PRD-ATOM-0454→V2-980-0195；TRACE_PENDING |

## 跨页任务

| 编号 | 单写者 | 交付及依赖 | 审核门 |
|---|---|---|---|
| FOUNDATION | Grok | 盘点当前 15 组件与页面依赖；确认共享接口、路由壳、tab、Header、空错态和安全区域。先发布接口清单，DSH 使用稳定接口 | 受影响页面的类型、行为、键盘、触摸、无横向溢出、旧使用方回归；禁止无必要全局覆盖 |
| ASSETS | Grok | 按指定画板确认素材、来源/使用权、尺寸与加载失败替代；合理压缩，适配 uni-app | 逐资产来源及目标场景；主题/倍率/弱网检查，不搬入无关官网资产 |
| THEME-I18N | Grok | 共享 `packages/design-tokens`、`packages/i18n` 与 mobile adapter；UI locale 与 contentLocale 分离 | 默认中文、已支持语言/fallback/格式化；亮/暗/跟随系统/高对比、语义状态和持久化；动效可关和四级性能降级按实现逐层测 |
| IPAD | Root QA | 320/375/390/宽屏及 768/1024 H5 视口、横竖屏安全区域与200%文字检查；iPad 实机另列 | H5 模拟截图标注尺寸；真实 iPad/iOS/Android、系统键盘和读屏无证据即 NOT_RUN |
| QA | Root QA | 页面负向状态、交互、共享影响、会话/owner 变化、迟到响应、onShow/返回/重复提交与恢复 | 可复现记录绑定源、环境、视口、真实/fixture、期望与实际、截图或日志；独立审核后才记对应范围 PASS |
| DOCS | Root | 本目录、STATUS/HANDOFF/CHANGELOG 的当前事实，失败和后续任务 | 不覆盖官网/Web 原状态，不将设计/本地 UI 升成业务/部署签收 |
| INTEGRATION | Root | Grok/DSH 按独立差量交付；对单个候选审查、检查文件所有权、冲突和版本，再正常整合 | 版本与测试重新绑定；不 force/reset，不混入未经审查候选或触碰别的工作树 |

## 追溯与交付门

- 33 条路由已登记当前源码调用或关闭边界。实际网关执行、真实 owner 数据和未齐需求标识继续单列。 [B59 调用追溯](reviews/INTEGRATION-B59-OPERATION-TRACE.md)
- 每行的 ACT/JNY/RULE/INT/E2E、ARCH、FEAT/PRD 与 V2 对应锚点保存在 [CHECKPOINT.json](CHECKPOINT.json) 的 `pages[].trace`。`design-source-traceability.md` 的 RT 是查表引用，机器账展开为 canonical ID；其范围只是所引设计规则，不是整页或服务已完成。FEAT 与 PRD 列缺项都继续 `TRACE_PENDING`；标注的 ID 也需按具体功能确认适用，不可用邻近功能冒充。
- 首先对照 [980 登记](../../06-design/v2-980plus/08-980plus-功能点设计登记册.md)、[角色/旅程/页面/规则/联调](../../06-design/v2-980plus/phase1-business-operation/README.md)、[业务与交互链](../../06-design/v2-980plus/redesign/README.md)、[契约](../../../packages/contracts/README.md)、[架构](../../02-architecture/v2-microservices-architecture.md)，逐页补 operation、当前 Gateway/owner、状态和证据定位。无相应规则时说明 `N/A` 及原因，不伪造编号。
- UI 页的最低审查覆盖：正常、加载、空、错误、离线、无权、冲突/恢复、提交中按适用逐项；安全回跳、重复点击、切号、迟到响应、焦点/键盘和 320px/200% 视口；设计节点和素材来源逐页记录。关闭能力只能提供已获准出口。
- 首先运行所涉页面与共享组件的现有针对性测试；合适时使用 `pnpm --filter @englishflow/mobile typecheck`、`pnpm --filter @englishflow/mobile build:h5`。测试命令、源版本和结果必须实记；自动化 UI fixture 的 PASS 不等于实服。共享 token/i18n 修改另跑对应包测试和受影响页面回归。需要本机服务前检查固定端口及租约，不重放或重启未知进程。
- UI 局部可用、接口/Gate 与数据读回、跨端/真机无障碍、部署四层分别记录；新卡完全完成还需 AGENTS 所列需求、契约、单测/集成/E2E、跨端、主题/国际化/性能、owner/权限/事件、文档与实际证据。缺失项继续 `NOT_RUN`、`BLOCKED` 或 `TRACE_PENDING`，不能由截图、类型检查或历史签收代填。

用户已于 2026-11-05 恢复执行。当前执行与验收层以 [CHECKPOINT](CHECKPOINT.json) 为准。2026-11-04 的原始暂停和资源回执保留在 [PAUSE-20261104](PAUSE-20261104.md)。
