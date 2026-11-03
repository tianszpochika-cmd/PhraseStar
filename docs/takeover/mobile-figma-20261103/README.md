# Mobile Figma 改造监督入口（2026-11-03）

状态：`IN_PROGRESS / NOT_ACCEPTED`。这是本轮工作入口，不覆盖 [状态总览](../../STATUS.md) 中的历史签收与其他工作。工作对象为 `apps/mobile` 的 Vue 3 + uni-app 正式学习端，33 条路由以 `apps/mobile/src/pages.json` 为事实源；15 个 Vue 组件与 50 个测试文件只是本次建账时的清点，不是完成率。

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

## 2026-11-04 额度停点（阶段仍在进行）

DSH四个在途CLI任务均返回402、`coding_plan_exhausted=true`并退出，原始回执与冻结源码已保存，见[额度回执](evidence/DSH-QUOTA-STOP-20261104.json)。服务方仅给出Coding Plan用尽及重置时间，未注明周期；未查询余额，也未擅自重试、改账号或充值。Grok仍在工作，当前不满足两家均停止的收口条件。17/33条路由已进入本地UI候选整合，不是整页DoD或项目完成率；语法首跑11项失败、形象生命周期半成品、SRS store和阅读准备分别保留为未签收候选。
