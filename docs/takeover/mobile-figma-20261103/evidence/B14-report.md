# batch-14 报告：social 44px 收口 + 七页可复核追溯

- 工作树（A）：`/Users/Admin/.codex/worktrees/mobile-figma-dsh-20261103/cloudstudy`
- 追溯基线（B）：integration commit `3a91f6ec48022e9564268e126427c0410cde2f86`
- 本轮无 18183 浏览器租约；不访问/启停服务。A 的 44px 只做源码/静态验证，不冒称浏览器实测。
- B 只读 integration 源码/文档；没有写 repo 文档，没有改产品/测试/共享资源。

## A. social room/joined tile 44×44

- 文件：`apps/mobile/src/pages/b4-social/b4-social.vue:320`。
- 只改真正 room/joined 共用的 `.v2-social-tile`：`48px×48px → 44×44`。
- 保持：
  - 内部 users SVG **22×22**（`:321`），未改字节；
  - 房间“加入”按钮 **72px**（`:337`）与业务布局不变；
  - badge 的 44×44（`:297`）是另一槽位，未替换；
  - 未把所有 48 类一律替换。
- 当前 social.vue SHA：`c7f0f5ade74a234a79eae61a1010f6f96385322ad2951174d463cb5db14cd714`（未提交）。
- 最小验证：
  - `pnpm --filter @englishflow/mobile typecheck`：**exit 0**
  - social/B12/header SFC：**3/3 OK**
  - `b4-social-page` + `b4-account-scope` + `mobile-header-and-closed-geometry`：**17/17 pass**
- 后续有租约时的实跑要点：390 rooms/joined + 320/HC/200% 量测 `.v2-social-tile` rect **44×44**、icon **22×22**、加入按钮 **72px** 且不截断；本轮没有浏览器图，不称已实测。
- 精确 green token 仍 pending（Root 已排 Grok 下一包）；当前 semantic fallback 保留，无页面硬编码色。

## B. 七页追溯（只读）

- 范围严格：MB-022、MB-023、MB-029、MB-030、MB-031、MB-032、MB-033；不是 33 全仓或 980 全量。
- 初始来源：integration `TASKS.md:30-31,37-41`；详细锚点/owner/ACT/JNY/PAGE/RULE/INT/E2E/ARCH/R1/BC/IC 来自 `CHECKPOINT.json` 对应 page 块。
- **七页全部 `TRACE_PENDING`**；没有把 TASKS 的准备锚点或 B13 synthetic 证据写成需求完成。
- 文件：
  - `/tmp/dsh-batch-14-trace/TRACEABILITY.json`
  - `/tmp/dsh-batch-14-trace/TRACEABILITY.md`
  - `/tmp/dsh-batch-14-trace/GAPS.json`（12 个本地观察项，非 canonical 需求 ID）

### 七页结论（摘要）

| 页 | 当前覆盖 | 关键缺口 |
|---|---|---|
| MB-022 离线边界 | 关闭告知 + 可选 pending-sync 队列；无下载/PWA | `prd_atom_v2=[]`；FEAT-INF-004 只是父锚点；原离线能力未完成 |
| MB-023 我的 | 账号/语言/成人事实、8 导航、session/logout 壳 | 无 canonical `PAGE-P1-PROFILE/ME`；FEAT-USR-006/PRD-ATOM-1052 仅部分；PRD 18.1 大范围未纳入；guest AUTH_ONLY |
| MB-029 听力旧入口 | 关闭告知 + 替代入口 | 共享 PAGE/R1-048/BC-043/IC-026 不是完整听力/音频验收 |
| MB-030 听力与 Clips | 同上 | 无 Clips/媒体素材验收 |
| MB-031 口语旧入口 | 关闭告知 + 替代入口 | 不伪造发音/录音/评分；原口语业务未完成 |
| MB-032 音标与跟读 | 关闭告知 + 替代入口 | 不提前请求麦克风；原音标/跟读未完成 |
| MB-033 写作 | 关闭告知 + 替代入口 | 无题/编辑/提交/批改链；原写作未完成 |

### 重要范围说明

- 六关闭页是“未开放的准确告知 + 真实可用替代入口”；原媒体/AI 业务**不因新 UI 算完成**。
- profile 是 Phase 1 账号/8 导航/会话退出壳；昵称/头像/统计缺契约，页面用「学」占位是正确不伪造，但不是完成。
- `PAGE-P1-ONB-GOAL`、`PAGE-P1-SETTINGS` 是父/邻接页面；不假定存在未注册的 `PAGE-P1-PROFILE`。
- 旧 `profile-batch-03` trace 的 B02 token/lease/browser 旧停点与个别 R1 未签推断不原样重贴；本报告采用 integration/B13 最新事实（profile 123/15 synthetic、`--yx-profile-*` token 已存在）。
- B13 599/599、39 图是 candidate synthetic 环境证据；`real API/native/iPad hardware/readers/deployment` 仍 **NOT_RUN**。不能用它替代业务/需求签收。

## C. 追溯/证据边界

- `TRACEABILITY.json` 每页含：source SHA、TASKS 行、CHECKPOINT 块、service/data owners、ACT/JNY/PAGE/RULE/INT/E2E、ARCH/R1/BC/IC、FEAT/PRD-ATOM/V2、实际操作/函数/路由/行号、UI 差量、source stable、GAP。
- `GAPS.json` 明确分类：
  - TRACE：canonical 页面/原子/页级卡缺失。
  - SCOPE：原始媒体/AI/PRD 18.1 超出当前 UI 边界。
  - EVIDENCE：guest AUTH_ONLY、real/native/hardware/readers 未验、A 的 44px 无浏览器租约。
- 不计算“总体完成率”，不以证据条数/599 checks 当需求通过。

## D. 停点

- A：44×44 源码与最小静态验证完成；浏览器尺寸 **NOT_RUN**，需后续租约复跑。
- B：七页可复核追溯已交付；正式文档注册/产品范围裁决仍由 Root 处理；七页保持 **TRACE_PENDING**。
- 未授权 API/guard/contracts 新写者；本包未开新业务、未改 integration/source、未提交推送。
