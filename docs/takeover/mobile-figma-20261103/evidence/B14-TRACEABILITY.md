# integration batch-14 七页需求追溯

- integration commit：`3a91f6ec48022e9564268e126427c0410cde2f86`
- 范围：仅 MB-022、MB-023、MB-029、MB-030、MB-031、MB-032、MB-033（六关闭页 + profile）；不是 33 全仓/980 全量审核。
- 状态：七页全部 **`TRACE_PENDING`**。本文只做可复核追溯，不写 repo 文档、不改变产品/需求。
- UI 证据：B13 synthetic candidate 599/599、39 图（closed 476/24，profile 123/15）；不继承作者旧树 PASS，不替代 real API/native/hardware/readers/deployment。
- `TASKS.md:3-9,30-31,37-41` 明确这些行是准备锚点，不是完整实现/验收结论；历史 115/115 不当作当前 UI 通过。

## 0. 总表

| ID | 路由/页面 | 服务/数据 owner | 当前覆盖 | 状态 |
|---|---|---|---|---|
| MB-022 | `#/pages/b4-offline/b4-offline` 离线服务边界 | learning-service、media-service、workflow-service（恢复，owner 待核） | 关闭告知 + 可选 pending-sync 队列；无下载/PWA | TRACE_PENDING |
| MB-023 | `#/pages/profile/profile` 我的 | iam-service、learner-service | 账号/语言/成人事实、8 导航、会话/退出壳 | TRACE_PENDING |
| MB-029 | `#/pages/b3-listening/b3-listening` 听力旧入口 | media-service、content-service | 关闭告知 + 替代入口 | TRACE_PENDING |
| MB-030 | `#/pages/b11-listening/b11-listening` 听力与 Clips | media-service、content-service | 关闭告知 + 替代入口 | TRACE_PENDING |
| MB-031 | `#/pages/b3-speaking/b3-speaking` 口语旧入口 | media-service、assessment-service | 关闭告知 + 替代入口 | TRACE_PENDING |
| MB-032 | `#/pages/b11-speaking/b11-speaking` 音标与跟读 | media-service、assessment-service | 关闭告知 + 替代入口 | TRACE_PENDING |
| MB-033 | `#/pages/b3-writing/b3-writing` 写作 | content-service、assessment-service | 关闭告知 + 替代入口 | TRACE_PENDING |

## 1. MB-022 离线服务边界

- 初始锚点：`TASKS.md:30`；`CHECKPOINT.json:1702-1767`。
- trace：ACT-P1-LEARNER/SYSTEM；JNY-P1-14；RULE-P1-TIME-SYNC；INT-P1-014；E2E-P1-NOTIFICATION-SYNC；ARCH-REL-001；PAGE-P1-SYNC-OFFLINE；R1/BC 空；IC-062；FEAT-INF-004→V2-980-0408；PRD-ATOM 空。
- 覆盖分类：PAGE/FEAT/RULE 是相关父级或链路；**没有**下载/PWA 的完整原子；`prd_atom_v2=[]` 是真实缺口。
- 实际 UI/operation：`b4-offline.vue:20-31` 只做 session restore、未登录跳 login、`b4.restore`、相邻 `b4.loadWorld`；`b4.syncOffline` 仅在既有 pending queue 槽位（`:31,49-63`）；无下载请求、无 PWA 学习。
- 路由/行：`pages.json:137`；closed notice `b4-offline.vue:36,38-64`；组件 emit `MobileClosedPracticeNotice.vue:71,89`。
- UI 差量：closed header/notice + 可选同步队列；不是离线包功能。
- 证据：B13 `390-offline`（390×844）等 24 closed shots；source SHA `3f1c8724...`；source stable。
- GAP：GAP-B14-004/005/006/007。

## 2. MB-023 我的 profile

- 初始锚点：`TASKS.md:31`；`CHECKPOINT.json:1768-1839`。
- trace：ACT-P1-VISITOR/LEARNER；JNY-P1-01；RULE 空（IAM 生命周期，无独立学习规则）；INT-P1-001；E2E-P1-AUTH-LIFECYCLE；ARCH-IAM-001/002；PAGE-P1-ONB-GOAL/ PAGE-P1-SETTINGS；R1-004/010；BC-004/010；IC 空；FEAT-USR-006→V2-980-0364；PRD-ATOM-1052→V2-980-0373。
- 覆盖分类：PAGE 只是父/邻接，**没有 `PAGE-P1-PROFILE/ME` canonical ID**；FEAT/PRD 是父/部分锚点；不能把 R1-004/010 替代页级验收。
- 实际 UI/operation（integration 源码）：
  - `profile.vue:17-18` resolvedTheme 订阅；`:56-69` ready/error/guest/loading；`:242-266` `loadAccount`；`:278-301` guard + `showProfile`；`:303-327` onShow/onHide/watch；`:331-464` 账号/8 导航/退出。
  - `readAccount`：GET `/learner/profile` + optional `/learner/targets` + `/learner/preferences`（`api/learner-content.ts:633-640`）。
  - `POST /auth/logout` 通过 `session.logout`（`stores/session.ts:278`；`auth/gateway-auth.ts:227`）。
  - 8 路由：`profile.vue:128-139`；`pages.json:102,109,130,137,193,207,214,228`（integration 行号核）。
  - 无昵称/头像/统计 API；页面用「学」占位（`profile.vue:373`）；无直接目标/偏好写。
- UI 差量：账号事实、8 个既有导航、logout 二次确认、loading/error/ready、theme；不是 PRD 18.1 完整个人中心。
- 证据：B13 profile 123/123、15 图；source SHA `81011a29...`；source stable；`--yx-profile-*` 在 `mobile.ts:150-164` 已存在（旧 profile trace 的“11 token 未落地”已过时，本报告不重复旧推断）。
- GAP：GAP-B14-001/002/003/008/009/010/011。

## 3. MB-029 听力旧入口

- 初始锚点：`TASKS.md:37`；`CHECKPOINT.json:2207-2279`。
- trace：ACT-P1-LEARNER；JNY-P1-06；RULE-P1-SESSION/TIME-SYNC；INT-P1-005/006；E2E-P1-MULTISKILL；ARCH-API-001/REL-001；PAGE-P1-LISTENING；R1-048；BC-043；IC-026；FEAT-LST-001→V2-980-0107；PRD-ATOM-0476→V2-980-0238。
- 覆盖：PAGE 是共享听力页，R1/BC/IC 是关闭/媒体相关卡；不是完整听力练习/音频验收。
- 实际 UI/operation：`b3-listening.vue:50` onMounted 只 session restore/未登录跳 login，明确 no live load；`:56-68` closed notice + alternatives；`:28-49` back/alternatives。旧 `load/submit/playAudio` 仍在源码 `:23-27` 但 mount 不调用。
- 路由/行：`pages.json:53`；替代 `/pages/b2-vocabulary/b2-vocabulary`、`/pages/b3-reading/b3-reading`；BACK `/pages/today/today`。
- UI 差量：关闭告知与安全替代，不提供音频/听写。
- 证据：B13 closed 476/24；`390-b3-listening`；source SHA `87f67b30...`。
- GAP：GAP-B14-004/006/007。

## 4. MB-030 听力与 Clips

- 初始锚点：`TASKS.md:38`；`CHECKPOINT.json:2280-2352`。
- trace 同 MB-029（PAGE-P1-LISTENING、R1-048、BC-043、IC-026、FEAT-LST-001、PRD-ATOM-0476）。
- 覆盖：共享听力 PAGE 的关闭入口；不是 Clips/媒体素材验收。
- 实际：`b11-listening.vue:114` onMounted no live load；`:120-131` closed notice；`:91-113` back/alternatives。无媒体请求/音频权限。
- 路由/行：`pages.json:74`；替代 vocab/reading；BACK today。
- 证据：B13 `390-b11-listening`；source SHA `61948c42...`。
- GAP：GAP-B14-004/006/007。

## 5. MB-031 口语旧入口

- 初始锚点：`TASKS.md:39`；`CHECKPOINT.json:2353-2425`。
- trace：ACT-P1-LEARNER；JNY-P1-06；RULE SESSION/TIME-SYNC；INT-P1-005/006；E2E MULTISKILL；ARCH-API-001/REL-001；PAGE-P1-SPEAKING；R1-048；BC-043；IC-027；FEAT-SPK-004→V2-980-0162；PRD-ATOM-0170→V2-980-0063。
- 覆盖：PAGE 共享口语页；关闭/媒体卡不等于发音/录音/评分完成。
- 实际：`b3-speaking.vue:57` onMounted session restore only, no live load/recording；`:62-73` closed notice；`:35-56` back/alternatives。旧录音/角色扮演函数仍在源码但不从 mount 调用。
- 路由/行：`pages.json:67`；替代 vocab/reading；BACK today。
- 证据：B13 `390-b3-speaking`；source SHA `e9054fa5...`。
- GAP：GAP-B14-004/006/007。

## 6. MB-032 音标与跟读

- 初始锚点：`TASKS.md:40`；`CHECKPOINT.json:2426-2498`。
- trace：同 MB-031（PAGE-P1-SPEAKING、R1-048、BC-043、IC-027、FEAT-SPK-004、PRD-ATOM-0170）。
- 覆盖：共享口语 PAGE 的关闭入口；不是音标 48 项/跟读验收。
- 实际：`b11-speaking.vue:121` onMounted no live load；`:127-138` closed notice；`:99-120` back/alternatives；旧 recording/load 函数保留在源码但不从 mount 调用；不提前请求麦克风。
- 路由/行：`pages.json:88`；替代 vocab/reading；BACK today。
- 证据：B13 `390-b11-speaking`；source SHA `ab793ae5...`。
- GAP：GAP-B14-004/006/007。

## 7. MB-033 写作

- 初始锚点：`TASKS.md:41`；`CHECKPOINT.json:2499-2565`。
- trace：ACT-P1-LEARNER；JNY-P1-06；RULE SESSION/TIME-SYNC；INT-P1-005/006；E2E MULTISKILL；ARCH-API-001/REL-001；PAGE-P1-WRITING；R1-048；BC-043；IC-028；FEAT-WRT-002→V2-980-0190；PRD-ATOM-0454→V2-980-0195。
- 覆盖：共享写作 PAGE 的关闭入口；不是写作题/批改/提交完成。
- 实际：`b3-writing.vue:119` onMounted no live load；`:125-135` closed notice + alternatives；`:38-59` back/alternatives；旧 B10 prompt/draft/submit 函数仍在源码但不从 mount 调用。
- 路由/行：`pages.json:46`；替代 vocab/reading；BACK today。
- 证据：B13 `390-writing` + 320/430/dark/HC/en/reduced/200 变体；source SHA `f8813929...`。
- GAP：GAP-B14-004/006/007。

## 8. 共同判断

- 六关闭页是“未开放的准确告知 + 真实可用替代入口”，不是原听力/口语/写作/媒体/AI 业务完成；原业务仍不在本 UI 候选签收。
- profile 是账号/入口/会话/退出壳，不是 PRD 18.1 全量个人中心；昵称/头像/统计缺契约与 UI，guest 受 AUTH_ONLY 不可达。
- 七页都不把 B13 599/39 synthetic 当 real API/native/hardware/readers/deployment；后者 NOT_RUN。
- `TRACEABILITY.json` 保存每页 anchor、line refs、source SHA、gaps、evidence；`GAPS.json` 保存 12 个本地观察项（非 canonical 需求 ID）。

## 9. 源 SHA（B13 integration results）

| 页面 | SHA |
|---|---|
| b4-offline | `3f1c87247e3b...` |
| profile | `81011a298cf2...` |
| b3-listening | `87f67b305cf5...` |
| b11-listening | `61948c42bfac...` |
| b3-speaking | `e9054fa597d3...` |
| b11-speaking | `ab793ae5a1bd...` |
| b3-writing | `f88139290830...` |

完整 64 位 SHA、`sourceHashesStart/End` 见 `/tmp/dsh-integration-batch-13/*/results.json` 与 `TRACEABILITY.json`。
