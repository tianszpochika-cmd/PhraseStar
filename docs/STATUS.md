# 项目状态总览

> 文档整理：2026-11-03；除下列官网候选外，其他 UI 和部署状态沿用 2026-10-30 的记录，本次未重新核验运行环境。本页是仓库**唯一的当前状态总览**；具名候选的签收不能直接证明后续提交或其他环境已通过验收。细节以下面链接的签收账与审查原件为准。

## 分支

- **主线分支：`dev`**（跟踪 `origin/dev`）。原 `dev-redesign` 已并入 `dev` 并删除。
- 官网 V1 在隔离分支 `codex/official-site-v1-20261103` 开发，产品源码候选为 `0b45356d117735fdeff58fa9a6f477b742191f99`；它的存在不表示已合并 `dev` 或已部署。
- 2026-11-03 刷新时，`origin/dev` 为 `0bafc67e`；与官网候选共同基线 `cb0b3d91` 之后各有 1 个远端提交和 10 个官网候选提交。官网产品文件与该远端提交无同路径改动；本次文档收口涉及双方均修改的 `CHANGELOG.md`、`docs/STATUS.md`，将来合并需保留两侧记录，未自动合并或变基。
- 历史证据、签收账与检查点里出现的 `dev-redesign` 是当时的分支名，保留原文。

## 官网 V1 候选（2026-11-03）

- 用户指定 11 月 2 日 Figma 定稿的 16 类页面、32 张桌面/手机主画板；确认“布局和素材 1:1，冲突文案统一为准确说明”。原文与调整见 [文案差异](06-design/v2-980plus/official-site-v1-20261103/COPY-DIFFERENCES.md)，不将准确说明称为逐字还原。
- C10 源码候选 `0b45356d` 的生产构建、类型检查、官网源码 53/53、64 组基础视口与两个真实 404 通过；本地视觉对照 32/32 主画板、20/20 UI MOCK 状态图通过，逐图继承与实际复看的范围见[独立审查](takeover/official-site-v1-20261103/REVIEW.md)。C8 的浏览器 15/15、延迟状态 52/52 单独归属 C8，见[追溯](06-design/v2-980plus/official-site-v1-20261103/TRACEABILITY.md)与 [QA](takeover/official-site-v1-20261103/QA.md)；整体业务与交付验收为 `PARTIAL`。
- 真实 Gateway/内容/商业/IAM 联调、真实移动或低配设备、实际屏幕阅读器、真实服务器 HTTP 500 和部署均未验；运行中帧率/内存压力逐级降档未接入。模拟与历史 R1 签收不能代替这些证据。

## R1（迭代 2 第二轮重设计）

| 项目 | 状态 | 依据 |
|---|---|---|
| R1 卡墙 | **完成**：R1-001…R1-115 共 115/115 张，IT-1…IT-7 全部签收（2026-10-11，基于合并提交 `7a6ac0a2`） | [CARD-LEDGER](takeover/CARD-LEDGER.md) §0.1、§6；[LUNA-SIGNOFF](takeover/LUNA-SIGNOFF.md) |
| 原 114 卡墙 | 已被 115 卡账取代，GAP-WALL-114 / RES-WALL-114 已 CLOSED（2026-10-11）；过期材料已从当前工作树清理 | [CARD-LEDGER](takeover/CARD-LEDGER.md) §0.1 |
| R1 计划 | [dev-plan-R1](06-design/v2-980plus/redesign/dev-plan-R1.md)（IT-1～IT-7） | — |

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

## 部署

- SJC 服务器 `173.249.208.210`，域名 `clyune.com`：`learn.clyune.com`（学员 Web）、`admin.clyune.com`（后台）、`mobile.clyune.com`（移动 H5）、`api.clyune.com`（网关）。运行版本 `4990dd29`（2026-10-13），落后 `origin/dev`（截至 2026-10-30 落后 132 个提交）。
- 旧德国服务器 `37.120.160.36` 与 `clyunedev.com` 域名已不是当前环境；其过期记录已从当前工作树清理。
- 编排资产仍在 `infra/docker/clyunedev/`（目录名沿用历史名称），操作步骤见[单机预发布手册](07-operations/clyunedev-single-host-pre-release-runbook.md)，域名与 IP 以本页为准。

## 文档入口

- 接手：本页 → [根交接](../CURRENT-HANDOFF.md) → [迭代 2 进度页](06-design/v2-980plus/redesign/CURRENT-PROGRESS.md) → [文档中心](README.md)。
- 旧交接和已取代的卡墙材料可通过 Git 历史追溯；签收账与证据仍在原位置。
