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

- `apps/official-site/public/figma-v1/assets-manifest.json` 记录素材节点、路径、尺寸及 SHA-256；字体来源、OFL 与子集覆盖见同目录字体清单。动态未覆盖中文使用同款完整字体，仍不存在的符号使用最终回退字体。
- 页脚主体文案来自用户指定的 Figma 定版；本次代码交付不等同公开上线或法律主体核验，也不补造备案号。
- 首页 FAQ 和信息/法律页的已知差异、原文、新文与依据见 [统一文案差异](COPY-DIFFERENCES.md) 及其链接的详细清单；用户尚未回复这些异步澄清，当前准确对外文案是监督采用的实施假设，不能声称用户逐条批准或逐字还原。32 张主画板原尺寸参考均已采集，其中协议页两端通过 Figma 既有 1x 配置导出；参考就绪不代表视觉验收通过。
- C1 的客户端注入 500 恢复及错误页 Token 问题已有代码修复，仍需在统一候选复测；此观察不声称真实服务发生了 HTTP 500。
- `meta.stale`、畸形内容集合与兼容包络价格覆盖已有定向源码回归；仍需统一候选复测，且真实 Gateway 回包、内容新鲜度及业务联调均为 `NOT_RUN`。
- C1 的 3 条过时源码断言已按当前组件分工重写，并保留价格/下载只读、成人注册和安全链接约束；独立生产产物与浏览器验收尚未完成。
- 当前文件尚未绑定最终候选提交、浏览器证据和独立 QA 结论。正式收口时按真实结果填写，分别记录设计视觉、响应式/交互、键盘与屏幕阅读器、API/业务链和部署，不以单项代替全站验收。
