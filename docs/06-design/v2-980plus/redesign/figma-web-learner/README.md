# Web 学员端 Figma 业务覆盖

当前为全量来源建账、设计与交互验收待完成的工作快照。没有用页面数量或历史签收计算产品完成率。

- [逐项页面、状态与交互清单](checklist.md)
- [业务覆盖说明](coverage.md)
- [机器覆盖清单](coverage.json)：484条当前Web源需求、291项义务及496条明确排除。
- 主要设计文件：[Web 学员端 Figma](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk)。逐义务 JSON 保存实际候选frame链接。

原型计时已完成当前连接的校准：写入0.8、原生读取浮点值与编辑器800ms相符。159个已明确归属的旧计时器已原位修正，完整动作比较证明仅计时值变化；4个已通过界面修正的节点保留。旧1000个已创建根的子树扫描未发现嵌套计时器，此结论不外推到新增页面或未知旧节点。后续工具必须使用校准合同与v5.2助手重新生成。

本轮新增登录与账号恢复16个状态根、三项同意16个状态根、阅读与语法原作答确认14个状态根，并连接原入口。口语自评的单选、保存确认和返回保留，以及汉译英固定正文的保存待确认、查询原请求、返回后显示最近确认版本v5，已有局部浏览器证据。这些结果不能代替全业务签收；身份到学习空间的连接、表单视觉整理、其余练习与报告、完整草稿快照、响应式和无障碍仍在推进。

JSON以FigmaID/链接、仓库相对来源路径/当前行/原文/SHA为可移植主字段。已有原生片段含实际nodeID、文本与来源artifact SHA；未导出的本机pointer仅作待验证线索，不当远程已验收证据。完整动作与全部状态语义尚未签收，真实服务、键盘及读屏验收另计。

恢复任务先读[随仓续办说明](RESUME.md)，再核对本机操作包的 CURRENT-WEB-COVERAGE-CHECKPOINT-v3.json 和 RESUME-WEB-COVERAGE-v4.md，禁止重建或重放已经成功的批次。

## 当前可查看的图稿入口

这些入口对应已经写入的原生图稿，完整业务签收状态以逐项清单为准。听力与口语等条件模块保留默认关闭的入口。

| 图稿 | Figma 入口 |
|---|---|
| 登录与账号恢复 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=426-15265) |
| 必要同意与版本恢复 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=439-15453) |
| 学习计划 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3447) |
| 词汇与词书 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7616) |
| 语法树 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=354-3184) |
| 听力 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-10196) |
| 口语 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-12229) |
| 阅读目录 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-18853) |
| 写作 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=381-10060) |
| Quick练习 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-3794) |
| 考试目录 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4989) |
| 通知偏好 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-4957) |
| 更多设置 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5090) |
| 本人支持工单 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6498) |
| 订单与权益 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3618) |
| 设备与安全 | [查看](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24548) |

## 已留存的浏览器与响应式证据

[浏览器记录](BROWSER-QA-CURRENT.json)单列已通过样例和仍开放问题。[证据文件清单](evidence/manifest.json)包含1440、1024、768及200%文字截图，以及阅读收藏确认、原句来源和返回原文截图。真实IAM、存储、媒体、键盘与读屏运行验收仍未签收。

## 自动续办

本聊天已设每小时检查与续办（任务 `figma-web`）。本轮额度恢复后已继续实际写入；无可行动变化时保持安静。按最新停点继续剩余业务、原型和视觉核对，不重复校准或迁移已成功节点。此本地续办需要电脑与应用保持运行。

## 清单校验

运行 `python3 docs/06-design/v2-980plus/redesign/figma-web-learner/verify-coverage.py --output docs/06-design/v2-980plus/redesign/figma-web-learner/validation.json`。此检查核对980条来源分流、484条Web需求、291项义务、2625处当前源行及来源文件SHA；设计状态仍全部待验。来源解析单列 [回归记录](source-parser-validation.json)，宽分组逐原子核对见 [审查提醒](review-warnings.json)。

[独立55项跨页业务复审](cross-domain-55-review.md)把未关闭问题分为16组，逐项给出最小动作、归属与依赖。

[无障碍与响应式逐项审查](accessibility-review.md)及[跨来源草稿与保存完整性审查](draft-integrity-review.md)列明已证实缺口和待执行修补合同，均未签收。
