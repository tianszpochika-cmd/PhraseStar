# 官网 V1.0 验收记录

产品候选：`0b45356d117735fdeff58fa9a6f477b742191f99`。本记录区分最终候选的实际运行结果、前序候选且源码未变的证据，以及未运行的真实服务和设备验收。设计逐板复核见[独立审查](REVIEW.md)。

## 范围与方法

- 实施工作树：`/Users/Admin/.codex/worktrees/official-site-v1-20261103/cloudstudy`；基线 `cb0b3d917d0de46a28ae0479b9a33bce52c95884`。最终产品候选先构建并封存，文档收口可以位于其后的提交。
- 正式设计依据为 Figma `UdONc7ziqIJAiUDSQRyDG2` 的 09 页 `168:73` 与交付索引 `207:188`；32 张桌面和手机原尺寸主板及 SHA 在本次只读设计缓存 `figma/STATUS.json`。
- 以 Playwright 1.63 / Chromium 153 的独立 context、DPR 1 进行精确视口和交互检查。默认图在字体就绪、指针归位、清焦点、置顶后采集；焦点态另存。IAB 的视口和缩放曾不可靠，不能以其截图代替精确尺寸证据。
- 所有原始截图、数据夹具、脚本和日志留在本机 `/Users/Admin/.codex/visualizations/2026/11/03/01a1a024-846c-77a3-ac2c-db9c65f2c882/official-site-implementation-20261103/qa/`，不将大量临时证据提交仓库。`c10/` 是最终候选，`c8/`、`c6/` 是下文具名的前序候选。

## 最终候选实测

- 生产 build、Nuxt typecheck 和官网源码测试 **53/53** 通过。构建前后被追踪源码哈希变化为 0；封存生产产物 697 个文件在浏览器测试前后哈希一致，见 `c10-fingerprint-after.log` 和 `c10/output-post-test-integrity.json`。
- 官网 16 类路由在 320、390、768、1440 宽共 **64** 个基础视口通过；未知地址与未知课程直达均为真实 HTTP 404。采样覆盖横向溢出、页面错误、缺图和主要内容，详见 `c10/route-sweep.json`。真实 HTTP 500 未验证。
- 同一封存产物的 32 张 390/1440 默认图见 `c10/screenshots-manifest.json`；课程、会员、下载、公告和合规的 20 张 empty/ready 图见 `c10/visual-fixtures.json` 与 `c10/fixture-inputs.sha256`。后者是浏览器拦截的 **UI MOCK**，不是已发布课程、价格、渠道或公示事实。默认图对应未启动 Gateway 的真实降级界面。
- 会员和下载页在 320/390/768 × 亮色、暗色、高对比的 18 组，验证装饰层顺序、图标可见、菜单点击/Escape 与焦点归还。按浏览器 computed 前景色识别的标题和说明**不透明笔画**受背景光斑影响均为 0；抗锯齿边缘随背景自然合成另列，未作为实心笔画遮挡。原图白卡取色误差不超过 1 个 RGB 数值；`c10/catalog-hero-layers.json` 留存逐项数据。两页 1440 图与 C8 逐像素一致，见 `c10/desktop-comparison.json`。
- 未注入公开投影且 Gateway 未启动时，官网显示读取失败和重试，而非将故障描述成真实空目录，见 `c10/no-gateway.json`。本代理启动的 18182 官网进程在检查后已停止。

## 具名的前序功能证据

C8 之后的层叠修改限于 CatalogView 手机 scoped CSS 和字体来源清单；C8→C9→最终候选的非样式代码比较见 `c9/source-diff.json`、`c10/source-diff.json`。公开投影、动效、SEO 等关键源码在 C6 至最终候选各次比较的 SHA 见 `c6/source-subsystem-hashes.json` 与 `c7/` 至 `c10/` 的 `source-diff.json`；C7→C8 的 CatalogView 焦点逻辑和浏览器测试有明确变更。以下结果是在各自写明的候选上运行，**不称作最终候选重跑**：

- **C8 `fa6241e5e51727946a409ee14649158986301cd5`**：生产 build/typecheck、源码 53/53；隔离空上游的 R1 原始测试 4/4。正式浏览器回归 `apps/official-site/tests/browser/official-v1-regression.cjs` 为 **15/15**，其中新增 8 项对会员/下载页 Enter 重试、实际请求、具名卡可见焦点、继续 Tab 以及用户在延迟响应期间移焦后不被抢回进行检查（`c8/regression.log`）。扩展延迟响应矩阵 **52/52** 覆盖四种宽度、390 三主题、重试后 empty/ready/error/recovery 与用户主动移焦（`c8/catalog-keyboard-retry.json`）。
- C8 受影响四页在四个宽度和三主题的 **168** 组检查覆盖按钮/焦点、长文 ready、empty、error、permission、maintenance、recovery 及故障携带旧数据；另有公开投影 48 组、loading/retry 6 组和公告/合规恢复空数组 6 组（`c8/changed-pages-regression-*.json`、`projection-states.json`、`loading-retry.json`、`info-recovery-empty.json`）。这些均为受控 UI 响应。
- C8 高对比检查了 16 类路由在 390/1440 下根节点无意外边框，首页/帮助/方法目标边框和同一 context 的方法→帮助→首页切换保持有效，见 `c8/high-contrast-scoping.json`。这不代替逐页真实辅助技术验收。
- C8 重试到 empty/error/recovery 时的状态节点保留 live region；**ready 非空**时状态组件被数据列表替代，主卡内 live region 数为 0。只验证了 DOM 和焦点，未实测屏幕阅读器播报，不声称 ready 已被播报。
- C7/C6 的重试对照中，按钮消失后焦点落在 BODY。先前曾将移动宽度下一个同名品牌链接误称为页头；补测其祖先后确认它在**页脚**，桌面则到相邻链接。C8 修复将焦点保留在具名主卡，证据为 `c7/catalog-keyboard-retry-location.log` 与 `c8/catalog-keyboard-retry.json`。
- **C6 `21f92df3956021d74efd0b6b2f5881fa09a10b45`**：模拟原始上游 11/11，覆盖合法空目录、坏商品、禁止组合、混合数据及畸形包络的 fail-closed/no-store；无关内容仍可读。两套测试运行地址各核验 21 个 sitemap 地址、SSR canonical/description 和 robots 一致，测试地址不是部署地址；21 项为 15 个固定地址和 6 个已定义学习方向，不虚构动态课程。见 `c6/upstream-raw-regression.json`、`runtime-seo-one.json`、`runtime-seo-two.json`。
- C6 另在四种宽度检查课程筛选/搜索/详情、方法拼词及错误/正确/撤回/重置、互动世界标签和本地练习；设备复制成功/拒绝为浏览器模拟。语言 cookie、同页切换、迟到响应和跨页重入共 4 项，偏好持久化、移动菜单及菜单到设置的焦点检查通过。实际点击路径从官网 CTA 到 `/start`，再拦截学习端注册链接以核对目标和参数，未注册账号。证据为 `c6/core-experience.json`、`locale-state.json`、`navigation-preferences.json`、`menu-focus.json`、`start-flow.json`。
- C6 静态路由字体网络 32 组和动态字形 7 组通过：普通内容不触发完整 Noto，测试字符 `龘` 按需回退；模拟低配置、系统减少动效和已存偏好恢复 4/4。对应 `c6/font-sweep.json`、`font-glyph-regression.json`、`motion-performance.json`。官网未接入运行时 FPS/内存压力逐级降档，不将该能力列为通过。
- IAB 对 C6 暗色首页试学完成与焦点归还、C7 暗色帮助页首问展开做过抽查；记录 `c6/iab-review.md`、`c7/iab-review.md`。这不是最终候选逐页 IAB 或实体设备验收。

## 复现入口

在工作树根目录串行执行 `pnpm --filter @englishflow/official-site build`、`pnpm --filter @englishflow/official-site exec nuxi typecheck` 和 `pnpm --filter @englishflow/official-site test:website`。启动官网前先检查 18182 归属，使用 `node scripts/run-fixed-port.mjs official-site-dev -- node apps/official-site/.output/server/index.mjs`，只停止自己启动的进程。

官网运行后，可用 `node apps/official-site/tests/browser/official-v1-regression.cjs` 执行正式浏览器回归。R1 的 `pnpm --filter @englishflow/official-site exec node --import ../../scripts/dev/register-typescript.mjs --test tests/r1-001.test.mjs` 中空目录断言需要受控空上游；本次由 `qa/r1-empty-upstream.cjs` 在官网进程内拦截测试请求，并未监听或启动真实 Gateway。未提供该夹具时，不得把无 Gateway 的 error 冒充 empty。

## 未运行与交付边界

- Gateway、IAM、领域服务和数据库未启动；真实注册完成、授权/撤销、订单支付、学习记录与跨端同步均为 **NOT_RUN**。注册深链仅在受控浏览器中检查目标和参数，不能视为业务全链通过。
- 实体手机/平板、真实低配硬件、真实屏幕阅读器、生产部署和真实 HTTP 500 均为 **NOT_RUN**。页面和代码中的示例学习数字不是真实记录；按既定设计未增加可见标签，但有无障碍说明。
- Figma 中与当前能力冲突的文案按已确认的准确说明处理，允许真实状态和长文自然增高；设计示例不能替代公开事实。视觉差异的逐板结论与仍需处理项以[独立审查](REVIEW.md)为准。
