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
- `PENDING`：首页 FAQ 与帮助页少量文案、年龄资格补充文案及协议页“完整条款”表述的最终口径正在与用户确认；协议页两端原尺寸视觉参考仍待补全。候选可供其余范围验证，不将这些项目标记为已签收。
- `PENDING`：QA 以客户端注入方式模拟 500 后，回首页触发已释放主题控制器错误；硬刷错误页时公共主题 Token 注入也待修复和复测。此观察不声称真实服务发生了 HTTP 500。
- `PENDING`：公开投影契约包络中的 `meta.stale` 尚未合入陈旧状态归一化；畸形 `downloads` 等上游集合也可能被归一为空，需区分失败与真实空态。不能将本候选的模拟测试当作真实内容新鲜度证明。
- C1 前本地官网源码测试为 40/43：3 条旧源码文本断言与新版目录组件、语言订阅位置及定稿登录/菜单入口不一致，待按现行行为和成人/只读边界修订后重跑；独立浏览器及生产产物验收尚未完成。
- 当前文件尚未绑定最终候选提交、浏览器证据和独立 QA 结论。正式收口时按真实结果填写，分别记录设计视觉、响应式/交互、键盘与屏幕阅读器、API/业务链和部署，不以单项代替全站验收。
