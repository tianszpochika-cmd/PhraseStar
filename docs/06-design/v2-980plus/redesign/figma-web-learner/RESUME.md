# Web 学员端 Figma 续办

当前为进行中的设计工作，尚未全量签收。恢复过程先对账实际图稿，再写入；成功主体禁止重建。

## 先完成计时校准

1. 先读取当前 Figma 文件 `cbUQgN4Kdd3GrYeDVfF7sk` 的四个实际GUI改动根：`378:9826`、`378:9884`、`378:14435`、`378:14493`。后两根已通过GUI恢复为延时800ms，18条动作标签保持；完整原生动作仍待核对。
2. 对照[浏览器记录](BROWSER-QA-CURRENT.json)确认当前连接的写入值、原生读取值、界面毫秒值和实际跳转。原输入800曾显示800000ms；不能只按文档推断单位，也不能盲写0.8。
3. 修复共享helper保持原trigger及集中时间适配，保留全部请求、版本、take快照和SET动作；原位迁移已存在的计时，不重新生成页面。
4. 复测保存、待确认、原查询、确认、历史回访、旧actor及过期分支；之后才按新helper和真实依赖重新编译未执行稿。

## 后续范围

按照[16组具体剩余工作](cross-domain-55-review.md)和[逐项清单](checklist.md)推进。Auth3/Consent3、FirstDay、定级音频/报告、原阅读语法确认事实、Quick原子任务、专项/交错与报告来源、个人库、家庭、账本/专注、全局来源及页头均需依赖实际回执和原控件。旧v1/v2或仅有本地模型的脚本不能作为已执行证据。

当前公共页头仅4个代表成功，批次01因额度前置拦截未写，原11批均未执行且已有后续版本。写作三批、31条接线和原191:2552入口v5已成功，禁止重放。移动端不补Web覆盖；未批准的真实业务Gate保持关闭。

## 本机操作包

完整已执行脚本、成功/回滚回执、依赖工厂和最小读回脚本保存在：

`/Users/Admin/.codex/visualizations/2026/11/03/web-learner-business-coverage/`

依次读 `RESUME-WEB-COVERAGE-v3.md`、`CURRENT-WEB-COVERAGE-CHECKPOINT-v2.json`、`RESUME-WEB-COVERAGE.md`（历史队列不得直接执行）、`WEB-ROOT-UI-MUTATIONS.json`、最新各域恢复清单及校准文件。文件名、SHA和actual ID对账后才能选执行稿；不存在的本机操作包不能靠同名旧文件重放恢复。

本聊天定时续办任务为 `figma-web`，每小时检查一次额度；未恢复时保持安静。此本地任务需要电脑和应用保持运行。完成设计全量核对及最终证据后停止定时任务。

## 验收边界

仓内来源清单与配套SHA可独立校验。尚未导出的完整原生动作只作待验证线索；模型、原生创建、单条浏览器样例与完整设计闭环分别记录。真实IAM、权限、数据持久化、媒体、键盘和读屏运行验收单列。

最终冻结包以 `access-final-resume-packet.json`、`skills-final-review-packet-v2.json`、`practice-resume-current.md`、`growth-commerce-final-resume-checkpoint.json`、`account-services-LATEST-RECOVERY.json` 和最新 scope/header v2 包为准。FirstDay 使用 v2，Auth 使用 v3 16根，不能按旧入口中 v1 或15根数执行。表达草稿完整性仍待真正修补，详见 [审查](draft-integrity-review.md)。
