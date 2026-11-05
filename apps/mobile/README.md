# @englishflow/mobile (语学星统一 uni-app 学习端)

## 项目定位
- 采用 **Vue 3 + TypeScript + uni-app** 构建。
- **一套核心代码**编译输出至 **移动 H5、iOS App、Android App、iPad**；微信小程序作为 P1.5 条件编译目标。
- 本项目是移动 H5、移动 App 与 iPad 的唯一学习端业务项目；PC Web 学习工作台归属 `apps/learner-web`。
- Phase 1 使用平台自有 IAM 账号密码和规则化学习闭环，不启用生成式 AI；支付仅保留 provider、验签、退款与对账沙盒，生产支付和自动续费默认关闭，须通过发布 Gate 后才能开启。
- 支持移动端特有原生能力：原生后台音频播放与锁屏控制、离线数据包缓存，以及小程序条件编译适配。

## 目录结构
- `src/pages/`: 移动端核心页面（首页打卡、规则化学习流、个人中心）
- `src/uni_modules/`: uni-app 跨端插件（原生播放器、支付 provider/沙盒适配、离线存储）
- `src/stores/`: 移动端本地持久化与学习状态

## 自有 JWT 认证边界

- uni-app 的账号密码登录、会话恢复、刷新、登出、设备撤销和成人 Gate 统一经 Gateway/IAM 适配器；不存在浏览器认证回调。
- Access Token 只保存在进程内存；iOS/Android/iPad 原生端的 Refresh Token 只能写入 Keychain/Keystore 等平台安全存储，安全存储不可用或写入失败时拒绝建立可刷新会话，不降级到普通 storage。
- H5 通过 HttpOnly、Secure、SameSite Refresh Cookie 恢复会话；H5 不读取或持久化 Refresh Token。
- JWKS、issuer、audience、RS256、token type 和权限声明由 IAM 签发、Gateway 与每个领域服务独立验证；真机/小程序仍需按设备矩阵取得运行证据。
- `android/` 和 `ios/` 为原生工程预留目录。原生包与设备验收另行记录。

## B0 本地验证
- H5 固定端口：`18183`；启动前执行根目录 `pnpm ports:check`。
- H5 开发：`pnpm --filter @englishflow/mobile dev:h5`；构建：`pnpm --filter @englishflow/mobile build:h5`。
- TypeScript 检查：`pnpm exec tsc --noEmit -p apps/mobile/tsconfig.json`。
- 移动端源码测试可用 `node scripts/dev/run-node-tests.mjs apps/mobile/tests` 运行。
- DCloud 版本以本项目 `package.json` 与仓库锁文件为准；`src/compat/vue.ts` 兼容运行时导出差异，H5 的 `src/compat/page-lifecycle.ts` 补齐官方页面初始化调用，保证 `onLoad` 参数和 `onShow` 数据加载执行。业务页面接入前不得移除兼容层。

## 官网风格移动端 UI（2026-09-22，历史基线）

2026-09-22 的移动端 UI 统一交付覆盖当时注册的 31 个页面和 5 个屏幕/主题组合，结果与截图归档在 `artifacts/mobile-experience-2026-09-22/`。该 31 页 × 5 矩阵、旧阅读交互和对应结论只属于那次历史交付；当前入口不再复现，也不以它代表当前提交或完整业务验收。历史记录见 [移动端改造记录](../../docs/06-design/v2-980plus/mobile-experience-2026-09-22/README.md)。

## 当前 H5 体验入口（mobile-experience.e2e.mjs）

`apps/mobile/tests/mobile-experience.e2e.mjs` 是当前 H5 的可运行入口，以构建产物为运行对象、读取 `src/pages.json` 的路由清单，不启动服务器、监听端口或访问真实网络：

- 匿名阶段读取 `src/pages.json` 的官方 33 条路由：公开页必须停留在原路由；受保护页必须回到登录并保留精确 `returnTo`。要求零私密请求、零意外请求、零页面异常。
- 合成登录后的封闭练习阶段覆盖 `b11-listening`、`b11-speaking`、`b3-writing`，在 light/390、dark/390、high-contrast/320 三个代表性主题/视口组合下校验实际封闭文案、两个真实替代入口，以及键盘可操作的“回到可用学习”精确跳转 `#/pages/today/today`；不触发播放、录音、麦克风权限或业务写入。
- 所有页面资源和合成 IAM/Gateway 响应均由 Playwright `route.fulfill` 离线提供；`result.json` 默认写入 `os.tmpdir()` 下每次运行唯一的目录，可用 `MOBILE_E2E_OUTPUT` 指定。

前置条件与命令：

```bash
pnpm --filter @englishflow/mobile build:h5
node apps/mobile/tests/mobile-experience.e2e.mjs

# 可选：使用已有的绝对路径 H5 产物（不启动服务）
MOBILE_E2E_ARTIFACT=/absolute/path/to/h5 node apps/mobile/tests/mobile-experience.e2e.mjs
```

默认产物目录为 `apps/mobile/dist/build/h5`；未构建且未设置 `MOBILE_E2E_ARTIFACT` 时入口会直接报错，不会回退到开发服务器。Playwright 通过仓库 workspace 依赖解析，无需全局安装。

登录、注册、找回密码与逐页交互仍由独立套件承担，不在本入口范围内：`tests/ui-login.e2e.cjs`、`tests/ui-register.e2e.cjs`、`tests/ui-reset.e2e.cjs`，以及 `tests/ui-home.e2e.cjs`、`tests/ui-today.e2e.cjs`、`tests/ui-vocabulary.e2e.cjs`、`tests/ui-grammar.e2e.cjs`、`tests/ui-onboarding.e2e.cjs`、`tests/ui-forbidden.e2e.cjs` 等详细 UI 套件。封闭页结构还有 `tests/b11-listening-closed.test.mjs`、`tests/b11-speaking-closed.test.mjs`、`tests/b3-writing.test.mjs` 和 `tests/mobile-closed-practice-notice.test.mjs` 的静态/单元覆盖。

## B10-FE-005 / B10-FE-006 移动端切片

- `src/api/b10.ts` 只使用 Gateway 相对路径，分别接入 content、learning 和 assessment seam；UI `locale` 通过 `Accept-Language` 传递，内容语言只通过 `contentLocale` 查询参数传递。
- `src/stores/b10-learning.ts` 持有 SRS 排程、复习待同步队列、练习会话、断点、错题和报告的本地恢复状态；同一卡片不会因重复点击重复推进，待同步不冒充已结算。
- `b2-vocabulary`、`b2-practice`、`b3-reading`、`b3-grammar`、`b3-writing` 已切换到 B10 API seam；`b10-report` 提供错题原因、订正入口和报告证据。
- `B10ExerciseCard` 只提交受支持的用户答案结构，不发送 `correctAnswer`、答案标志或客户端分数；规则反馈显式标注 Phase 1 不使用 AI 评分。
- 所有页面覆盖 loading/empty/error/offline/forbidden/stale/recovery 入口；Performance 档保留答题功能并将句法图降级为线性结构。主题切换与内容语言切换通过 app 内 B10 foundation 适配，不新增 miniapp 业务项目。

验证：

```powershell
pnpm --dir apps/mobile test:b10
pnpm --dir apps/mobile exec tsc --noEmit -p tsconfig.json
pnpm --dir apps/mobile build:h5
```

## B11 FE-003 / FE-004 / FE-006 mobile slice

- `src/pages/b11-listening/b11-listening.vue` covers authorized playback, speed, A-B loop, Language Clips, subtitle timeline, dictation and server-confirmed progress.
- `src/pages/b11-reading/b11-reading.vue` covers version-bound graded reading, block progress, comprehension synchronization and offline recovery.
- `src/pages/b11-speaking/b11-speaking.vue` covers explicit microphone permission, phonetics, shadowing, local playback/retake, SHA-256 lifecycle and self-rating. Phase 1 does not use ASR, AI scoring or a digital human.
- `src/platform/b11-offline.ts` deduplicates by `clientEventId`, preserves a cursor, records version conflicts, protects local storage limits and never persists forbidden media payload fields.
- `src/stores/b11-learning.ts` wires the four performance levels, manual motion disable and network/storage downgrade. Local recording state only contains an opaque secure path plus hash/metadata; server mutations send metadata, never recording bytes.

Validation:

```powershell
pnpm --dir apps/mobile test:b11
pnpm --dir apps/mobile exec tsc --noEmit -p tsconfig.json
pnpm --dir apps/mobile build:h5
```

## 三端统一交付

本次源码、共享资源与验证记录纳入 [2026-09-22 三端 UI 统一交付](../../docs/06-design/v2-980plus/frontend-ui-delivery-2026-09-22.md)。该记录说明提交范围、本地入口及尚未完成的真实后端/真机验收。
