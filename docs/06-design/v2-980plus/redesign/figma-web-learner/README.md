# Web 学员端 Figma 业务覆盖

当前为全量来源建账、设计与交互验收待完成的工作快照。没有用页面数量或历史签收计算产品完成率。

- [逐项页面、状态与交互清单](checklist.md)
- [业务覆盖说明](coverage.md)
- [机器覆盖清单](coverage.json)：484条当前Web源需求、291项义务及496条明确排除。
- 主要设计文件：[Web 学员端 Figma](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk)。逐义务 JSON 保存实际候选frame链接。

首要阻断是原型计时：MCP数字800在实际编辑器显示800000ms。两节点经GUI修复后的单条阅读收藏/保存/返回链已通过，其余计时仍待原位迁移；两处录音FRAME已通过GUI恢复延时触发并保留18条动作标签，完整原生动作与声音链仍待核对。所有旧未执行工具必须在校准后重编。

JSON以FigmaID/链接、仓库相对来源路径/当前行/原文/SHA为可移植主字段。已有原生片段含实际nodeID、文本与来源artifact SHA；未导出的本机pointer仅作待验证线索，不当远程已验收证据。完整动作与全部状态语义尚未签收，真实服务、键盘及读屏验收另计。

恢复任务先读[随仓续办说明](RESUME.md)，再核对本机操作包的 CURRENT-WEB-COVERAGE-CHECKPOINT-v2 和 RESUME-WEB-COVERAGE，禁止重建已经成功的批次；先校准与修复已存在节点。

## 当前可查看的图稿入口

这些入口对应已经写入的原生图稿，完整业务签收状态以逐项清单为准。听力与口语等条件模块保留默认关闭的入口。

| 图稿 | Figma 入口 |
|---|---|
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

本聊天已设每小时检查与续办（任务 `figma-web`），额度未恢复时保持安静。先对账四个GUI改动根，再校准当前连接的原型计时单位、修复helper触发器保持逻辑、迁移现有timer并重编未执行工具；不得重建已成功主体。此本地续办需要电脑与应用保持运行。

## 清单校验

运行 `python3 docs/06-design/v2-980plus/redesign/figma-web-learner/verify-coverage.py --output docs/06-design/v2-980plus/redesign/figma-web-learner/validation.json`。此检查核对980条来源分流、484条Web需求、291项义务、2625处当前源行及来源文件SHA；设计状态仍全部待验。来源解析单列 [回归记录](source-parser-validation.json)，宽分组逐原子核对见 [审查提醒](review-warnings.json)。

[独立55项跨页业务复审](cross-domain-55-review.md)把未关闭问题分为16组，逐项给出最小动作、归属与依赖。

[无障碍与响应式逐项审查](accessibility-review.md)及[跨来源草稿与保存完整性审查](draft-integrity-review.md)列明已证实缺口和待执行修补合同，均未签收。
