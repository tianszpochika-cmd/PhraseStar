# 唯一写者和集成边界

每个 CLI 仅在自身工作树落盘；主导人维护集成树与文档。修改共享文件前必须分配唯一写者；跨工作树无实时共享文件，请勿把另一个 worktree 的未审稿当作已存在接口。下面是初始分配，具体任务与状态以 [CHECKPOINT.json](CHECKPOINT.json) 更新为准。

| 区域 | 初始写者 | 边界 |
|---|---|---|
| `apps/mobile/src/components/**`、`src/theme/**`、`src/static/**`、`src/uni.scss`、`src/App.vue`、`src/pages.json`、`src/main.ts`、`src/manifest.json` | Grok | 共享壳/组件/素材/适配器唯一写者；需改共享接口时先公布签名、旧页影响和测试。不得仅为视觉改变路由或开放 Gate |
| `packages/design-tokens/**`、`packages/i18n/**`（本轮所需部分） | Grok | 与官网、Web 共享；基线已含官网新增 `official-site-v1` 导出及文案，必须保留；同时改 `package.json` 导出时核兼容 |
| `packages/i18n/src/mobile-resources/{closed,games,social}.ts` | DSH | Grok B03 模块与中央注册已冻结发布；接收树安全复制完成后由 DSH 独占增改该三个模块。中央 mobile-experience.ts 仍归 Grok，UI 不另建翻译器 |
| `packages/i18n/src/mobile-resources/profile.ts` | DSH-PROFILE | Grok B03 发布空注册模块，接收树安全复制后交 DSH-PROFILE 按本页实际 key 请求补齐；保持 profileCopy(en:boolean) 导出，不覆盖 mobile.settings 字符串或 mobile.pages.profile |
| `apps/mobile/src/static/figma-closed-{169-8610,168-6945,168-3746,168-4327,168-5501,168-6160}/**` | DSH | Root 在第二批明确授权的六个独占素材目录，优先于上表 static 的常规归属；仅复制对应 Figma manifest 的原素材并核 SHA，Grok 不写这些目录 |
| `apps/mobile/src/static/figma-games-{169-5279,169-5353,169-5475,169-5549,169-5637,169-5726,169-5811}/**` | DSH | 第四批小游戏七个状态的独占原素材目录；优先于 static 常规归属，禁止改动共享素材或以整页截图实现 UI |
| `apps/mobile/src/static/figma-social-<node>/**` | DSH | 第五批自习室/通知十四个已缓存节点的专属目录，精确 node 清单见 CHECKPOINT 的 dedicated_social_asset_ownership；不包含共享头像、B12 组件或其他资源 |
| `apps/mobile/src/static/figma-shared-nav-dark-270-3110/**` | DSH | 第七批仅允许从已缓存暗色参考中复制同一 Icons/chevL 的原始主题素材，用于已转交的通用页头；不得改 SVG 或随意替换图形 |
| `apps/mobile/src/components/MobileClosedPracticeNotice.vue` | DSH | Root 第三批分配的新共享关闭主体组件；此单文件优先于 components 常规归属，不包含另造通用页头或领域逻辑；其他共享组件仍由 Grok 维护 |
| `apps/mobile/src/components/MobilePageHeader.vue` | DSH | Grok B02 冻结发布后，由 Root 转交给 DSH 收口八页组合中的页头尺寸、原素材、文本放大及视觉问题；此文件优先于 components 常规归属。保持已发布 props 和默认导航行为，Grok 后续不写本文件 |
| `apps/mobile/src/pages/{login,register,reset-password,onboarding,forbidden,assessment,home,today,learn,practice}/**` | Grok | MB-001…010；定级 DEC-04 未定，不能自行确立新策略 |
| `apps/mobile/src/pages/{b4-games,b4-social,b4-offline,b3-listening,b11-listening,b3-speaking,b11-speaking,b3-writing}/**` | DSH | D1；只做页面与专属测试；复用已存在或经交接稳定的共享接口 |
| `apps/mobile/src/pages/{report-share,b5-commerce,b6-platform,support}/**` | DSH | D2；状态/持久化/权限事实必须沿用契约与真实 owner，不因设计开放 |
| `apps/mobile/src/pages/profile/profile.vue`、`apps/mobile/tests/profile-page.test.mjs`、`src/static/figma-profile-{169-9356,169-9446,169-9544,169-9707,248-4123}/**` | DSH-PROFILE | 同一 DSH CLI/provider 的独立任务与工作树；主 DSH 会话不再写此页。已从 Grok 冻结包预载三个共享文件，不能在本任务中修改；实际会话与进程见 CHECKPOINT |
| MB-011…016/018/021 页面 | 暂不分配 | 由 Root 根据负载、依赖和额度转交前指定单一 owner，并更新本账 |
| `apps/mobile/src/{api,auth,domain,platform,stores}/**`；`packages/contracts/**`、服务与迁移 | 暂无授权写者 | 本轮先只读；发现必需改动提交具体文件和原因给 Root，按 contract-first/owner 指定唯一写者；不能让两个 CLI 随意改同一工具 |
| `apps/mobile/tests/**` | 按具体文件单写者 | 只创建/修改本人页面明确独占的测试；共用测试由 Root 指派唯一执行者。不得通过改断言、跳测或覆写证据制造通过 |
| `docs/takeover/mobile-figma-20261103/**`、`docs/STATUS.md`、`CURRENT-HANDOFF.md`、`CHANGELOG.md` 与集成分支 | Root | 单一集成人按已批准事实维护；保留官网/Figma Web 记录；候选先审再合入 |
| 官网和 Web Figma 工作树及对应产品区域 | 原任务所有者 | 本轮不修改、不重启进程、不重复启动作者 |

每个交付包带基线、精确路径、diff、已知组件接口、测试命令与输出、受控/真实环境、未执行事项和保留问题；增改公共部分交由对应 owner 处理，不能复制第二套公共组件规避冲突。某方周额度耗尽后，若另一方确有任务可继续，先记录停点、确认无活动写者与未保存变更、明示移交并更新所有权，再继续；未知不可视作耗尽。

## 18183 运行租约

启动前检查 `config/local-ports.json`、单 H5 可用 `node scripts/check-fixed-ports.mjs --service mobile-h5-dev`（启动全栈须按规则执行 `pnpm ports:check`）和 18183 实际监听 PID、命令、工作树及占有者。账本初始为 `UNVERIFIED`，不是端口空闲声明。同一时刻仅一个本轮 owner 持有 `127.0.0.1:18183`；记录 PID、工作树、源版本、起止时间，运行者完成测试后自行释放并核验，另一方才能接手。端口被其他任务占用时报告并协调；不得擅自终止、复用、随机改端口、重复启动或重放。Root 报告既有基础设施 BUSY；独立 H5 按本服务核查，不为此停止其他基础设施。持租者做 H5/浏览器验证时，另一方可以静态检查和编辑自己独占文件。

## 有序整合

执行模型仅限 Grok 与 DSH。Codex 子代理已按用户后续指令停止，不再续接或创建；原监督文档中的 Root QA 是审核角色，不是获准调用的额外模型。iPad 布局实现仍由共享与页面唯一作者承担，Root QA 单列验证，不能用视口检查代替布局实施。

1. 确认实际分支、源提交、活动写者和未提交文件；不读旧快照推断当前状态。根工作树 dev 和其他已有工作树不动。
2. 作者交单页或独立基础能力候选；Root 审代码/权限/范围和真实测试结果，确认基线/冲突后正常合入集成树。共享变动先审后让另一方基于明确的共享接口继续；对最终组合重跑受影响检查。
3. `git diff --check`、需要的针对性测试、类型/H5 构建及浏览器结果分别记录，不将失败改写成通过；Root 才能做本轮合格差量的正常提交/推送（用户已授权）。未经审查的候选只留单独 checkpoint，不进入已签收源码；不 force、不 reset、不改凭据。
4. 所有证据标注 commit/tree hash、环境、时间、页面/状态、fixture 或真实数据、操作者和结果。源码整合、远端推送、实际部署、实服与设备验收各记独立状态。

## MB-024 transfer 2026-11-04

DSH_PROFILE is now the sole author for apps/mobile/src/pages/settings/settings.vue and its dedicated settings-page tests/assets/resource module. Main DSH no longer writes settings. First preparation task is read-only; implementation starts after immutable registry publication is copied by Root. Central mobile-experience.ts and design tokens remain Grok owned.

## MB-025 transfer 2026-11-04

DSH_DEVICES is the sole author of devices.vue, devices-page.test.mjs, mobile-resources/devices-page.ts and dedicated figma-devices assets. Its isolated worktree is based on 3a91f6ec, with a distinct DSH CLI session; main DSH no longer writes devices. Shared mobile-settings-devices tests and all API/domain/auth/store/contracts remain read-only. Browser lease is pending.

## Support adapter exception - batch15

Main DSH alone may update apps/mobile/src/api/support.ts for existing formal GET list/detail contract adaptation and validated legacy IT7 compatibility. readMobileClosureBoard public behavior must stay compatible for settings. No create/message/upload/auth/server/contract writes. Dedicated support-page resources/assets/tests belong to main DSH.
