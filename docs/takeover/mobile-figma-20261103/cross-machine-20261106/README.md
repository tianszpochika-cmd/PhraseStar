# CloudStudy 跨电脑交接清单（2026-11-06）

从 `dev` 继续移动端改造。该分支包含已审核的源码、验收回执与当前停点。历史证据基线为 `230d19ec`（B146）。移动端 33 条路由都有本地 UI 候选，33 条仍待逐页签收。项目暂停状态与剩余验收见 [暂停交接](../PAUSE-20261106.md)。

标签 `archive/cloudstudy-20261106` 指向归档提交 `580c17d1`，保存全部工作树快照。核对 70 个注册工作树，61 个带改动的工作树已分别封存，共 334 条已跟踪文件改动与 1193 条未跟踪文件记录。同一文件在不同工作树的版本分别保留。快照使用各工作树的原始基线和完整文件内容，原工作树及 Git 暂存区保留。各份快照都待复核。

## 在另一台电脑接手

在已克隆的仓库中更新 `dev`。需要恢复候选时，按下列命令取回归档标签。

```bash
git fetch origin
git switch dev
git merge --ff-only origin/dev
git fetch origin tag archive/cloudstudy-20261106
```

先检查现有工作树和未提交文件。首次接手可用 `git switch --track origin/dev` 建立跟踪分支。先读续作分支的 `CURRENT-HANDOFF.md`，由接手人明确恢复后核对 Grok 作业、固定端口和唯一写者。冻结的探针需要重新绑定本机路径和隔离环境。

以下表格与 [机器清单](https://github.com/tianszpochika-cmd/PhraseStar/blob/580c17d1412beb9131ecd0e0899b724b9ec77b67/docs/takeover/mobile-figma-20261103/cross-machine-20261106/MANIFEST.json) 给出候选的基线、提交和文件指纹。以第一个候选为例，下面两条命令分别比较改动和建立复核目录。

```bash
git diff 9b6491774098 1df4a31862fc
git worktree add -b codex/recover-mobile-assessment-binding ../cloudstudy-mobile-candidate 1df4a31862fc
```

## 工作树快照

| 工作树 | 基线 | 快照 | 已跟踪 | 未跟踪 |
|---|---|---|---:|---:|
| `mobile-assessment-binding-contract-20261106` | `9b6491774098` | [`1df4a31862fc`](https://github.com/tianszpochika-cmd/PhraseStar/commit/1df4a31862fc19f60d6f9014e3b74a7da39c7f62) | 5 | 0 |
| `mobile-assessment-binding-pep-20261106` | `3fc746e8efcb` | [`7a49aa563192`](https://github.com/tianszpochika-cmd/PhraseStar/commit/7a49aa5631928515bb439a9bd78a3883ecb6cce0) | 1 | 1 |
| `mobile-assessment-binding-reader-20261106` | `123c69bd7d31` | [`4d25ffe25458`](https://github.com/tianszpochika-cmd/PhraseStar/commit/4d25ffe25458ea81cebc585d9352a61e6333e99a) | 1 | 4 |
| `mobile-assessment-event-correlation-20261106` | `1c5e4b67d319` | [`715db795debf`](https://github.com/tianszpochika-cmd/PhraseStar/commit/715db795debf1abbd6a0bf4a28619fd9f79ee18a) | 3 | 1 |
| `mobile-assessment-event-identity-20261106` | `6c4036e87902` | [`555fa7813a46`](https://github.com/tianszpochika-cmd/PhraseStar/commit/555fa7813a46c3f95777fa206622cbadabb50ece) | 1 | 0 |
| `mobile-assessment-item-outcomes-20261106` | `71528536581c` | [`4f0958fe4b2a`](https://github.com/tianszpochika-cmd/PhraseStar/commit/4f0958fe4b2aeb9e0cccb61d0ea7488907b50104) | 4 | 2 |
| `mobile-assessment-outcomes-baseline-20261106` | `71528536581c` | [`53251c733492`](https://github.com/tianszpochika-cmd/PhraseStar/commit/53251c733492bcaa7396841e48388d56779fc232) | 2 | 0 |
| `mobile-assessment-owner-integrate-20261106` | `ba75ca0e4885` | [`4c7e246561f8`](https://github.com/tianszpochika-cmd/PhraseStar/commit/4c7e246561f827ee994313669a1d5eca4d9e0d15) | 8 | 3 |
| `mobile-assessment-pin-mysql-20261106` | `82ce1171c67d` | [`fd0072646051`](https://github.com/tianszpochika-cmd/PhraseStar/commit/fd00726460514de43adb47e3abd1ba150274c1af) | 0 | 1 |
| `mobile-assessment-pinned-time-20261106` | `82ce1171c67d` | [`753481347ba5`](https://github.com/tianszpochika-cmd/PhraseStar/commit/753481347ba5b12167cb8da99210fc6373aaa116) | 3 | 1 |
| `mobile-assessment-reading-client-20261106` | `3fc746e8efcb` | [`7f9c8e0b2769`](https://github.com/tianszpochika-cmd/PhraseStar/commit/7f9c8e0b2769da62bb1af3b3c43ab0f6e83238ae) | 2 | 3 |
| `mobile-assessment-relay-jdbc-20261106` | `ab6508e49229` | [`fda173d87c44`](https://github.com/tianszpochika-cmd/PhraseStar/commit/fda173d87c44fceb0e9f85ec894a6cbb49f0126c) | 2 | 7 |
| `mobile-assessment-source-pin-20261106` | `9897d43db1ca` | [`5fab1c4d578a`](https://github.com/tianszpochika-cmd/PhraseStar/commit/5fab1c4d578a1eca474aa98ed683e41d0f6eef61) | 5 | 1 |
| `mobile-b23-regression-20261105` | `88e4c3ed863d` | [`d0abd4df98d3`](https://github.com/tianszpochika-cmd/PhraseStar/commit/d0abd4df98d397ed1dcd0a318e4483fbdf43f805) | 1 | 0 |
| `mobile-closed-workspaces-20261105` | `d33ac9b81b21` | [`fdedc9edc7f9`](https://github.com/tianszpochika-cmd/PhraseStar/commit/fdedc9edc7f91021ed33a743a349dd266ff31e76) | 17 | 0 |
| `mobile-consent-boundaries-20261105` | `792f160c903b` | [`091b5dd51abf`](https://github.com/tianszpochika-cmd/PhraseStar/commit/091b5dd51abf5ff1069112b2f5b1f80d651794c2) | 2 | 0 |
| `mobile-consent-contract-20261105` | `75fb5207213d` | [`2c88feb22a04`](https://github.com/tianszpochika-cmd/PhraseStar/commit/2c88feb22a04b60ddf0836d0757a6f4ba87a4455) | 1 | 0 |
| `mobile-consent-frontend-20261105` | `75fb5207213d` | [`dfc1a592919e`](https://github.com/tianszpochika-cmd/PhraseStar/commit/dfc1a592919e9c5f810be69370c8baec7fead0be) | 6 | 0 |
| `mobile-content-reading-article-owner-20261106` | `9b6491774098` | [`566e848b0dd4`](https://github.com/tianszpochika-cmd/PhraseStar/commit/566e848b0dd4c6d167de17fed9868899a41413e5) | 10 | 4 |
| `mobile-content-reading-binding-20261106` | `9b6491774098` | [`aa74cc1813d1`](https://github.com/tianszpochika-cmd/PhraseStar/commit/aa74cc1813d1c1ce688e4f5dd10e711e9e59ada3) | 3 | 3 |
| `mobile-content-reading-score-contract-20261106` | `82ce1171c67d` | [`471ecfeaee14`](https://github.com/tianszpochika-cmd/PhraseStar/commit/471ecfeaee14f00ca82956ffe9f3d236ada84e54) | 9 | 3 |
| `mobile-contract-ci-20261105` | `76e0dab23c68` | [`2314ee08d3ba`](https://github.com/tianszpochika-cmd/PhraseStar/commit/2314ee08d3baf362bca464b806482ae3c73f9e76) | 6 | 0 |
| `mobile-experience-runner-20261105` | `7b30cdf6a31b` | [`b1314897d7ab`](https://github.com/tianszpochika-cmd/PhraseStar/commit/b1314897d7ab94ec3976e3f647d6b1c0dd688068) | 2 | 0 |
| `mobile-figma-dsh-20261103` | `f01cddc6be0f` | [`04d3ad5b4100`](https://github.com/tianszpochika-cmd/PhraseStar/commit/04d3ad5b41002c2b2715ec84f61559607d8e81c3) | 31 | 306 |
| `mobile-figma-dsh-commerce-20261104` | `bd649198721f` | [`919826e9c18c`](https://github.com/tianszpochika-cmd/PhraseStar/commit/919826e9c18cf2f4c994b6a919300e33080394a9) | 11 | 107 |
| `mobile-figma-dsh-devices-20261104` | `3a91f6ec4802` | [`b4d312599b38`](https://github.com/tianszpochika-cmd/PhraseStar/commit/b4d312599b38b91ca1d654897460f7697080d8bf) | 15 | 85 |
| `mobile-figma-dsh-profile-20261104` | `f01cddc6be0f` | [`ae1a84902cf7`](https://github.com/tianszpochika-cmd/PhraseStar/commit/ae1a84902cf73d3e78324c0a6bb6a4e89abcc051) | 18 | 152 |
| `mobile-figma-grok-20261103` | `f01cddc6be0f` | [`cb7017e5d9d3`](https://github.com/tianszpochika-cmd/PhraseStar/commit/cb7017e5d9d33d9d525b5920cfc99dbb719bf464) | 24 | 222 |
| `mobile-figma-home-tablet-20261105` | `f01cddc6be0f` | [`935c5d9dce29`](https://github.com/tianszpochika-cmd/PhraseStar/commit/935c5d9dce294ccc10a11d8de8547fe9a1f2f781) | 22 | 222 |
| `mobile-figma-visual-finishing-20261105` | `27b84d4f81bc` | [`89f9d29c6d11`](https://github.com/tianszpochika-cmd/PhraseStar/commit/89f9d29c6d118626f09d6fed22b74111b2ea02e2) | 7 | 29 |
| `mobile-gated-content-20261106` | `3fc746e8efcb` | [`87ab0f6c4f75`](https://github.com/tianszpochika-cmd/PhraseStar/commit/87ab0f6c4f75fcd4945ecd4821b0b1759c54a3e6) | 1 | 0 |
| `mobile-iam-learning-workload-20261106` | `9b6491774098` | [`87005f70c271`](https://github.com/tianszpochika-cmd/PhraseStar/commit/87005f70c271227e6a8dd7129cb8fdfbfde7b682) | 2 | 0 |
| `mobile-iam-publication-20261105` | `2df3e56de6cb` | [`feb0c0cf73c5`](https://github.com/tianszpochika-cmd/PhraseStar/commit/feb0c0cf73c5743ab2f510f2f73190ab21455061) | 5 | 2 |
| `mobile-learn-shelf-denial-20261106` | `e00854d81f90` | [`8a09e6523b7f`](https://github.com/tianszpochika-cmd/PhraseStar/commit/8a09e6523b7f4eebdf4bda77b22d7b80be91dfc0) | 2 | 0 |
| `mobile-learner-preference-client-20261106` | `ba75ca0e4885` | [`7bb058327eea`](https://github.com/tianszpochika-cmd/PhraseStar/commit/7bb058327eeac15c93757450f5916e2e6ad213e8) | 6 | 0 |
| `mobile-learner-preference-fingerprint-20261106` | `52af22b23fd6` | [`2cf500f7f7b4`](https://github.com/tianszpochika-cmd/PhraseStar/commit/2cf500f7f7b4052a6f1ca4117e0c4eaac5eb4552) | 1 | 1 |
| `mobile-learner-preference-version-20261106` | `52af22b23fd6` | [`59b3f1413781`](https://github.com/tianszpochika-cmd/PhraseStar/commit/59b3f14137813f2c8d267b6dbca8302cff334010) | 3 | 2 |
| `mobile-learning-assessment-intake-20261106` | `71528536581c` | [`53c4905be0a9`](https://github.com/tianszpochika-cmd/PhraseStar/commit/53c4905be0a94b987bc453532aa86491d2d3bf68) | 0 | 4 |
| `mobile-learning-binding-live-verify-20261106` | `981be67700ee` | [`041e28417acf`](https://github.com/tianszpochika-cmd/PhraseStar/commit/041e28417acf77e016ae0468b6ceac69c9a1e297) | 0 | 5 |
| `mobile-learning-owner-contract-20261106` | `3fc746e8efcb` | [`286115fc59f3`](https://github.com/tianszpochika-cmd/PhraseStar/commit/286115fc59f3644e227430679748835ba86d11f8) | 5 | 0 |
| `mobile-mistake-detail-20261105` | `2df3e56de6cb` | [`8035fea565a1`](https://github.com/tianszpochika-cmd/PhraseStar/commit/8035fea565a10f53c208a6e63358f131903f21b1) | 1 | 0 |
| `mobile-native-compiler-20261106` | `3953f8b80d46` | [`678469c31f3a`](https://github.com/tianszpochika-cmd/PhraseStar/commit/678469c31f3a068199aef1a77bcfd0de5aa8d750) | 2 | 0 |
| `mobile-native-default-build-20261106` | `3fc746e8efcb` | [`617a6336ba38`](https://github.com/tianszpochika-cmd/PhraseStar/commit/617a6336ba3867df127732083a76b83b17880546) | 10 | 0 |
| `mobile-native-uts-proof-20261106` | `b87644c5ed43` | [`5f099133da66`](https://github.com/tianszpochika-cmd/PhraseStar/commit/5f099133da66ffb57e6521405834b420c7752745) | 11 | 11 |
| `mobile-perf-runtime-20261105` | `8e16cc14f4db` | [`12849f20a6e2`](https://github.com/tianszpochika-cmd/PhraseStar/commit/12849f20a6e2f1d70904f103cac688933d4b1342) | 6 | 2 |
| `mobile-practice-hub-tab-20261106` | `3fc746e8efcb` | [`9889e42b4baa`](https://github.com/tianszpochika-cmd/PhraseStar/commit/9889e42b4baaf7cf2a2ca8e4e5014caaa4936ff4) | 2 | 0 |
| `mobile-reading-accessibility-20261106` | `3fc746e8efcb` | [`efb4010542a9`](https://github.com/tianszpochika-cmd/PhraseStar/commit/efb4010542a96a6f250d64ddfbdd70a7cad0963d) | 10 | 0 |
| `mobile-reading-article-contract-20261106` | `3fc746e8efcb` | [`251697d22336`](https://github.com/tianszpochika-cmd/PhraseStar/commit/251697d223366cdf20902bb7490a66e135289643) | 3 | 0 |
| `mobile-reading-assessment-combine-20261106` | `ee588130f930` | [`1d767c6f83dc`](https://github.com/tianszpochika-cmd/PhraseStar/commit/1d767c6f83dc05cbe842b875ccaa55541099f70e) | 2 | 3 |
| `mobile-reading-owner-audit-20261106` | `71528536581c` | [`d7508df22caa`](https://github.com/tianszpochika-cmd/PhraseStar/commit/d7508df22caafd5c16fabdd31cee3102b52d341c) | 0 | 1 |
| `mobile-reading-practice-combine-20261106` | `ba75ca0e4885` | [`5d4bcffc847e`](https://github.com/tianszpochika-cmd/PhraseStar/commit/5d4bcffc847ef5a8c6b03e02caee773fd5fd8f42) | 12 | 0 |
| `mobile-reading-question-contract-20261106` | `71528536581c` | [`4dba13693bbd`](https://github.com/tianszpochika-cmd/PhraseStar/commit/4dba13693bbd4110d05cdcda8c4af7da195665d7) | 8 | 2 |
| `mobile-repair-contract-20261106` | `4753845929b1` | [`32d4fa4810ee`](https://github.com/tianszpochika-cmd/PhraseStar/commit/32d4fa4810ee2238df50cdf942ebedc07c19ce64) | 2 | 0 |
| `mobile-report-client-idempotency-20261105` | `4770365f2030` | [`af9982141355`](https://github.com/tianszpochika-cmd/PhraseStar/commit/af99821413550d65fe18d19f1ccb14aed5231171) | 4 | 0 |
| `mobile-report-revoke-jdbc-20261105` | `47043d4a46d2` | [`61deddd29448`](https://github.com/tianszpochika-cmd/PhraseStar/commit/61deddd29448740d463ee3fc48844cc0f61ced36) | 0 | 1 |
| `mobile-report-share-20261105` | `2da55735f5e9` | [`1b860cb8411e`](https://github.com/tianszpochika-cmd/PhraseStar/commit/1b860cb8411e5a57c5519b91f64abf5db4d14a58) | 3 | 2 |
| `mobile-reset-fast-submit-20261106` | `3fc746e8efcb` | [`5d037eeb0e2f`](https://github.com/tianszpochika-cmd/PhraseStar/commit/5d037eeb0e2f6ae4764a5171c381070a40946f64) | 1 | 0 |
| `mobile-support-contract-20261105` | `2df3e56de6cb` | [`13cb4dcc3352`](https://github.com/tianszpochika-cmd/PhraseStar/commit/13cb4dcc3352bb05339ca5a9f1e66163ceebade9) | 2 | 0 |
| `mobile-support-read-no-persist-20261106` | `d4737bb75de7` | [`d77a159df134`](https://github.com/tianszpochika-cmd/PhraseStar/commit/d77a159df1345f14da602fbb71a3742c3b454b9d) | 2 | 0 |
| `mobile-today-high-contrast-20261106` | `1c5e4b67d319` | [`461c2f1b97d2`](https://github.com/tianszpochika-cmd/PhraseStar/commit/461c2f1b97d2e138e9b14c1f6cf3ab2a1ca4033f) | 2 | 0 |
| `mobile-today-queue-20261106` | `6c4036e87902` | [`ca432b3b3d89`](https://github.com/tianszpochika-cmd/PhraseStar/commit/ca432b3b3d89d03005d7ca7cf4e9ae3bc207250f) | 4 | 0 |

## 暂停时的探针

G391 定级同键重放、G392 书架、G394 设备批量退出、G397 登录返回和 G399 阅读反馈合计保存 18 个待复核文件。G398 没有冻结产物。发布副本替换了机器私有路径及一处合成账号的口令配置，原始与副本指纹分别记录在清单中。验证范围与恢复顺序见 [暂停交接](../PAUSE-20261106.md)。

历史 stash 中可移植的模拟目录种子脚本另存为 [`4743ed201f5a`](https://github.com/tianszpochika-cmd/PhraseStar/commit/4743ed201f5ae7f83b6c51c7afee1ae24b8e51e2)，待审查后使用。该 stash 的 138 项原始运行证据留在本机。环境密钥、CLI 会话、容器数据卷、依赖缓存和编译产物在接手机器按需配置或生成。

## 分支来源与保留记录

- 官网旧分支 `codex/official-site-v1-20261103` 的 `8a694055` 已进入 `dev`。
- 移动端来源分支 `codex/mobile-figma-integration-20261103` 的已审核记录截至 `c4dcfc10`，本次作为 `dev` 续作基线。
- 归档来源分支 `codex/cloudstudy-handoff-20261106` 的 `580c17d1` 由 `archive/cloudstudy-20261106` 保存。待复核候选逐份审查。
