# 语学星官方网站

官网使用 Vue 3、TypeScript 与 Nuxt SSR，按用户指定的 2026-11-02 Figma 定稿实施。交付索引覆盖 16 类页面的 32 张桌面/手机主画板；课程详情复用动态路由，现有 sitemap 列出 21 个公开地址。设计节点、资产、需求映射及候选边界见 [官网 V1 追溯](../../docs/06-design/v2-980plus/official-site-v1-20261103/TRACEABILITY.md)。设计对稿与发布验收分开记录。

## 本地启动和验证

在仓库根目录运行：

```sh
pnpm --filter @englishflow/official-site dev
pnpm --filter @englishflow/official-site build
pnpm --filter @englishflow/official-site exec nuxi typecheck
pnpm --filter @englishflow/official-site test:website
```

官网默认绑定 `http://127.0.0.1:18182/`；端口冲突时退出，不自动换端口。完整后端不是浏览和使用官网本地示例的前提；公开投影不可用时显示对应状态，不将示例当成真实业务数据。

R1 的 11 个原始公开地址及注册跳转还可使用下面的运行时检查。它只访问**已在固定端口运行的受控站点**，其中空目录文案断言要求提供受控空投影；不会启动或停止服务，也不能代替真实 Gateway / IAM 联调。

```sh
pnpm --filter @englishflow/official-site exec node --import ../../scripts/dev/register-typescript.mjs --test tests/r1-001.test.mjs
```

## 公开页面与边界

| 路由 | 内容 |
| --- | --- |
| `/` | 首页、无需登录的练习示例和 FAQ |
| `/courses`、`/courses/:id` | 六个学习方向介绍，以及来自公开投影的已发布课程；未知方向返回 404，方向介绍不是课程详情 API |
| `/world`、`/method` | 本地互动预览和学习方式介绍 |
| `/start` | 学习端注册/登录入口与公开示例 |
| `/pricing`、`/download` | 独立公开信息页；按服务端发布状态只读展示价格或渠道说明，不创建订单、支付或安装包动作 |
| `/help`、`/about`、`/announcements`、`/status` | 帮助、产品说明、公开公告和服务动态说明 |
| `/privacy`、`/terms`、`/minors`、`/compliance` | 公开说明、成人资格和合规公示 |
| `/robots.txt`、`/sitemap.xml` | 抓取规则及公开地址 |

官网只面向 18 岁以上成人与大学生；注册后仍需学习端服务端成人资格校验，通过前不开放学习能力。官网不接收密码、不保存业务 Token；注册和登录仅构造受控学习端链接。互动示例在本地运行，不保存正式学习记录。

公开内容与合规信息由 content-service 拥有，商业目录由 commerce-service 拥有，外部访问经 Gateway；官网 BFF 仅做公开读取、状态归一化和字段过滤。空、错误、权限、维护、恢复与独立价格状态分别处理。真实上游回包和端到端业务是否可用，必须另行联调，不由本地模拟测试推断。

## 配置

| 环境变量 | 默认值 / 用途 |
| --- | --- |
| `NUXT_PUBLIC_SITE_URL` | `http://127.0.0.1:18182`，canonical 与换设备地址 |
| `NUXT_PUBLIC_LEARNER_WEB_URL` | `http://127.0.0.1:18180`，学习 Web 入口 |
| `NUXT_PUBLIC_MOBILE_H5_URL` | `http://127.0.0.1:18183`，手机学习入口 |
| `NUXT_PUBLIC_GATEWAY_BASE_URL` | `http://127.0.0.1:18070/api/v1`，公开 Gateway 地址 |
| `NUXT_GATEWAY_INTERNAL_BASE_URL` | 服务端可选的内部 Gateway 地址，不输出到客户端 |
| `NUXT_PUBLIC_PROJECTION_PATH` | `/public/site/projection` |
| `NUXT_PUBLIC_LINK_ORIGINS` | 额外允许的公开链接来源，逗号分隔 |

公开链接与回跳按来源、路径和参数白名单处理；上游读取超时为 2.5 秒。公司名称遵循用户确认的设计稿；备案和完整法律文件仍以核实后的正式公示为准，不虚构编号。

## 共享基础与设计素材

- 官网专用语义 Token 位于 `packages/design-tokens/src/official-site-v1.ts`，支持浅色、深色、跟随系统及高对比；保留原共享 Token 对其他三端的效果。
- 文案通过 `packages/i18n` 聚合；当前完整 UI 为中文，English 为不完整预览并回退中文，UI locale 与学习内容语言分开。少量准确说明与原设计文案的差异和用户确认口径见 [文案差异](../../docs/06-design/v2-980plus/official-site-v1-20261103/COPY-DIFFERENCES.md)。
- `public/figma-v1/` 保存定稿素材、来源与哈希清单，以及含许可文件的字体。静态字形优先使用子集，未覆盖中文按需回退同款完整字体；是否请求完整字体须以实际网络验证为准。
- `@englishflow/performance` 保留 Ultra / High / Medium / Performance 四级与设备降级；动效同时遵循系统减少动态效果偏好。
