# 移动端 Figma RC1 逐页追溯

设计文件 `UpcXTamTjwrb5OQg9WJiFu`，设计 `UIUX2.0RC1`，QA12 父节点 `393:2`。RC1 仍是候选，`CANDIDATE_NOT_FROZEN`。DEC-04 开放。33 条路由全部 `TRACE_PENDING`。

33 条唯一路由与 `apps/mobile/src/pages.json` 一致，页面文件和 71 处缓存节点引用均已核对。MB-014 与 MB-015 的共用帧在两行各出现一次。

## 勘误与保持项

G173 勘误一。B84 与 B110 使用本机真实 IAM 服务签发的合成身份。B84 的当前 H5 复验同时经过本机 Gateway 与 MySQL。[B84 回执](../evidence/ROOT-B84-CURRENT-H5-IAM-20261106.json) 覆盖 MB-004 与 MB-025。[B110](./INTEGRATION-B110-GRAMMAR-H5-KAFKA.md) 是其后的本机语法作答，使用同一类本机 IAM 合成身份。这两次运行与 [B21](./INTEGRATION-B21-LOGIN.md) 的模拟界面登录相互独立。[B96](./INTEGRATION-B96-H5-PLACEMENT-LEARNING.md) 以本机真实 IAM 登录启动定级旅程。独立的登录错误和回跳验收继续跟踪。

G173 勘误二。旧 B34 快探针只覆盖确认步标识符。`apps/mobile/tests/ui-reset.e2e.cjs` 打开确认步，只填写 `#mobile-reset-identifier`，并记录 `counts().request`。G186 的精确 Chrome 合成输入见 [B114](./INTEGRATION-B114-RESET-IMMEDIATE-INPUT.md)，回执见 [B114 回执](../evidence/ROOT-B114-RESET-IMMEDIATE-INPUT-20261106.json)。报告范围是 `MOBILE_RESET_H5_UI_ONLY_SYNTHETIC_FIXTURES`，浏览器记录为 Playwright Chromium。其中有 68 条矩阵记录、9 组检查、37 张截图。有效申请和确认分别在最后输入后约 3.1 和 2.3 毫秒发送一次对应请求。账号删短到无效值后，分别在约 3.3 和 2.6 毫秒点击，两个接口均未收到请求。模拟 H5 页面审核见 [B34](./INTEGRATION-B34-RESET.md)。[B79 回执](../evidence/ROOT-B79-LOCAL-IAM-RESET-PRIVACY-20261105.json) 是另账的本机 IAM TLS 重置，送达待验。MB-003 保持 `TRACE_PENDING`。

MB-004 的签署观察使用模拟同意包 [mock-consent-publication.json](../../../../apps/mobile/tests/fixtures/mock-consent-publication.json)。B84 在本机真实 IAM 上读取并提交的正文来自该模拟包。正式已发布文档待验。本项不新编 FEAT 或 PRD 编号。

B113 阅读保护判分已有实际 JDBC，见 [B113](./INTEGRATION-B113-READING-PROTECTED-SCORE.md)。V34 四角色发布为 FULL/ZERO，范围负载拒绝，普通只读 `score403`，取消发布拒绝，清理通过。正向 H5 仍待验。页面空目录见 [B103](./INTEGRATION-B103-READING-EMPTY-OWNER.md)，受控页见 [B45](./INTEGRATION-B45-READING.md)。MB-014 保持 `TRACE_PENDING`。

G183 维持 [B52](./INTEGRATION-B52-PRACTICE.md)。练习标签继续指向旧综合练习 `#/pages/b2-practice/b2-practice`，练习中心保持非标签路由。RC1 两帧都选中练习标签，即 `167:4008` 与 `167:5317`。路由改动等待设计选择。MB-010 与 MB-011 保持 `TRACE_PENDING`。

MB-019 与 MB-020 沿用 [B20](./INTEGRATION-B20.md) 的合成检查。[B62](./INTEGRATION-B62-BOUNDARIES-AND-KEYBOARD.md) 在冻结 H5 上复验已登录空态、非空态、出口和匿名回跳。真实游戏服务与自习室服务未跑。本地奖励或入座缺少独立证明，本账只保留上述两层。

精确 FEAT 与 PRD 只沿用 trace 已写明且标为支持的编号。缺失、歧义、章范围和不适用页不新编号。涉及 MB-003、MB-004、MB-005、MB-006、MB-007、MB-009、MB-010、MB-011、MB-013、MB-016、MB-017、MB-018、MB-022、MB-027。模拟同意包与正式已发布文档的缺口同列在 MB-004，不新编编号。

## 33 条路由

| MB | 路由 | 节点 | 证据层 | 追溯 |
|---|---|---|---|---|
| MB-001 登录 | `#/pages/login/login` | `98:1182`、`248:1391` | [B21](./INTEGRATION-B21-LOGIN.md) 模拟界面登录。[B96](./INTEGRATION-B96-H5-PLACEMENT-LEARNING.md) 已实测定级旅程的本机 IAM 正常登录。登录专项继续验收。 | TRACE_PENDING |
| MB-002 注册 | `#/pages/register/register` | `98:2169` | [B26](./INTEGRATION-B26-REGISTER.md) 模拟 H5。真实 IAM 注册未跑。 | TRACE_PENDING |
| MB-003 找回密码 | `#/pages/reset-password/reset-password` | `98:3187`、`98:3496` | [B34](./INTEGRATION-B34-RESET.md) 模拟 H5。[B114](./INTEGRATION-B114-RESET-IMMEDIATE-INPUT.md) 与 [B114 回执](../evidence/ROOT-B114-RESET-IMMEDIATE-INPUT-20261106.json) 记录 G186 精确 Chrome 合成输入：68 条矩阵记录、9 组检查、37 张截图。四条受信任最终输入与点击：有效申请约 3.1ms、有效确认约 2.3ms，各一次匹配 POST；申请删短到无效值约 3.3ms、确认删短到无效值约 2.6ms，请求为零。[B79 回执](../evidence/ROOT-B79-LOCAL-IAM-RESET-PRIVACY-20261105.json) 是另账的本机 IAM TLS 重置，送达待验。 | TRACE_PENDING |
| MB-004 成人门、同意与目标 | `#/pages/onboarding/onboarding` | `164:5455`、`164:5944`、`164:6595`、`164:6762`、`164:7399` | [B57](./INTEGRATION-B57-ONBOARDING-CONSENT.md) 使用 [模拟同意包](../../../../apps/mobile/tests/fixtures/mock-consent-publication.json) 签署。B84 由本机真实 IAM 服务签发合成身份，同意正文来自该模拟包。正式已发布文档待验。B85 有一次目标保存。 | TRACE_PENDING |
| MB-005 访问受限 | `#/pages/forbidden/forbidden` | `270:3110` | [B53](./INTEGRATION-B53-FORBIDDEN.md) 模拟 403。本机真实 IAM 403 未跑。 | TRACE_PENDING |
| MB-006 定级 | `#/pages/assessment/assessment` | `166:1209`、`166:1396`、`166:1467`、`166:1552`、`166:1918`、`166:2015` | [B49](./INTEGRATION-B49-ASSESSMENT.md) 六态模拟。[B96](./INTEGRATION-B96-H5-PLACEMENT-LEARNING.md) 本机十题到今日。[B100](./INTEGRATION-B100-ASSESSMENT-THEME.md) 主题。DEC-04 开放。跳过与重测未跑。 | TRACE_PENDING |
| MB-007 首页 | `#/pages/home/home` | `166:7348`、`247:1980`、`251:215`、`251:2`、`251:362` | [B50](./INTEGRATION-B50-HOME.md) 模拟 H5。[B91](./INTEGRATION-B91-LOCAL-LEARNING-PLAN.md) 计划读回未驱动本屏。暗色 `247:1980` 的 arc 与 flame 未绘制。 | TRACE_PENDING |
| MB-008 今日任务 | `#/pages/today/today` | `166:11121`、`166:11635`、`355:5246`、`355:5315`、`355:5384`、`355:5453` | [B46](./INTEGRATION-B46-WORLD-TODAY.md) 模拟。[B96](./INTEGRATION-B96-H5-PLACEMENT-LEARNING.md) 三条到期。[B99](./INTEGRATION-B99-TODAY-HIGH-CONTRAST.md) 对比。`355:5384` 未作页面视觉，门禁重定向。完成写入未跑。 | TRACE_PENDING |
| MB-009 学习与课程 | `#/pages/learn/learn` | `167:1933`、`167:2065` | [B47](./INTEGRATION-B47-LEARN.md) 模拟货架与详情。本机目录未跑。 | TRACE_PENDING |
| MB-010 练习入口 | `#/pages/practice/practice` | `167:4008` | [B52](./INTEGRATION-B52-PRACTICE.md) 模拟 H5。标签仍打开旧练习页。听力与口语入口关闭。G183 保持 B52 标签。 | TRACE_PENDING |
| MB-011 旧综合练习入口 | `#/pages/b2-practice/b2-practice` | `167:5317` | [B52](./INTEGRATION-B52-PRACTICE.md) 模拟答题与断点。B81 只核共享画质。本机尝试未跑。G183 保持本页为练习标签。 | TRACE_PENDING |
| MB-012 词汇与复习 | `#/pages/b2-vocabulary/b2-vocabulary` | `167:6151` | [B54](./INTEGRATION-B54-VOCAB-GRAMMAR.md) 模拟卡片。真实片段与 SRS 写入未验收。 | TRACE_PENDING |
| MB-013 语法与长难句 | `#/pages/b3-grammar/b3-grammar` | `167:7689`、`167:7790`、`167:8072`、`167:8406`、`167:8665` | [B54](./INTEGRATION-B54-VOCAB-GRAMMAR.md) 模拟。[B105](./INTEGRATION-B105-GRAMMAR-H5-OWNER.md) 本机一题，逐题事件仍为 PENDING。B110 为后续本机语法作答，合成身份由本机真实 IAM 服务签发。 | TRACE_PENDING |
| MB-014 阅读精练 | `#/pages/b3-reading/b3-reading` | `168:1313`、`168:1246`、`168:3333`、`168:2234`、`168:2607` | [B45](./INTEGRATION-B45-READING.md) 模拟。[B103](./INTEGRATION-B103-READING-EMPTY-OWNER.md) 本机空目录。core trace 记录 B109 草稿题。B113 JDBC 判分已有。正向 H5 待验。 | TRACE_PENDING |
| MB-015 分级阅读 | `#/pages/b11-reading/b11-reading` | `168:2513`、`168:1313`、`168:1246`、`168:3333`、`168:2234`、`168:2607` | [B45](./INTEGRATION-B45-READING.md) 模拟。`168:2513` 理解检查保持关闭。本路由本机服务未跑。 | TRACE_PENDING |
| MB-016 错题与报告 | `#/pages/b10-report/b10-report` | `169:667`、`169:1058`、`169:1392`、`169:991`、`169:921` | [B37](./INTEGRATION-B37-PRIVATE-REPORT.md) 模拟。[B60](./INTEGRATION-B60-REPORT-DETAIL-FOCUS.md) 与 [B59](./INTEGRATION-B59-OPERATION-TRACE.md) 记录详情读链缺口。[B62](./INTEGRATION-B62-BOUNDARIES-AND-KEYBOARD.md) 保留同一缺口。分享回执见 [B71](./INTEGRATION-B71-REPORT-SHARE-ISSUE.md)，单独保留。 | TRACE_PENDING |
| MB-017 报告分享 | `#/pages/report-share/report-share` | `169:1714` | [B25](./INTEGRATION-B25-REPORT-SHARE.md) 与 [B73](./INTEGRATION-B73-REPORT-SHARE-MOBILE.md) 为模拟 H5。[B71](./INTEGRATION-B71-REPORT-SHARE-ISSUE.md) 中的 B77 停在 HTTP 读。`169:1714` 的 H5 读仍待验。FEAT 与 PRD 缺失，不新编号。 | TRACE_PENDING |
| MB-018 成长世界 | `#/pages/world/world` | `169:3034` | [B46](./INTEGRATION-B46-WORLD-TODAY.md) 模拟赛季、连胜与任务。本机 gamification 未跑。 | TRACE_PENDING |
| MB-019 游戏目录边界 | `#/pages/b4-games/b4-games` | `169:5353` | [B20](./INTEGRATION-B20.md) 合成空态。[B62](./INTEGRATION-B62-BOUNDARIES-AND-KEYBOARD.md) 复验空态与非空。真实游戏服务未跑。 | TRACE_PENDING |
| MB-020 自习室和社交边界 | `#/pages/b4-social/b4-social` | `169:6882` | [B20](./INTEGRATION-B20.md) 合成房间列表。[B62](./INTEGRATION-B62-BOUNDARIES-AND-KEYBOARD.md) 复验空态与非空。真实自习室服务未跑。 | TRACE_PENDING |
| MB-021 头像与衣柜 | `#/pages/b4-avatar/b4-avatar` | `169:8026` | [B44](./INTEGRATION-B44-AVATAR.md) 模拟预览。衣柜保存关闭。装备写入为零。 | TRACE_PENDING |
| MB-022 离线服务边界 | `#/pages/b4-offline/b4-offline` | `169:8610` | [B01](./INTEGRATION-B01.md) 关闭告知。下载保持关闭。 | TRACE_PENDING |
| MB-023 我的 | `#/pages/profile/profile` | `169:9544` | [B01](./INTEGRATION-B01.md) 模拟就绪页。权威昵称与头像未验收。 | TRACE_PENDING |
| MB-024 设置与隐私 | `#/pages/settings/settings` | `169:10755` | [B22](./INTEGRATION-B22-SETTINGS.md) 模拟偏好与撤回。受理与删除完成保持分开。本机服务未跑。 | TRACE_PENDING |
| MB-025 设备与会话 | `#/pages/devices/devices` | `358:6788` | [B23](./INTEGRATION-B23-DEVICES.md) 模拟列表。B78 与 [B84](../evidence/ROOT-B84-CURRENT-H5-IAM-20261106.json) 以本机真实 IAM 服务签发的合成身份，做单台他人设备撤销。批量撤销与当前设备撤销未验收。 | TRACE_PENDING |
| MB-026 权益与兑换 | `#/pages/b5-commerce/b5-commerce` | `169:14408` | [B31](./INTEGRATION-B31-COMMERCE.md) 合成读取。购买、支付与兑换保持关闭。 | TRACE_PENDING |
| MB-027 语言主题与性能 | `#/pages/b6-platform/b6-platform` | `169:11915` | [B40](./INTEGRATION-B40-PLATFORM.md) 模拟画质。失败保存无回执。FEAT 缺失，PRD 歧义，不新编号。 | TRACE_PENDING |
| MB-028 帮助与客服 | `#/pages/support/support` | `169:13903` | [B24](./INTEGRATION-B24-SUPPORT.md) 模拟列表与详情。发送、回复与上传保持关闭。 | TRACE_PENDING |
| MB-029 听力旧入口 | `#/pages/b3-listening/b3-listening` | `168:3746` | [B01](./INTEGRATION-B01.md) 关闭告知。音频保持关闭。 | TRACE_PENDING |
| MB-030 听力与 Clips | `#/pages/b11-listening/b11-listening` | `168:4327` | [B65](./INTEGRATION-B65-CLOSED-WORKSPACES.md) 关闭告知。旧工作区不在 DOM。片段保持关闭。 | TRACE_PENDING |
| MB-031 口语旧入口 | `#/pages/b3-speaking/b3-speaking` | `168:5501` | [B01](./INTEGRATION-B01.md) 关闭告知。麦克风与评分保持关闭。 | TRACE_PENDING |
| MB-032 音标与跟读 | `#/pages/b11-speaking/b11-speaking` | `168:6160` | [B65](./INTEGRATION-B65-CLOSED-WORKSPACES.md) 关闭告知。麦克风保持关闭。 | TRACE_PENDING |
| MB-033 写作 | `#/pages/b3-writing/b3-writing` | `168:6945` | [B65](./INTEGRATION-B65-CLOSED-WORKSPACES.md) 关闭告知。编辑器与草稿保持关闭。 | TRACE_PENDING |

## 仍开放

33 条都保持 `TRACE_PENDING`。RC1 正式冻结、原生安装、读屏和部署对全部路由开放。DEC-04 留在 MB-006。签收需要点名操作、差量和仍缺字段。
