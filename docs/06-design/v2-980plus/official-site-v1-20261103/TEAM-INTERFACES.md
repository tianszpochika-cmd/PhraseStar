# 官网 V1.0 协作接口

设计基线：Figma 文件 `UdONc7ziqIJAiUDSQRyDG2`，页面 `168:73` 的 2026-11-02 定版，交付索引 `207:188`。本工作区基于 `origin/dev` 的 `cb0b3d91`；历史 P1 稿不作为本次视觉依据。

## 文件归属

| 负责人 | 独占范围 |
| --- | --- |
| 公共基础与集成 | `app.vue`、`nuxt.config.ts`、`layouts/`、公共 Header/Footer/Brand/Icon/Modal/StartButton/PageHeading/PublicStatus、公共 CSS 和 Token、i18n 聚合、公开投影 composable、SEO、Git 写入 |
| 首页 | `pages/index.vue`、`components/v1/home/`、`packages/i18n/src/official-site-v1/home.ts` |
| 课程与方法 | `pages/courses/`、`pages/method.vue`、`components/v1/core/`、`packages/i18n/src/official-site-v1/core.ts` |
| 产品体验 | `pages/world.vue`、`pages/start.vue`、`pages/pricing.vue`、`pages/download.vue`、`components/v1/experience/`、`packages/i18n/src/official-site-v1/experience.ts` |
| 信息页 | `pages/help.vue`、`about.vue`、`announcements.vue`、`status.vue`、`privacy.vue`、`terms.vue`、`minors.vue`、`compliance.vue`、`error.vue`、`components/v1/info/`、`packages/i18n/src/official-site-v1/info.ts` |
| 素材 | `apps/official-site/public/figma-v1/` 及来源、字体授权清单 |
| QA | 新增测试与验收文档的独立路径；构建、类型检查和官网运行由 QA 统一协调 |

页面私有样式放在 `scoped` 样式或使用 `v1-<group>-` 前缀；公共文件有需求时交公共负责人修改。仅公共负责人执行 Git 写操作。不要修改原工作区、已有 stash、未知进程或共享基础设施。

## 公共接口

- 文案由各组独立导出中文词典：`officialSiteV1Home`、`officialSiteV1Core`、`officialSiteV1Experience`、`officialSiteV1Info`；对象支持嵌套。页面使用 `useSiteText().t('official.v1.home.key')` 等，公共入口统一聚合并保留原键和共享 fallback。
- 官网语义变量：`--v1-bg`、`--v1-surface`、`--v1-text`、`--v1-muted`、`--v1-border`、`--v1-brand`、`--v1-brand-strong`、`--v1-brand-soft`、`--v1-on-brand`、`--v1-focus`、`--v1-font-sans`、`--v1-font-display`。不得直接改变其他端引用的旧色板值。
- 公共内容使用 `usePublicProjection(scope)`；`loadState` 保留完整结果，`computed(() => getFacet('courses'))` 等读取独立状态，`load()` 触发重试。`PublicStatus` 保留 `state`、`title`、`message`、`actionLabel`、`actionHref` 和 `retry` 接口。
- 课程 `/courses`，学习方法 `/method`，世界 `/world`，会员 `/pricing`，下载 `/download`，帮助 `/help`，开始 `/start`；注册和登录使用 `useOfficialSiteLinks().registerLink()`、`authLink()`。页面不接收密码、不保存业务 token。
- 新素材只从 `public/figma-v1/` 引用；不要把临时 Figma URL 放进产品代码。设计中的示例数据、价格和权限不可冒充已发布事实。R1-001 / BC-001 / IC-001 的公开、成人与真实空态边界仍有效。
- 页脚主体文案采用用户指定的 11 月 2 日 Figma 定版原文；不填设计中未给出的备案编号或认证结论。代码交付不等同于公开上线或法律主体核验。
