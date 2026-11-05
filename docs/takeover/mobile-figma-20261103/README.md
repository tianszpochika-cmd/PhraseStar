# Mobile Figma 改造监督入口（2026-11-03）

2026-11-05 用户明确恢复。六棵源码与暂停快照逐文件吻合，Root 原有 103 个待验路径按卡处理。现用本机 Grok CLI 优先与 DSH CLI 并行。DSH 新任务已成功运行，2026-11-04 的额度停止记录与[暂停收口](PAUSE-20261104.md)保留为历史。当前以 [CHECKPOINT](CHECKPOINT.json) 为准。

状态：`IN_PROGRESS / NOT_ACCEPTED`。这是本轮工作入口，不覆盖 [状态总览](../../STATUS.md) 中的历史签收与其他工作。工作对象为 `apps/mobile` 的 Vue 3 + uni-app 正式学习端，33 条路由以 `apps/mobile/src/pages.json` 为事实源；15 个 Vue 组件与 50 个测试文件只是本次建账时的清点，不是完成率。

- 当前 33/33 条路由进入本地 UI 候选。引导目标保存与读回已复验，首次签署的 9 个模拟场景通过。IAM 本地 V18 到 V19 升级和 41 项候选检查通过。本机 Gateway 和 IAM TLS 合成签署链路共 184 项通过。正式发布与部署后签署待验。Xcode 首启已通过，Android 工具已读取。原生打包、实机、读屏和部署单列。 [引导首次签署 B57](reviews/INTEGRATION-B57-ONBOARDING-CONSENT.md)
- 33 条路由的源码调用与限制已对照静态契约，完整追溯仍待签收。错题详情旧地址缺网关精确转发，设置页客服查询已补兼容说明。全量契约门禁保留既有 Gateway 与事件基线差异。 [B59 调用追溯](reviews/INTEGRATION-B59-OPERATION-TRACE.md) · [需求与门禁缺项](reviews/TRACE-AUDIT-20261105.md)
- [当前 H5 签署与设备 B84](reviews/INTEGRATION-B57-ONBOARDING-CONSENT.md#b84-当前-h5-签署与设备复验) 最新 H5 的三份模拟签署、目标页过渡及设备撤销再次通过。
- [Android 模拟器 B101](reviews/INTEGRATION-B101-ANDROID-SIMULATOR-KEYSTORE.md) 独立测试宿主的 Keystore 密文替换、跨启动读回和删除通过。
- [iOS 模拟器 B98](reviews/INTEGRATION-B98-IOS-SIMULATOR-KEYCHAIN.md) 独立测试宿主的 Keychain 三次启动和系统属性检查通过。
- [原生安全存储 B92](reviews/INTEGRATION-B92-NATIVE-SECURE-STORAGE.md) 33 条 App 路由、双平台桥接源码、675 项源码测试和 43 个离线 H5 场景通过。两端独立模拟器的系统存储读写已另行验证，正式安装宿主继续验收。
- [测评消息确认 B104](reviews/INTEGRATION-B104-ASSESSMENT-KAFKA-ACK-CORE.md) 发布确认、失败处理及默认启动通过受控验证，真实 broker 继续验收。
- [测评事件领取 B102](reviews/INTEGRATION-B102-ASSESSMENT-OUTBOX-LEASE.md) 实际 MySQL 的四项领取和租约检查通过。发布与消费继续验收。
- [测评事件编号 B97](reviews/INTEGRATION-B97-ASSESSMENT-EVENT-CORRELATION.md) 逐题事件信封和正文通过编译后校验，消息消费仍待验。
- [定级主题 B100](reviews/INTEGRATION-B100-ASSESSMENT-THEME.md) 暗色与高对比组件样式通过 34 项受控浏览器检查。
- [今日高对比 B99](reviews/INTEGRATION-B99-TODAY-HIGH-CONTRAST.md) 亮色、暗色、高对比与放大文字的 13 个受控视口通过。
- [完整本机 H5 B96](reviews/INTEGRATION-B96-H5-PLACEMENT-LEARNING.md) 同一浏览器从目标经十题定级、报告、自动计划到今日三条记录，数据库及资源回收通过。
- [测评题库快照 B95](reviews/INTEGRATION-B95-ASSESSMENT-BANK-PIN.md) 新练习会话与现有事件保留内容来源编号，旧会话迁移读回通过。
- [测评事件 B94](reviews/INTEGRATION-B94-ASSESSMENT-OUTBOX-IDENTITY.md) 数据库行与消息共用事件编号，后续可信进度消费单列。
- [今日待复习 B93](reviews/INTEGRATION-B93-TODAY-DUE-ROWS.md) 真实学习服务的数据形态已接入就绪清单，当前读回与实际作答完成分别验收。
- [本机学习计划 B91](reviews/INTEGRATION-B91-LOCAL-LEARNING-PLAN.md) 真实定级后生成启用计划，今日任务及同键重试读回通过。
- [本机定级完成 B90](reviews/INTEGRATION-B49-ASSESSMENT.md#b90-本机十题定级和报告) 十题评分、同键重试、报告及数据库读回通过。
- [当前 H5 定级首题 B89](reviews/INTEGRATION-B49-ASSESSMENT.md#b89-当前-h5-真实首题) 真实目标读回后键盘创建会话，题干、选项和未答状态匹配服务端。
- [本机定级断点 B88](reviews/INTEGRATION-B49-ASSESSMENT.md#b88-本机首题评分和断点) 首题真实评分、同键重试和第二题读回通过。
- [本机定级 B87](reviews/INTEGRATION-B49-ASSESSMENT.md#b87-本机定级会话创建和读回) 创建、读回和数据库确认通过，锁定实际目标版本和 10 道已发布题。
- [当前 H5 学习目标 B85](reviews/INTEGRATION-B57-ONBOARDING-CONSENT.md#b85-当前-h5-学习目标保存) 真实页面保存一次，学员服务读回后跳转定级入口，偏好保持。
- [本机学习目标 B82](reviews/INTEGRATION-B57-ONBOARDING-CONSENT.md#b82-本机学习目标保存) 学员服务保存和读回目标，重试不递增版本，设置偏好保持。
- [本机浏览器首次签署 B75](reviews/INTEGRATION-B57-ONBOARDING-CONSENT.md#b75-浏览器首次签署) 三份模拟正文与版本、三次成功签署、IAM 落库读回及会话刷新通过。正式发布和部署后验收待办。
- [引导正文键盘 B70](reviews/INTEGRATION-B57-ONBOARDING-CONSENT.md#b70-首次签署正文键盘复核) 74 项受控 H5 检查通过，覆盖实际披露键盘焦点和三种界面组合。
- [边界与键盘 B62](reviews/INTEGRATION-B62-BOUNDARIES-AND-KEYBOARD.md) 小游戏与自习室的空态、非空、退出和回跳已在冻结 H5 复验，错题弹层键盘和三页 H5 文字放大单列。
- [首次签署模拟发布包](../../../apps/mobile/tests/fixtures/mock-consent-publication.json) 含三份独立版本的测试正文和逐份 SHA-256 摘要，用于受控验收。IAM 本地正文投影有隔离数据库和控制器证据，正式发布继续单列。
- [关闭页 B65](reviews/INTEGRATION-B65-CLOSED-WORKSPACES.md) 写作和两条 B11 的遗留工作区清理已通过 255 项受控浏览器检查。
- [关闭页 B56](reviews/INTEGRATION-B56-CLOSED-PRACTICE.md) 收口旧听力与口语关闭页，组合 H5 116 项受控检查通过。
- [报告分享 B71](reviews/INTEGRATION-B71-REPORT-SHARE-ISSUE.md) 隔离 MySQL 验证同键并发签发和既有撤销边界。 [移动端 B73](reviews/INTEGRATION-B73-REPORT-SHARE-MOBILE.md) 54 项受控浏览器检查通过。
- [报告分享 B77](reviews/INTEGRATION-B71-REPORT-SHARE-ISSUE.md#b77-本机-gateway-报告分享) 本机 Gateway 和学习服务的并发签发、冲突、旧调用与撤销读回通过。
- [设备页浏览器 B78](reviews/INTEGRATION-B23-DEVICES.md#b78-本机-h5-设备退出) 真实页面键盘确认、单次退出、读回后成功提示及目标会话刷新拒绝通过。
- [设备退出 B76](reviews/INTEGRATION-B23-DEVICES.md#b76-本机设备退出接口) 本机 Gateway 与 IAM 通过设备列表、同键重试、单设备撤销及刷新拒绝验证。
- [H5 运行时画质 B83](reviews/INTEGRATION-B80-PERFORMANCE-RUNTIME.md#b83-当前-h5-运行验证) 实际登录页在受控帧回调下关闭动效，手动画质偏好保持。
- [运行时画质 B80](reviews/INTEGRATION-B80-PERFORMANCE-RUNTIME.md) 前台持续低帧率与原生内存告警降档，保存的手动画质保持。661 项移动端源码和 43 个日常 H5 场景通过。
- [练习页共享画质 B81](reviews/INTEGRATION-B80-PERFORMANCE-RUNTIME.md#b81-练习页共享画质) 练习页使用当前共享档位，662 项移动源码及 140 项练习浏览器检查通过。
- [日常 H5 入口 B74](reviews/INTEGRATION-B74-CURRENT-H5-RUNNER.md) 默认构建的匿名与关闭页检查覆盖 43 个场景。
- [匿名路由 B55](reviews/INTEGRATION-B55-ANONYMOUS-ROUTES.md) 33/33 通过，覆盖安全返回与零匿名私有请求。
- [词汇与语法 B54](reviews/INTEGRATION-B54-VOCAB-GRAMMAR.md) 验证复习队列、冷启动、同步回执与语法交互。新增 MB-012、MB-013，累计 32/33 条本地 UI 候选。
- [访问受限 B53](reviews/INTEGRATION-B53-FORBIDDEN.md) 19 项组合检查通过。新增 MB-005，累计 30/33 条本地 UI 候选。
- [练习 B52](reviews/INTEGRATION-B52-PRACTICE.md) 140 项实际浏览器检查通过，包含提交、断点与日报。新增 MB-010、MB-011，累计 29/33 条本地 UI 候选。
- [首页 B50](reviews/INTEGRATION-B50-HOME.md) 通过 25 项组合浏览器检查与 31 组布局，覆盖手机与 iPad 两种方向。新增 MB-007，累计 27/33 条本地 UI 候选。
- [定级 B49](reviews/INTEGRATION-B49-ASSESSMENT.md) 27 项定向测试及 28 项组合浏览器检查通过。新增 MB-006，累计 26/33 条本地 UI 候选。DEC-04 反馈时点待决策。
- [引导页 B48](reviews/INTEGRATION-B48-ONBOARDING.md) 已有成人门、目标和记录浏览通过局部审核。R1-008 首次签署待契约事实，该批未增加整页本地候选。
- [课程书架与详情 B47](reviews/INTEGRATION-B47-LEARN.md) 49 项组合浏览器检查和 9 图通过，匿名直达保留返回意图。新增 MB-009，累计 25/33 条本地 UI 候选。
- [今日任务与成长 B46](reviews/INTEGRATION-B46-WORLD-TODAY.md) 验证 390px 主按钮、课程真实入口、四个资源各读一次及赛季重试。该批新增 MB-008、MB-018，当时本地 UI 候选 24/33。
- [真实阅读空态 B103](reviews/INTEGRATION-B103-READING-EMPTY-OWNER.md) 内容库及真实 H5 确认目录为空，发布文章详情继续验收。
- [阅读两页 B45](reviews/INTEGRATION-B45-READING.md) 通过 21 组组合浏览器检查，包含离开后的迟到内容防护。该批新增 MB-014 与 MB-015，当时本地 UI 候选 22/33。
- [形象与衣柜 B44](reviews/INTEGRATION-B44-AVATAR.md) 通过 42 项源码、52 项组合浏览器检查和 16 图。该批新增 MB-021，当时本地 UI 候选 20/33。
- [形象与成长 B41](reviews/INTEGRATION-B41-AVATAR-WORLD.md) 验证迟到请求与重复读取并分批整合，保留首屏视觉差异。当批两页只进入功能候选。后续形象页见 B44，成长页见 B46。
- [画质与设备 B40](reviews/INTEGRATION-B40-PLATFORM.md)：Root 25 项源码检查、两端类型、H5、547 项本地浏览器检查与 19 图通过，包含 390px 四档同排。该批 19/33 为本地 UI 候选；实服、设备、读屏、部署待验。
- 首页 B30 的早期登录返回和目标 fixture 差异已在 B50 按实际路径复核，旧原始回执保留。
- [错题与报告 B37](reviews/INTEGRATION-B37-PRIVATE-REPORT.md)：最终13项源测试、核心55项/18图与身份21项/5图通过；词汇C1接口与队列另行整合。
- [启动偏好恢复 B36](reviews/INTEGRATION-B36-HYDRATION.md)：18项源测试、组合25项/4图通过，原生滚轮等待停稳后复验；平台页临时恢复另待清理。
- [共享会话修复 B35](reviews/INTEGRATION-B35-AUTH.md)：Root真实store/client等44项测试与设置401/403浏览器16项通过；迟到刷新跨账号浏览器仍待验。
- [找回密码本机接口 B79](reviews/INTEGRATION-B34-RESET.md#b79-本机找回密码隐私) 已知与未知账号一致、无效码拒绝及原会话有效均通过。
- [找回密码组合审核 B34](reviews/INTEGRATION-B34-RESET.md)：Root 68样本/8组交互/7图标场景/37图及18项源测试通过；近零输入和内部字段观测限制保留。
- [三页文案注册 B27](reviews/INTEGRATION-B27-REGISTRY.md)：空模块按单写者交接，旧页面文案逐值不变，不计新增页面完成。
- [注册组合审核 B26](reviews/INTEGRATION-B26-REGISTER.md)：12项源检查、51样本/14组/43图；暗色图标修复，全局B23五失败仍保留。
- [公开分享组合审核 B25](reviews/INTEGRATION-B25-REPORT-SHARE.md)：11项源检查、73项组合矩阵、14项UI登录后公开读检查；日期与授权边界已复验。
- [客服组合审核 B24](reviews/INTEGRATION-B24-SUPPORT.md)：49项源检查、198项组合浏览器检查；GET适配保留设置兼容，写业务保持关闭。
- [设备组合审核 B23](reviews/INTEGRATION-B23-DEVICES.md)：最终41项源检查/26项英文错误复验；较早247核心/131共享布局检查按源分开，原失败保留。
- [设置组合审核 B22](reviews/INTEGRATION-B22-SETTINGS.md)：保留全部实际业务，24项源检查、134项组合检查、5项跨页焦点及最终CSS34项局部回归；真服务与设备另列。
- [登录组合审核 B21](reviews/INTEGRATION-B21-LOGIN.md)：12项认证/文档检查、30布局/14组交互/31图与41项共享局部回归；真实服务另列。
- [游戏与社交组合审核 B20](reviews/INTEGRATION-B20.md)：25 项源检查、41 项局部构建产物浏览器检查；范围与历史矩阵分开。
- [七页组合浏览器复核](reviews/INTEGRATION-B13.md): compiled source commit 3a91f6ec,599 synthetic UI checks/39 images; real services/devices remain NOT_RUN.
- [首批七页组合审核](reviews/INTEGRATION-B01.md): 109 source/asset files; typecheck, H5 build and 55 tests pass; combined599 checks/39 screenshots passed with open negative-gate exception.
- [任务与追溯](TASKS.md)：逐页范围、原始编号、初步来源和未完成字段。
- [文件与进程所有权](OWNERSHIP.md)：唯一写者、交接与 18183 串行租约。
- [机器检查点](CHECKPOINT.json)：初始基线、候选所有权、额度状态、各层证据和待办。仅将实测结果写入，不预填 PASS。
- 阶段审核：[六个关闭页 B03](reviews/DSH-B03.md)、[登录/首页 R03](reviews/GROK-R03.md)。来源 hash 清单在 evidence，实际截图与 CLI 原始记录仍保存在本机监督目录；未将模型完整会话或使用量签名写入仓库。
- 原始入口：[R1 计划](../../06-design/v2-980plus/redesign/dev-plan-R1.md)、[状态](../../STATUS.md)、[移动页面审计](../UI-PAGE-AUDIT-20261013.md)、[设计来源追溯](../../06-design/v2-980plus/redesign/design-source-traceability.md)。

设计参考为 Figma 文件 `UpcXTamTjwrb5OQg9WJiFu` 的 `UIUX2.0RC1`、QA12 节点 `393:2`。已读取的交付说明明确：已确认页面可开发，RC1 仍是候选版，尚非最终冻结；不是每张状态都有深色和 iPad 稿。定级反馈规则仍待确认。实现前逐页记录所用画板/状态及其确认来源，不把这条说明扩大为 33 页、全部交互、无障碍或真机均已签收。定级遵循 BC-015/IC-011，DEC-04 由产品/测评负责人决定；普通练习继续按现有规则处理。

基线 `f01cddc6be0fe6f190a6f47525ebbd91a5047900`；本轮隔离工作树以此为基线，后加的 DSH-PROFILE 独立工作树及共享文件预载来源见机器检查点。旧 R1 115/115 的签收只属于 `7a6ac0a2` 上的具名范围；旧移动 UI 局部签收按原证据保留，本轮设计/源码/运行须分别重验。`100–140 小时`仅为计划估计，不是授权或工作量上限。

## 启动检查点

2026-11-03 23:31（北京时间）记录的启动检查确认 Grok 1.0.62 与 DSH 0.2.1-rc.5（`opendesin/deepseek-v4.1-flash/max`）连通，周额度为 `UNKNOWN`。原 Codex runner 子代理已经停止，后续由 Root 直接调度两个本机 CLI，真实会话、进程、任务文件和日志入口见机器检查点。按用户后续要求不再查看用量面板；普通完成、权限取消及人工保存断点均不是额度耗尽。

2026-11-04 00:33 的阶段事实：Grok 的共享基础、登录和首页仍为候选，正在修复与进行精确浏览器检查；DSH 六个关闭状态页与共用主体组件已冻结 48 个改动/新增文件（含 33 项原素材），组件和页面测试、相关门控回归已收到通过回执。源码冻结与测试回执不等于视觉验收：共享文案与 token 组合、准确页头、浏览器主题及设备仍待复核。注册/重置和小游戏/自习室的下一批参考已经补充，逐页适用仍须核验。

## 工作规则

用户后续明确：执行只使用本机 Grok CLI 与 DSH CLI，不再调用 Codex 模型子代理；此前的 Codex 子代理已停止。Root 直接承担派工、审核、监督记录及整合，不代写产品实现。停止查看额度面板，保留 CLI 实际额度耗尽停止的回执；余额仍为 UNKNOWN，不能用普通完成、权限取消或网络失败替代额度停止。

1. Grok 负责共享 token、多数共享组件和 MB-001…010；DSH 主任务先做 MB-019/020/022/029…033，再做 MB-017、025…028；DSH-PROFILE 独立处理 MB-023、024。两个 DSH 任务使用同一 CLI/provider 的不同会话与工作树。MobileClosedPracticeNotice、已发布后的 MobilePageHeader 等独占例外以 OWNERSHIP 和机器检查点为准。MB-021 已转主 DSH，MB-016 已转 DSH-PROFILE，MB-018 已转 DSH-COMMERCE；MB-011…015 后续由 Root 明确指定；所有切换先登记唯一写者。
2. 设计、接口和数据事实不得互相替代。成人/同意/身份由 IAM，题目和规则由 content，attempt/定级由 assessment，计划/SRS 由 learning 等各自 owner 判定。无合法 API/权限或阶段条件时保留受限、空、失败与恢复路径，不因画稿或 fixture 开启能力。
3. 每页先核已有 R1/BC/IC、PAGE 和适用契约，再实施对应 UI 差量；FEAT/PRD-ATOM/V2-980、ARCH、ACT/JNY/PAGE/RULE/INT/E2E、服务和数据 owner 的未核项标 `TRACE_PENDING`。整页审签前必须补齐或明确不适用的原因，不得发明 ID。
4. 本机 H5、受控数据、真实服务读写、iOS/Android/iPad 实机、无障碍和部署分别计账；所有验收绑定候选源、运行版本、环境、可复现步骤及证据，失败原件保留。
5. 开发第一阶段以 Grok、DSH **两家的周额度均经真实来源确认耗尽**为暂停条件；`UNKNOWN` 或短期限流不等于周额度耗尽。一家耗尽时另一家继续符合所有权规则的有效任务；转交前冻结、登记并释放唯一写者。若真实任务提前全部完成，正常收口，不为耗额度制造任务。
6. 停下时保存 CLI 会话与进程、工作树/分支、源码与未跟踪文件、任务及证据、额度来源和恢复步骤；Root 审核合格差量后正常提交和推送，未验候选单列快照并保持未验。禁止 force、reset 和改凭据；本账本初始化不代表已经提交或发布。

## 2026-11-04 历史额度停点

DSH四个在途CLI任务均返回402、`coding_plan_exhausted=true`并退出，原始回执与冻结源码已保存，见[额度回执](evidence/DSH-QUOTA-STOP-20261104.json)。服务方仅给出Coding Plan用尽及重置时间，未注明周期；未查询余额，也未擅自重试、改账号或充值。Grok仍在工作，当前不满足两家均停止的收口条件。17/33条路由已进入本地UI候选整合，不是整页DoD或项目完成率；语法首跑11项失败、形象生命周期半成品、SRS store和阅读准备分别保留为未签收候选。

DSH退出后，Root已将冻结且无人写入的主、设备、权益工作树分别转给独立Grok CLI会话，继续语法、词汇/SRS和形象生命周期修复；原Grok会话继续新手引导。四个会话均禁用子代理，未再调用DSH或Codex模型。当前写者见OWNERSHIP和CHECKPOINT。

暂停前18/33条正式路由进入本地UI候选整合，完整DoD另行验收。该时点由 Grok 五路推进新手引导、形象、语法、SRS 请求验证和双阅读页，DSH 处于当时的额度停点。
