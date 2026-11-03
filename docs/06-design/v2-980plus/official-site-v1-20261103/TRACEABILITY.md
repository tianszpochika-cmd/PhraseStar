# 官网 V1.0 设计与需求追溯

> 本文件是候选追溯记录，验收与部署状态以最终候选和独立 QA 证据为准。设计基线为用户指定的 2026-11-02 [Figma 定版页](https://www.figma.com/design/UdONc7ziqIJAiUDSQRyDG2/?node-id=168-73)及其 [交付索引](https://www.figma.com/design/UdONc7ziqIJAiUDSQRyDG2/?node-id=207-188)，不是旧 P1 视觉稿。隔离工作区基于 `origin/dev` 的 `cb0b3d91`。

## 路由与主画板

以下为交付索引实际指向的 16 类页面与 32 张桌面/手机主画板；列出节点不代表当前代码或验收已通过。帮助页采用索引指向的 `180:84` / `180:242`，不使用旧原型 `168:2418` / `168:2555`。

| 页面 | 路由 | Desktop | Mobile | 原 PAGE 追溯 |
| --- | --- | --- | --- | --- |
| 首页 | `/` | `168:74` | `168:409` | `PAGE-P1-OFFICIAL-HOME` |
| 课程体系 | `/courses` | `168:682` | `168:872` | `PAGE-P1-OFFICIAL-COURSES` |
| 课程详情 | `/courses/:id` | `168:1006` | `168:1139` | 设计子页，PAGE 精确绑定待确认 |
| 互动世界 | `/world` | `168:1223` | `168:1389` | 设计子页，PAGE 精确绑定待确认 |
| 学习方法 | `/method` | `168:1502` | `168:1637` | 设计子页，PAGE 精确绑定待确认 |
| 开始学习 | `/start` | `168:1723` | `168:1872` | 设计子页，PAGE 精确绑定待确认 |
| 会员权益 | `/pricing` | `168:1956` | `168:2091` | `PAGE-P1-OFFICIAL-PRICING` |
| 下载与设备 | `/download` | `168:2171` | `168:2311` | `PAGE-P1-OFFICIAL-DOWNLOAD` |
| 帮助中心 | `/help` | `180:84` | `180:242` | 设计子页，PAGE 精确绑定待确认 |
| 关于语学星 | `/about` | `168:2639` | `168:2757` | `PAGE-P1-OFFICIAL-ABOUT` |
| 产品公告 | `/announcements` | `168:2830` | `168:2930` | `PAGE-P1-OFFICIAL-ANNOUNCEMENTS` |
| 服务动态 | `/status` | `168:3008` | `168:3085` | `PAGE-P1-OFFICIAL-STATUS` |
| 隐私政策 | `/privacy` | `168:3140` | `168:3249` | `PAGE-P1-OFFICIAL-PRIVACY` |
| 用户协议 | `/terms` | `168:3317` | `168:3426` | `PAGE-P1-OFFICIAL-TERMS` |
| 年龄与使用资格 | `/minors` | `168:3494` | `168:3603` | `PAGE-P1-OFFICIAL-MINORS` |
| 合规公示 | `/compliance` | `168:3671` | `168:3786` | `PAGE-P1-OFFICIAL-COMPLIANCE` |

## 业务、契约和所有权

- 当前业务卡与交互边界：`R1-001` → `BC-001` → `IC-001`；官网公开内容须区分真实开放、仅预览、空目录与错误，且不伪造价格、支付、下载或学习资格。对应 [R1 计划](../redesign/dev-plan-R1.md)、[业务链](../redesign/business-chains.md)和[交互链](../redesign/interaction-chains.md)。
- 原追溯候选为 `FEAT-USR-003`、`PRD-ATOM-1044`、`V2-980-0361`、`ARCH-GW-001`、`ARCH-API-001`、`ACT-P1-VISITOR`、`JNY-P1-01`、`INT-P1-001`、`INT-P1-005`、`E2E-P1-PUBLIC-ENTRY`；上述 ID 及 11 个原官网 PAGE 的来源见 [R1-001 来源索引](../redesign/recovery-20261007/cards-29-index.json)。该索引明确是候选导航，不自动等于逐卡权威绑定或本候选签收。
- 原 R1-001 来源索引的 `RULE` 映射为空；认证、成人资格和公开内容安全边界仍适用，规则 ID 及上表新增设计子页的权威 PAGE 绑定尚待 owner 确认，不在此编造 ID。
- `official-site` 拥有公开展示和聚合适配；公开课程、公告、下载及合规投影由 `content-service` 拥有，商业价格目录由 `commerce-service` 拥有，外部路径经 Gateway。官网只构造到学习端的注册/登录链接，IAM 拥有真实认证与成人资格事实；官网不接收密码或保存业务 token。
- 公开接口以 `packages/contracts/openapi/v1/openapi.json` 中 `/api/v1/public/site/projection` 与 `/api/v1/public/commerce/catalog` 为契约追溯。针对当前实现与规范包络的兼容测试不能替代真实 Gateway 回包联调。

## 素材、验证和剩余项

- 产品源码候选为 C10 `0b45356d117735fdeff58fa9a6f477b742191f99`，基于独立分支；后续文档提交不改变已验产品源码。C10 生产构建、Nuxt typecheck 与官网源码测试 53/53 通过，构建前后源码哈希无变化；16 类路由×4 宽度的 64 组基础检查及两个真实 404 通过。
- C8 `fa6241e5e51727946a409ee14649158986301cd5` 的生产浏览器正式回归 15/15，受控重试延迟矩阵 52/52。C9 和 C10 随后只调整同一组件的手机样式与字体来源清单；逐版比对确认脚本、模板、依赖和字体字节不变。上述功能数字属于 C8，不能写成 C10 的实跑结果。
- C9 的手机层叠检查最初报告无正文影响，后续复核发现正文实心笔画受 ambient 过绘，原报告不能作为该项通过证据。C10 已按白卡、ambient、正文的原稿层序修正；两页 18 组手机层叠/菜单检查中，不透明正文笔画无光斑覆盖，正常抗锯齿边缘混合另列。
- C10 本地视觉复核覆盖 32/32 主画板与 20/20 受控状态图：与前版逐图校验 SHA，相同图继承已完成的眼查，变动图重新对照；逐图方法、索引哈希和实际查看范围见 [独立审查](../../../takeover/official-site-v1-20261103/REVIEW.md)。状态图为 UI MOCK，不是已发布内容事实；实际执行、证据路径和限制见 [QA 记录](../../../takeover/official-site-v1-20261103/QA.md)。本地视觉及具名受控检查通过，全产品业务与上线验收仍为 `PARTIAL`。
- Figma 交付素材 392 项的大小与 SHA-256 已核验；`apps/official-site/public/figma-v1/assets-manifest.json` 记录节点、路径及摘要，字体来源、OFL、77 项来源快照和子集覆盖见同目录清单。动态未覆盖中文使用同款完整字体，字体也不包含的符号使用系统回退。
- 首页 FAQ 和信息/法律页的原文、新文与依据见 [统一文案差异](COPY-DIFFERENCES.md) 及其详细清单。用户于 2026-11-03 确认“布局和素材 1:1，冲突文案统一为准确说明”，因此文本并非逐字还原。页脚主体名称取自用户指定的定稿；本次不等同法律主体核验，也不补造备案号。
- 内容 `meta.stale`、畸形集合、兼容包络和商业目录的失败关闭已由源码及受控上游测试覆盖；受控测试不能代替真实 Gateway 回包或业务联调。真实 Gateway、IAM 注册/成人资格和内容/商业服务运行均为 `NOT_RUN`。
- 按模拟设备能力初始分档、系统减少动效和已存画质恢复已覆盖；运行中 FPS/内存压力触发的逐级降档未接入，真实低配设备未验。真实移动/平板设备、实际屏幕阅读器、真实服务器 HTTP 500 与部署均为 `NOT_RUN`；客户端注入错误和键盘测试各有范围，不能代替这些验收。
