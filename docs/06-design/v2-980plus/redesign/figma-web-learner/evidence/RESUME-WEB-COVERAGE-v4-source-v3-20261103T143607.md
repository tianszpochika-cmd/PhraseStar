# Web 学员端续办 v4

本入口优先于旧v3 RESUME及旧v2 checkpoint。全量设计仍未签收，484条Web需求与291义务分母保持；所有操作文件在同目录。

**Authcleanform失败批已通过后续原生只读核对解除恢复阻断，视觉整理仍OPEN。** 失败原回执 access-auth-cleanform-v1-write-result.json 仍是 PARTIAL_FAILURE_READ_BEFORE_RETRY / rollbackComplete=false，不改写历史结果。READ01/02/03-v2与READ04-hidden-native-v1合并确认146原TEXT、27完整RX、9行、11组件属性、两个Auth hook吻合；57显式463新增节点全无。最后4个隐藏TEXT必须通过临时skipInvisible=false取得非null且parent列出后才算核到，READ04已做到并恢复flag。55变量成员/type/scope和notice原默认值吻合，其他54运行前值未持久化，不能称逐值恢复或按creation default覆盖。恢复未额外写canvas。旧主稿永久禁止重放；禁止删除I426既有虚拟TEXT、禁止以findAll差集认新增。后续只拆小批重新freshguard。正常Auth/CUI hook接线可在其它依赖具备后继续。

FirstDay16与Global12在该失败前已分别实际成功，当前累计1074root FRAME，仍非业务签收。FirstDay回执 access-firstday-recovery-v2-calibrated-v1-write-result.json；Global回执 global-scope-ui12-v2-write-result.json，0原source写、待接线。它们独立保留不可重放。Source19现在3/19批实际成功（r1/r2 controls、r1-input）；进度20句修正后三个大程序fresh完整hash与期望全等，见 practice-core-position-copy-after-native-v1.json。剩16批仍待fresh/执行。

- 先读 CURRENT-WEB-COVERAGE-CHECKPOINT-v3.json 与本轮实际回执。root独占Figma；复用已有session，不建第二会话。
- MCP已真实恢复。单位校准 write0.8→native Float32→GUI800ms→browser已确认；合同 timeout-calibration.verified.json 已VERIFIED，helper已安装v5.2。不得重跑旧未校准队列。
- 159顶层timer已原位迁移并完整程序比较，4GUI正确根保留。旧1000created子树实际扫描57,611 descendants/8,856 reaction descendants，0 nested timer；不外推到新Auth16或未知旧源祖先。回执见 owned-timer-migration-current.json，禁止重放。
- Auth UI16 calibrated-v2已成功，首登录426:15265，注册426:15282。v1自NAV失败已退回：561nodes已无，55vars/1collection当前枚举及GUI均无。按ID查询会返回旧wrapper，不据此判断残留；不得引用417批失败ID或重放v1。
- 新Auth16未视觉签收：正常表单测试场景按钮需移已有review426:15520，帮助改普通文案，窄屏完整滚动实测；密码显隐、CTA和所有请求/unknown scope保留。Auth source实际已成功20个程序、3项隐藏，回执 access-auth-source-integration-v3-actual-v2-write-result.json。Consent UI16亦已成功439家族、78唯一变量，source已成功11程序及22项spec，见 access-consent-v3-UI-actual-v2-write-result.json / access-consent-source-integration-v3-actual-v2-write-result.json；不可重放。全量原型/视觉未签收。
- 2表达checkbox已native修并browser检查3组合，回执 skills-expression-choice-state-v2-write-result.json。Choice v3已实际修剩27、跳过2正确项。浏览器发现14个已选clone落在PAGE而非原选项容器，已用 a11y-choice-clone-placement-v1-apply-result.json 原位归位，0新节点/变量。prototype reload后口语自评A/B/C位置及唯一选择、C保存确认/返回重入保留已实测，proof speaking-choice-placement-*；Radar/Story/reset仍待测。v2含不支持pluginData禁跑，v3不使用此API。不得以此宣称键盘或读屏通过。
- Writing已写0root/3TEXT/3var匹配保存事实补丁及学员文案修正，原7actions和timer保留。fresh prototype保存→unknown→原query→confirmed→回编辑已实测保留19词正文、最近一次保存已确认与v5，proof writing-save-fact-current-{unknown,confirmed,return-v5}.png；一次URL等待超时后fresh URL与截图确认，不接受该轮时延数。任意编辑、完整草稿快照、当前dirty与真实持久化仍未验收。
- Practice Core14 calibrated-v1已实际成功，14roots/82vars。grading10、unknown/query各5条把题号误作完成数的文案已实际修正，回执 practice-core-{grading,save}-position-literal-v1-result.json，三个大程序保留conditions/score/payload/order/timer，待fresh完整hash读回。Source19第一批read-controls-r1已actual成功8既有ID，剩18批仅本地checked，逐组fresh guard再写；禁止重放成功批。其它旧NOT_RUN用v5.2/真实合同重编，不能直接跑旧800/1000工具，不得删保护压预算。
- 当前新增46个根=Auth16+Consent16+Practice14，总1046个已创建root FRAME，并非1046业务页面，更非484需求/291义务已覆盖。旧1000子树nested扫描不外推新增46。FirstDay v2 fresh13已读 access-firstday-recovery-v2-calibrated-v1-current-source13-parsed.json，按实际Auth55/Consent78/currenthelper编，旧v1与PLAN-GEN-DEMO01不得代替normal用户计划。
- 历史全业务队列参考 RESUME-WEB-COVERAGE-v3.md；冲突以v4和actual receipts为准。先完成当前最小修复和依赖，再推进全部484/291逐义务闭环，不用根数量充完成率。

仓库最近已推文档0bafc67e；本轮timer/新Auth/Choice/Writing证据尚在本机，验证后另做文档提交。定时figma-web仍ACTIVE，全部设计闭环并保存证据后再停。
