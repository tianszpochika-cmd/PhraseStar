# Web 学员端逐项设计核对清单

当前所有整项签收保持未验证；原生候选和局部证据不能代替完整页面、状态及交互核验。每项列出原业务要求，完整来源与证据字段见 [coverage.json](coverage.json)。

## AUTH-LOGIN-01 · 账号密码登录表单与非敏感校验

- 需求：V2-980-0359、V2-980-0366、V2-980-0367。
- 页面：账号密码登录表单与非敏感校验。
- 状态：空表单；账号必填/格式；密码必填；显示/隐藏密码；凭据未通过。
- 交互：官网/受保护站内深链进入登录；字段校验不枚举账户；提交到IAM；失败保留账号等非敏感字段，密码不持久化；注册/重置/公开页出口。
- 实际候选：[12:6](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=12-6)、[14:239](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=14-239)、[31:185](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=31-185)、[31:262](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=31-262)、[206:6098](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6098)、[206:6359](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6359)。
- 整项核验：UNVERIFIED；OPEN。

## AUTH-LOGIN-02 · 登录进行中、限流及离线

- 需求：V2-980-0359、V2-980-0366、V2-980-0367。
- 页面：登录进行中、限流及离线。
- 状态：提交中；失败；限流/锁定；离线；服务不可用。
- 交互：提交后禁重复；错误不区分账户存在性；等待时间只展示IAM返回值；离线不提交或缓存密码；恢复网络后返回登录。
- 实际候选：[206:6189](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6189)、[206:6359](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6359)、[206:6442](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6442)、[206:6525](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6525)。
- 整项核验：UNVERIFIED；OPEN。

## AUTH-LOGIN-03 · 登录后资格分流与安全返回

- 需求：V2-980-0359、V2-980-0366、V2-980-0367、V2-980-0361。
- 页面：登录后资格分流与安全返回。
- 状态：资格读取中；未完成Gate；已通过；受限；资格不可读；站内目标有效；returnTo无效/无权。
- 交互：IAM确认主体；服务端读最新资格；未完成Gate进Gate；有权returnTo回原目标；失效或越权目标走安全首页/允许账号服务；403不反复登录。
- 实际候选：[160:3572](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3572)、[160:3654](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3654)、[160:3741](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3741)、[160:3823](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3823)、[206:8162](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8162)、[206:8285](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8285)、[206:8403](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8403)。
- 整项核验：UNVERIFIED；OPEN。

## AUTH-LOGIN-04 · 会话过期、撤销、账号切换与旧异步响应隔离

- 需求：V2-980-0359、V2-980-0366、V2-980-0367、V2-980-0362、V2-980-0369、V2-980-0370、V2-980-0391。
- 页面：会话过期、撤销、账号切换与旧异步响应隔离。
- 状态：刷新中；已过期；已撤销；刷新网络失败；切换确认；已切换；403。
- 交互：仅一次合并静默刷新；不能刷新或撤销才重登；清除敏感本地状态；切换后旧响应不得覆盖新用户；仅回有权的安全目标。
- 实际候选：[367:4149](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4149)、[367:4166](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4166)、[367:4098](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4098)、[31:52](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=31-52)、[206:7667](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7667)、[206:7797](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7797)、[206:7920](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7920)、[206:8041](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8041)、[206:8162](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8162)、[206:8285](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8285)、[206:8403](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8403)、[206:8521](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8521)、[206:8639](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8639)、[206:8760](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8760)。
- 整项核验：UNVERIFIED；OPEN。

## AUTH-REGISTER-01 · 成人候选注册与字段校验

- 需求：V2-980-0359、V2-980-0366、V2-980-0367。
- 页面：成人候选注册与字段校验。
- 状态：空字段；账号格式错；密码策略错；提交中；通用注册失败；频率受限。
- 交互：读取IAM密码策略；字段校验不枚举；注册仅创建账号/受控会话；201进入成人Gate；失败保留非敏感输入但不持久化密码。
- 实际候选：[12:83](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=12-83)、[14:316](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=14-316)、[206:6606](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6606)、[206:6698](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6698)、[206:6781](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6781)、[206:6950](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6950)。
- 整项核验：UNVERIFIED；OPEN。

## AUTH-REGISTER-02 · 注册结果未知及安全恢复

- 需求：V2-980-0359、V2-980-0366、V2-980-0367。
- 页面：注册结果未知及安全恢复。
- 状态：提交中；结果未知；已确认未创建；已创建未过Gate。
- 交互：重复同键返回同结果；未知不重复建号；支持核实或登录确认；不得展示账户存在性；不重现原密码。
- 实际候选：[206:6698](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6698)、[206:6781](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6781)、[206:6866](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6866)、[206:6950](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-6950)。
- 整项核验：UNVERIFIED；OPEN。

## AUTH-RESET-01 · 密码重置申请不枚举

- 需求：V2-980-0360。
- 页面：密码重置申请不枚举。
- 状态：空申请；填写；发送中；统一202回执；频率受限；离线/错误。
- 交互：输入账号；不论账户存在统一反馈；返回登录或稍后申请；不把发送回执当密码更新。
- 实际候选：[25:34](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-34)、[25:107](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-107)、[25:180](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-180)。
- 整项核验：UNVERIFIED；OPEN。

## AUTH-RESET-02 · 新密码确认与失效链接处理

- 需求：V2-980-0360。
- 页面：新密码确认与失效链接处理。
- 状态：新密码/确认密码空；密码策略不满足；两次不一致；提交中；链接过期；链接已用；更新成功；离线；结果未知。
- 交互：有效安全链接进入；密码校验后提交IAM；一次性令牌不重放；过期/已用重新申请；成功清除输入返回登录；未知不重用令牌。
- 实际候选：[206:7033](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7033)、[206:7125](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7125)、[206:7206](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7206)、[206:7293](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7293)、[206:7374](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7374)、[206:7457](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7457)、[206:7540](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7540)、[225:7609](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7609)。
- 整项核验：UNVERIFIED；OPEN。

## ADULT-GATE-01 · 只采出生年份与成人声明

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：只采出生年份与成人声明。
- 状态：年份空；年份无效/未来；声明未选；声明已选；核验中；PASSED；REJECTED。
- 交互：说明采集必要性；只收birthYear不采完整生日；服务端确认资格；未确认不学习/不支付；拒绝不创建儿童主体。
- 实际候选：[12:160](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=12-160)、[14:393](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=14-393)、[160:3907](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3907)、[160:3991](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3991)、[160:4075](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-4075)、[160:4156](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-4156)、[160:3741](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3741)。
- 整项核验：UNVERIFIED；OPEN。

## ADULT-GATE-02 · 资格核验未知、失败与离线

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：资格核验未知、失败与离线。
- 状态：读取中；核验中；读取失败；提交结果未知；原请求查询中/失败；离线。
- 交互：未知保持原操作；先查询原请求；不把未知当拒绝/未提交；安全离开后回访仍恢复原状态；离线不放行。
- 实际候选：[160:3823](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3823)、[160:4075](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-4075)、[160:4241](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-4241)。
- 整项核验：UNVERIFIED；OPEN。

## ADULT-GATE-03 · Gate拒绝后的允许功能和安全退出

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：Gate拒绝后的允许功能和安全退出。
- 状态：资格拒绝；账号允许只读；隐私允许只读；支持可用；退出确认；重进资格读取。
- 交互：停止学习/支付；清理未授权私有状态；保留本人账号/隐私/真实可用客服；允许退出；重进读服务端资格不鼓励改年龄。
- 实际候选：[367:3979](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-3979)、[367:3996](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-3996)、[367:4013](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4013)、[367:4030](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4030)、[367:4047](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4047)、[367:4064](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4064)、[367:4081](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4081)、[367:4098](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4098)、[367:4115](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4115)、[367:4132](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4132)、[367:4149](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4149)、[367:4166](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4166)、[11:332](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-332)、[160:3741](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3741)、[214:5905](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-5905)、[214:6026](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-6026)、[225:7117](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7117)、[225:7236](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7236)、[225:7355](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7355)、[225:7474](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7474)。
- 整项核验：UNVERIFIED；OPEN。

## CONSENT-01 · 签署前动态读取独立发布版本

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：签署前动态读取独立发布版本。
- 状态：读取中；读取失败；版本未知；版本已知未阅读；逐项阅读；选择未填。
- 交互：先取3项各自内容/版本；读不到任一版本不展示签署动作；可选不预选；用途必要性未决保持条件稿；逐项选择不由内容语言覆盖UI语言。
- 实际候选：[90:376](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=90-376)、[90:449](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=90-449)、[90:522](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=90-522)、[90:668](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=90-668)、[165:1709](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1709)、[165:1819](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1819)、[165:1903](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1903)、[165:1987](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1987)、[165:2420](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-2420)。
- 整项核验：UNVERIFIED；OPEN。

## CONSENT-02 · 版本变更、确认回执与能力范围

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：版本变更、确认回执与能力范围。
- 状态：提交中；所需条件不满足；版本冲突；回执已记录；相关能力受限。
- 交互：提交decision/type/version/source；服务器校验资格/版本；409后重新读最新版并重新选择；不把旧选择当新版本同意；拒绝/撤回仅停止相关能力。
- 实际候选：[165:2071](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-2071)、[165:2152](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-2152)、[165:2244](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-2244)、[165:2420](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-2420)、[165:2502](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-2502)、[184:2723](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-2723)、[184:3688](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-3688)。
- 整项核验：UNVERIFIED；OPEN。

## CONSENT-03 · 同意提交未知的原请求查询与安全回访

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：同意提交未知的原请求查询与安全回访。
- 状态：提交未知；查询中；查询失败；明确未记录；已记录；安全离开/回访。
- 交互：未知不重复提交；原请求查询不生成新同意；查询失败保持原请求/当前选择；安全离开到允许账号服务；回访继续查原请求。
- 实际候选：[367:3979](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-3979)、[367:4013](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4013)、[367:4149](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4149)、[165:2584](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-2584)、[165:2666](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-2666)、[165:2338](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-2338)、[214:5905](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-5905)、[214:6026](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-6026)、[214:6147](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-6147)、[214:6268](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-6268)、[225:7117](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7117)、[225:7236](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7236)、[225:7355](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7355)、[225:7474](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7474)。
- 整项核验：UNVERIFIED；OPEN。

## ONB-01 · 四个规范目标和四档每日时长

- 需求：V2-980-0001、V2-980-0002、V2-980-0374、V2-980-0377。
- 页面：四个规范目标和四档每日时长。
- 状态：未选；单选目标；单选5/15/30/45；必填校验；保存中；已保存读回。
- 交互：进入选择；每组互斥选择；未填不提交；保存回执呈现所选；继续定级/获准免测。
- 实际候选：[165:697](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-697)、[165:843](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-843)、[165:1087](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1087)。
- 整项核验：UNVERIFIED；OPEN。

## ONB-02 · 学习语言、界面语言与水平的独立语义

- 需求：V2-980-0375。
- 页面：学习语言、界面语言与水平的独立语义。
- 状态：选择学习语言；UI locale独立；内容不可用；语言缺资源fallback；目标水平。
- 交互：新手选学习语言；不覆盖UI语言；受内容版权与可用语言限制；保存后读回；可回设置。
- 实际候选：[165:697](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-697)、[235:1915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-1915)。
- 整项核验：UNVERIFIED；OPEN。

## ONB-03 · 已保存目标/草稿续填与账号隔离

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：已保存目标/草稿续填与账号隔离。
- 状态：新用户空值；已保存回填；未保存草稿；切账号清隔离；离线草稿说明。
- 交互：再次进入回读已保存事实；区分草稿与已保存；离开确认/继续编辑；切账号不串数据；离线不伪称服务保存。
- 实际候选：[165:697](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-697)、[165:1087](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1087)、[214:3785](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-3785)、[214:4159](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4159)、[214:4279](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4279)。
- 整项核验：UNVERIFIED；OPEN。

## ONB-04 · 目标保存失败、未知、查询失败与安全回访

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：目标保存失败、未知、查询失败与安全回访。
- 状态：已知失败；结果待确认；原请求查询；查询失败；确认未受理；安全离开/回访。
- 交互：保存后不重复提交；未知先查原操作；安全离开保留选择及操作身份；回访仍查原操作；确认未受理才按原约定重试。
- 实际候选：[165:1210](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1210)、[165:1446](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1446)、[165:1564](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1564)、[214:4399](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4399)、[214:4521](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4521)、[214:4640](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4640)、[244:2337](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=244-2337)。
- 整项核验：UNVERIFIED；OPEN。

## ONB-05 · 目标版本冲突比较、保留最新或重应用草稿

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：目标版本冲突比较、保留最新或重应用草稿。
- 状态：409冲突；最新值读回；本地草稿比较；保留最新；确认后新操作。
- 交互：冲突读取最新版本；展示最新/草稿差异；用户决定保留或重应用；新版本新操作确认；不覆盖已保存旧事实。
- 实际候选：[165:1328](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1328)、[214:4763](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4763)、[214:4882](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4882)、[214:5003](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-5003)、[214:5124](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-5124)。
- 整项核验：UNVERIFIED；OPEN。

## PLACE-01 · 10题四维manifest与开始前资格/素材检查

- 需求：V2-980-0003。
- 页面：10题四维manifest与开始前资格/素材检查。
- 状态：未开始；准备检查；可开始；题包/媒体不足；无权限；内容下线。
- 交互：资格通过后读取同一10题snapshot；3词汇+3语法+2阅读+2听力；不可用明确关闭与替代；开始不自行生成题目。
- 实际候选：[12:310](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=12-310)、[170:775](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-775)、[170:895](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-895)、[170:2826](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2826)。
- 整项核验：UNVERIFIED；OPEN。

## PLACE-02 · 逐题单选、跳题、核对修改与保存前后区分

- 需求：V2-980-0003。
- 页面：逐题单选、跳题、核对修改与保存前后区分。
- 状态：未选；已选A/B/C/D；已接收；单题跳过；返回修改；最后题到核对。
- 交互：选择不等于已保存；提交checkpoint确认再推进；单题跳过可回补；核对显示已接收选择；修改回原题再回核对。
- 实际候选：[170:895](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-895)、[170:1033](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-1033)、[170:1171](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-1171)、[170:1309](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-1309)、[170:1447](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-1447)、[170:1585](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-1585)、[170:1723](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-1723)、[170:1861](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-1861)、[170:1999](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-1999)、[170:2140](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2140)、[170:2281](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2281)。
- 整项核验：UNVERIFIED；OPEN。

## PLACE-03 · 检查点中断、断线与版本冲突恢复

- 需求：V2-980-0003。
- 页面：检查点中断、断线与版本冲突恢复。
- 状态：暂停；断线；未接收草稿；已接收检查点；409版本冲突；恢复成功。
- 交互：暂停后回同session/snapshot；已确认题不得倒退；比较本地草稿/服务checkpoint；冲突先读最新不覆盖；恢复时重核资格/内容。
- 实际候选：[170:2944](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2944)、[170:2281](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2281)、[206:7667](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7667)。
- 整项核验：UNVERIFIED；OPEN。

## PLACE-04 · 定级会话终态及撤权后的安全出口

- 需求：V2-980-0003。
- 页面：定级会话终态及撤权后的安全出口。
- 状态：EXPIRED；CANCELLED；AUTO_SUBMITTED；COMPLETED重入；403资格/版权撤销。
- 交互：终态禁止再写旧会话；已完成转同一报告；自动提交查看实际提交状态；过期/取消说明后由用户新建；403保留允许账号服务出口。
- 实际候选：[170:775](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-775)、[170:2944](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2944)、[206:8403](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-8403)、[11:332](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-332)。
- 整项核验：UNVERIFIED；OPEN。

## PLACE-05 · 听力两题可播放与无障碍/媒体异常

- 需求：V2-980-0003。
- 页面：听力两题可播放与无障碍/媒体异常。
- 状态：媒体未就绪；可播放/暂停/重听；缓冲；加载失败；音频缺失；听觉辅助策略未批准。
- 交互：音频版权Ready/Clean才可播放；明确剩余/重听交互；失败可恢复或安全跳过；不把文字替代视同有效听力分；素材缺失不展示虚假播放。
- 实际候选：[170:1999](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-1999)、[170:2140](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2140)、[170:2826](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2826)。
- 整项核验：UNVERIFIED；OPEN。

## PLACE-06 · 整体跳过与保守起点确认

- 需求：V2-980-0005。
- 页面：整体跳过与保守起点确认。
- 状态：跳过确认；取消跳过；SKIPPED基线；UNVERIFIED提示；非权威期望起点。
- 交互：用户明确跳过；取消回未完成会话；仅UNVERIFIED/coverage0/score-null/level-null；可继续保守计划；以后测评创建新结果。
- 实际候选：[25:251](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-251)、[170:3418](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-3418)、[116:556](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-556)。
- 整项核验：UNVERIFIED；OPEN。

## PLACE-07 · 交卷前核对与原提交未知闭环

- 需求：V2-980-0003。
- 页面：交卷前核对与原提交未知闭环。
- 状态：核对；处理中；结果待确认；原提交查询；查询失败；确认未受理；已确认。
- 交互：核对全部题/未答；交卷禁重复；未知查询原submission；未受理才同上下文重试；安全离开保留session/answers/operation。
- 实际候选：[170:2281](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2281)、[170:2464](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2464)、[170:2584](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2584)、[170:3064](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-3064)、[170:3182](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-3182)、[170:3301](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-3301)。
- 整项核验：UNVERIFIED；OPEN。

## PLACE-08 · 定级反馈时点说明与普通练习区分

- 需求：V2-980-0003。
- 页面：定级反馈时点说明与普通练习区分。
- 状态：定级中仅接收提示；正式反馈策略未决；结束解释；普通练习即时反馈。
- 交互：不因本机选择显示权威定级对错；提交后报告依已批准策略；策略未决时明确条件；普通练习仍先保存再反馈。
- 实际候选：[170:895](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-895)、[170:2281](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2281)、[170:2584](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2584)。
- 整项核验：UNVERIFIED；OPEN。

## RESULT-01 · ASSESSED正式报告的信息层级与解释

- 需求：V2-980-0004。
- 页面：ASSESSED正式报告的信息层级与解释。
- 状态：报告生成中；READY报告；部分失败；读取失败；无权限。
- 交互：查看同一reportId/digest不可变快照；分数/参考等级/覆盖率/置信度/四维分开；分数不是覆盖率；非官方认证非精确词汇量；继续首日计划。
- 实际候选：[25:322](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-322)、[170:2584](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2584)、[170:2705](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2705)。
- 整项核验：UNVERIFIED；OPEN。

## RESULT-02 · 跳过报告与零覆盖诚实态

- 需求：V2-980-0005。
- 页面：跳过报告与零覆盖诚实态。
- 状态：SKIPPED；零覆盖；UNVERIFIED；非权威提示。
- 交互：不显示分数或测得等级；说明未测评；可保守开始；可重新测评；保留原跳过baseline。
- 实际候选：[170:3418](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-3418)、[25:251](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-251)、[116:556](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-556)。
- 整项核验：UNVERIFIED；OPEN。

## RESULT-03 · 重测创建新报告、旧报告保留与旧计划确认

- 需求：V2-980-0004。
- 页面：重测创建新报告、旧报告保留与旧计划确认。
- 状态：重测确认；取消；新会话；历史报告；新结果待应用；旧计划保留。
- 交互：从报告主动重测；新session/result不覆盖旧report；保留旧计划与已完成进度；结果变更后预览再确认新计划；取消仍可读旧报告。
- 实际候选：[170:2705](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-2705)、[116:433](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-433)、[214:5604](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-5604)。
- 整项核验：UNVERIFIED；OPEN。

## PLAN-01 · 报告/跳过来源、输入pin与计划生成解释

- 需求：V2-980-0001、V2-980-0262、V2-980-0263、V2-980-0264、V2-980-0265、V2-980-0266、V2-980-0376、V2-980-0423。
- 页面：报告/跳过来源、输入pin与计划生成解释。
- 状态：ASSESSED确认；SKIPPED确认；资格不满足；输入不足；生成中；准备中；READY。
- 交互：展示目标/时长/来源与真实解释；有效pin才生成；目标保存不回滚于计划失败；跳过写初始安排后续调整；planId存在不等于可开始。
- 实际候选：[116:433](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-433)、[116:556](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-556)、[116:678](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-678)、[116:799](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-799)、[116:1401](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-1401)、[116:1523](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-1523)、[161:561](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-561)。
- 整项核验：UNVERIFIED；OPEN。

## PLAN-02 · 首日四态与原生成恢复引用

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：首日四态与原生成恢复引用。
- 状态：NOT_READY；PROCESSING；READY非空；DEGRADED；unknown；查询失败；失败已知。
- 交互：PROCESSING显示回访方法；DEGRADED只读recoveryRef；失败保留原报告和目标；未知查原生成；READY至少1可访问任务且计数一致。
- 实际候选：[116:799](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-799)、[116:918](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-918)、[116:1038](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-1038)、[116:1160](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-1160)、[116:1279](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-1279)、[116:1401](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-1401)、[116:1523](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-1523)、[161:561](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-561)、[298:2667](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=298-2667)。
- 整项核验：UNVERIFIED；OPEN。

## PLAN-03 · 层级计划与学习日历

- 需求：V2-980-0262、V2-980-0263、V2-980-0264、V2-980-0265、V2-980-0266、V2-980-0425。
- 页面：层级计划与学习日历。
- 状态：总目标；月/周目标；今日任务；Checkpoint；周/月日历；无计划/无内容。
- 交互：看目标层级与预计日期；日历选择学习日/休息日/补课日；选日展示实际安排；回今日/地图；无安排解释。
- 实际候选：[359:3447](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3447)、[359:3483](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3483)、[359:3519](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3519)、[359:3555](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3555)、[359:3591](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3591)、[359:3627](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3627)、[359:3663](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3663)、[359:3771](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3771)、[12:457](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=12-457)、[59:1025](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=59-1025)、[198:1673](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-1673)。
- 整项核验：UNVERIFIED；OPEN。

## PLAN-04 · 变更目标/时间/学习日后的重排预览与取消

- 需求：V2-980-0264、V2-980-0265、V2-980-0266。
- 页面：变更目标/时间/学习日后的重排预览与取消。
- 状态：编辑草稿；变更前后预览；保留安排；重新安排确认；取消；完成项/已开始项保护。
- 交互：显示仅未开始可重排；保留已完成及旧快照；用户确认影响再写；取消回当前计划；手动调整提供非拖拽等效操作。
- 实际候选：[368:4087](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4087)、[368:4111](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4111)、[368:4135](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4135)、[368:4159](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4159)、[368:4183](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4183)、[368:4207](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4207)、[368:4363](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4363)、[214:3785](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-3785)、[214:4034](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4034)、[214:5604](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-5604)、[198:1673](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-1673)。
- 整项核验：UNVERIFIED；OPEN。

## PLAN-05 · 重排版本冲突、待确认与原操作恢复

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：重排版本冲突、待确认与原操作恢复。
- 状态：提交中；409冲突；最新planVersion读回；unknown；原请求查询；安全离开/回访；已确认。
- 交互：If-Match锁版本；冲突不覆盖过期计划；比较最新与草稿；重新确认新操作；unknown不二次重排；回访能查询原操作。
- 实际候选：[368:4207](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4207)、[368:4423](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4423)、[368:4447](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4447)、[368:4231](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4231)、[368:4255](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4255)、[368:4279](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4279)、[368:4303](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4303)、[368:4399](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4399)、[368:4363](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4363)、[214:4763](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4763)、[214:4882](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4882)、[198:2045](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-2045)。
- 整项核验：UNVERIFIED；OPEN。

## PLAN-06 · 延期/提前完成/积压与完整任务时间预算解释

- 需求：V2-980-0265。
- 页面：延期/提前完成/积压与完整任务时间预算解释。
- 状态：正常；CATCH_UP；未装入到期项；可延期项；不可延期SRS/验证；提前完成。
- 交互：whole-task装入；15分钟cap17可容16；延期只限获准repair/goal/new/optional；不改SRS/验证dueAt；显示仍待处理数和后续安排；不称欠账或清空积压。
- 实际候选：[359:3591](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3591)、[67:239](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=67-239)、[198:1673](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-1673)、[214:5604](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-5604)。
- 整项核验：UNVERIFIED；OPEN。

## MAP-01 · 地图节点类型、前置锁定与内容门

- 需求：V2-980-0006、V2-980-0007、V2-980-0009。
- 页面：地图节点类型、前置锁定与内容门。
- 状态：可开始；继续中；已完成；前置锁定；复习/普通/Boss/阶段节点；版权失效。
- 交互：节点连真实内容ref；锁定解释前置；可访问才进入课程；失权不渲染原内容；返回图保持视口/当前节点。
- 实际候选：[59:1025](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=59-1025)、[198:1673](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-1673)、[198:1803](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-1803)、[198:1924](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-1924)、[198:2404](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-2404)。
- 整项核验：UNVERIFIED；OPEN。

## MAP-02 · 地图缩放、定位、线性替代与性能降级

- 需求：V2-980-0006、V2-980-0021。
- 页面：地图缩放、定位、线性替代与性能降级。
- 状态：地图默认；放大/缩小；全景/回当前；键盘线性列表；2D低性能；减少动效；加载失败。
- 交互：鼠标/触控/键盘等效可达节点；一键定位当前；缩放保留选择；复杂地图失败转线性路径；低画质减少动效仍可学习。
- 实际候选：[59:1025](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=59-1025)、[198:1673](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-1673)。
- 整项核验：UNVERIFIED；OPEN。

## MAP-03 · 星级/周目标/升级徽章的条件反馈

- 需求：V2-980-0008、V2-980-0013。
- 页面：星级/周目标/升级徽章的条件反馈。
- 状态：无记录；可信完成；1/2/3星；周目标进度；奖励未开放。
- 交互：仅服务可信完成显示；缺规则/奖励门关闭说明；不以本机答题发宝箱；辅助反馈可回继续学习。
- 实际候选：[198:1673](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-1673)、[225:5646](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-5646)。
- 整项核验：UNVERIFIED；OPEN。

## HOME-01 · 首页任务态、继续学习与可解释建议

- 需求：V2-980-0010、V2-980-0011、V2-980-0012。
- 页面：首页任务态、继续学习与可解释建议。
- 状态：未建计划；生成中；有进行中；有新任务；今日完成；无合适内容；无到期；读取失败。
- 交互：优先继续/开始今日；展示服务端分钟与解释；continue核验有效checkpoint；无practiceRef不开始；各空态不同动作；已完成不回旧2/5。
- 实际候选：[2:2](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=2-2)、[67:239](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=67-239)、[11:2](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-2)、[11:68](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-68)、[11:134](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-134)、[11:200](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-200)、[11:266](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-266)、[298:2572](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=298-2572)、[298:2667](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=298-2667)、[321:3350](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=321-3350)。
- 整项核验：UNVERIFIED；OPEN。

## HOME-02 · 按主动目标调整首页与为什么这样排序

- 需求：V2-980-0010。
- 页面：按主动目标调整首页与为什么这样排序。
- 状态：标准首页；零基础/CET/阅读等目标变体；最近使用变化；排序说明。
- 交互：仅主动目标/进度/最近模块驱动；展示排序依据；不使用无关画像/AI/K12；返回同一首页上下文。
- 实际候选：[2:2](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=2-2)、[30:51](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=30-51)。
- 整项核验：UNVERIFIED；OPEN。

## HOME-03 · 关闭自适应、固定模块、编辑顺序与恢复默认

- 需求：V2-980-0010。
- 页面：关闭自适应、固定模块、编辑顺序与恢复默认。
- 状态：自适应开/关；固定/取消固定；编辑排序；未保存/放弃；恢复默认确认；已保存/冲突/unknown。
- 交互：用户可关闭和恢复标准；固定常用模块；拖拽与上下移动等效；预览再保存；恢复默认不删除学习事实；保存未知查原操作。
- 实际候选：[2:2](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=2-2)、[235:1915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-1915)。
- 整项核验：UNVERIFIED；OPEN。

## HOME-04 · 首次引导、跳过、稍后与帮助重看

- 需求：V2-980-0022。
- 页面：首次引导、跳过、稍后与帮助重看。
- 状态：首次欢迎；核心CTA聚光；下一步；跳过/稍后；再次帮助；首项完成后收起。
- 交互：引导依据首项是否完成非注册24h；不遮挡退出；焦点回触发控件；未开放模块不带去不可达页；通知/麦克风按主动场景申请。
- 实际候选：[2:2](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=2-2)、[161:561](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-561)、[161:681](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-681)。
- 整项核验：UNVERIFIED；OPEN。

## TODAY-01 · 新学/到期复习/错题任务、状态与推荐解释

- 需求：V2-980-0012、V2-980-0218、V2-980-0255、V2-980-0256、V2-980-0257、V2-980-0258、V2-980-0259、V2-980-0260、V2-980-0261、V2-980-0424。
- 页面：新学/到期复习/错题任务、状态与推荐解释。
- 状态：待开始；进行中；已完成；due/overdue；无practiceRef；已撤权；部分可用。
- 交互：只列owner投影真实可访问任务；解释primary/secondary原因；任务入口有practiceRef才可点；不能客户端补题干；已完成不重复计次。
- 实际候选：[359:3591](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3591)、[359:3735](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3735)、[359:3627](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3627)、[67:239](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=67-239)、[161:681](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-681)、[161:2754](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-2754)。
- 整项核验：UNVERIFIED；OPEN。

## TODAY-02 · 五种空态和读取异常分流

- 需求：V2-980-0012。
- 页面：五种空态和读取异常分流。
- 状态：NO_PLAN；COMPLETED；NO_CONTENT；NO_DUE_REVIEW；读取失败；离线；403。
- 交互：NO_PLAN设置目标；完成可结束/回顾；无内容看可用课程；无到期新学或结束；失败重试；离线只读stale；403账号/帮助。
- 实际候选：[11:2](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-2)、[11:68](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-68)、[11:134](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-134)、[11:200](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-200)、[11:266](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-266)、[11:332](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-332)、[31:119](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=31-119)、[321:2806](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=321-2806)、[321:2944](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=321-2944)、[321:3082](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=321-3082)、[321:3216](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=321-3216)、[321:3350](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=321-3350)。
- 整项核验：UNVERIFIED；OPEN。

## TODAY-03 · 任务动作确认、断点与重复提交防护

- 需求：V2-980-0011、V2-980-0012。
- 页面：任务动作确认、断点与重复提交防护。
- 状态：开始；暂停恢复；提交中；unknown；冲突；已确认完成；下一任务。
- 交互：以学习owner接收为准；任务/plan/version保持；重复点击不推进两题；离线队列pending不计完成；恢复后回同任务；完成返回最新今日。
- 实际候选：[161:681](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-681)、[161:3113](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-3113)、[161:3352](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-3352)、[161:3591](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-3591)、[161:3710](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-3710)、[161:3828](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-3828)、[161:2754](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-2754)。
- 整项核验：UNVERIFIED；OPEN。

## TODAY-04 · 学习日/时区切换与既有dueAt保护

- 需求：V2-980-0266。
- 页面：学习日/时区切换与既有dueAt保护。
- 状态：学习时区；每周学习日；DST边界说明；休息/补课；跨日刷新；不变的既有dueAt。
- 交互：显示pin时区与学习日；切时区不改旧UTC到期事实；未来计划按新偏好确认；不重复同学习日streak/task；当前已确认记录保留。
- 实际候选：[368:4087](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4087)、[368:4159](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4159)、[368:4363](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=368-4363)、[214:3785](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-3785)、[235:1915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-1915)。
- 整项核验：UNVERIFIED；OPEN。

## HOME-SEARCH-01 · 全局搜索词/语法/文章/错题与安全深链

- 需求：V2-980-0019。
- 页面：全局搜索词/语法/文章/错题与安全深链。
- 状态：空输入/历史；输入建议；分类/混合结果；无结果；加载/失败；离线；已下线/失权目标。
- 交互：全局头部输入进入；按资源分类/查询；保留query/分类/cursor；进入结果先核版权与owner；详情返回原查询；敏感历史可清理。
- 实际候选：[2:2](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=2-2)、[191:3308](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=191-3308)、[191:3436](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=191-3436)。
- 整项核验：UNVERIFIED；OPEN。

## HOME-PROFILE-01 · 顶部个人卡、学习等级与辅助成长摘要

- 需求：V2-980-0413、V2-980-0414、V2-980-0415、V2-980-0416、V2-980-0417、V2-980-0418、V2-980-0419、V2-980-0420、V2-980-0421、V2-980-0422。
- 页面：顶部个人卡、学习等级与辅助成长摘要。
- 状态：已读个人卡；未设置头像/昵称；语言/目标；等级未测评；CEFR参考非官方；XP/streak未开放或无事实；本周有效时长未更新。
- 交互：读本人资料与owner摘要；显示头像/昵称/用户ID/当前语言目标；等级与参考CEFR可解释；时间水位和缺数据说明；可达个人资料/学习偏好；成长Gate不因摘要绕过。
- 实际候选：[2:2](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=2-2)、[214:1720](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-1720)、[235:1915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-1915)。
- 整项核验：UNVERIFIED；OPEN。

## HOME-HISTORY-01 · 学习历史列表、日期详情与继续学习

- 需求：V2-980-0426。
- 页面：学习历史列表、日期详情与继续学习。
- 状态：近期记录；按时间/模块筛选；空记录；某日详情；记录/内容已下线；继续上下文过期；失败/离线缓存。
- 交互：首页/学习日历打开历史；看真实accepted记录与水位；选择记录详情；有合法checkpoint才继续；详情返回原筛选/日期；下线不泄漏内容。
- 实际候选：[359:3699](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3699)、[359:3771](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3771)、[359:3735](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3735)、[306:5767](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5767)、[198:1673](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-1673)、[2:2](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=2-2)。
- 整项核验：UNVERIFIED；OPEN。

## ACCESS-SHARED-LOADING-01 · 弱网骨架与不丢原操作的重试

- 需求：V2-980-0410。
- 页面：弱网骨架与不丢原操作的重试。
- 状态：初次加载骨架；旧数据刷新中；读取失败；离线只读；原写结果未知。
- 交互：读取骨架不闪空；已读数据带时间水位；重试读取同一上下文；写未知只查询原请求；加载可安全离开回访。
- 实际候选：[359:3807](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3807)、[359:3447](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3447)、[359:3843](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=359-3843)、[321:2806](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=321-2806)、[321:2944](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=321-2944)、[116:799](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=116-799)、[165:843](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-843)。
- 整项核验：UNVERIFIED；OPEN。

## ACCESS-NEGATIVE-MINOR-01 · Phase1排除儿童/家长/监护/K12/未成年人支付

- 需求：V2-980-0398、V2-980-0399、V2-980-0400、V2-980-0401、V2-980-0402。
- 页面：Phase1排除儿童/家长/监护/K12/未成年人支付。
- 状态：成人未通过；受限解释；允许账号/隐私/支持；退出。
- 交互：拒绝不创建子女/家长/监护主体；不跳未成年支付或K12替代目标；只保留安全账号服务；如未来Phase3单独Gate。
- 实际候选：[367:3979](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-3979)、[367:3996](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-3996)、[367:4013](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4013)、[367:4030](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4030)、[367:4098](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4098)、[367:4115](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4115)、[367:4132](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4132)、[367:4166](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=367-4166)、[160:3741](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3741)、[11:332](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=11-332)、[160:3907](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3907)。
- 整项核验：UNVERIFIED；OPEN。

## WS-COURSE-01 · 课程包目录、分类与可信课程信息

- 需求：V2-980-0014。
- 页面：课程目录/有结果、筛选抽屉或页；课程详情显示总学习项、词汇数、预计耗时及授权版本。
- 状态：初次加载；无可访问课程；有课程无筛选结果；筛选草稿与已应用条件；401/403/503/410/404；离线已缓存时间；1024重排。
- 交互：选择出行/职场/商务/学术或目标/等级→应用条件→目录→课程详情；清空条件回全部合法课程；返回保留查询与滚动位置。
- 实际候选：[379:22481](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-22481)。
- 整项核验：UNVERIFIED；OPEN。

## WS-COURSE-02 · 机场、餐厅和酒店场景单元

- 需求：V2-980-0015、V2-980-0016、V2-980-0017。
- 页面：场景包目录和详情；机场10标准单元、餐厅/酒店单元；LearningItem→Lesson→Scenario→Course层级内的词块、精听、预编角色、句子重组、快测、checkpoint。
- 状态：未开始/可续学/单元完成；前置未解锁及理由；单元无授权内容；部分素材缺失；断点冲突；场景素材/功能未开放。
- 交互：包详情→单元→词块学习→场景精听→预编角色→快测→已确认checkpoint→下一单元；普通版本升级保留原pin；强停阻止被撤回素材。
- 实际候选：[379:22481](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-22481)、[379:22517](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-22517)、[379:22589](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-22589)、[379:22625](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-22625)。
- 整项核验：UNVERIFIED；OPEN。

## WS-COURSE-03 · 场景通关测试与学习凭证

- 需求：V2-980-0018。
- 页面：全单元完成后的综合测验入口；规则结果、达标/未达标与通关徽章记录。
- 状态：尚有必需单元未完成；评估/报告生成中；80阈值上/下；奖励资格未开放/待确认；已领取/同键回放；内容权利撤销。
- 交互：必需单元确认完成→通关测验→规则反馈→服务端确认凭证/徽章或明确条件关闭；失败可进入有依据的复习任务，不直接新增奖励。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WS-VOC-01 · 合法词书目录与单一主词书切换

- 需求：V2-980-0023、V2-980-0024、V2-980-0053、V2-980-0054、V2-980-0055、V2-980-0056、V2-980-0057、V2-980-0058、V2-980-0059、V2-980-0060、V2-980-0061。
- 页面：按授权来源的9类词书目录；词书详情和激活主词书确认；切换成功与历史保留摘要。
- 状态：当前主词书；切换预览/取消；保存中/未知/原请求查询；确认成功但计划重排处理中；失效授权/空词书/旧版本冲突。
- 交互：选词书→详情→确认设为主词书→查询原激活→确认后主词书标记；多词书并行阅读，但只有1本进入主计划；切换不清除掌握和历史。
- 实际候选：[378:7652](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7652)、[378:8636](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-8636)、[378:8549](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-8549)、[378:8578](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-8578)。
- 整项核验：UNVERIFIED；OPEN。

## WS-VOC-02 · 完整词条、词性、释义、例句和私人笔记

- 需求：V2-980-0025、V2-980-0026、V2-980-0027、V2-980-0028、V2-980-0062、V2-980-0063、V2-980-0064、V2-980-0065、V2-980-0066、V2-980-0067、V2-980-0068、V2-980-0069、V2-980-0070。
- 页面：单词详情；US/UK音标与合法常慢速音频；中英释义/词性/2-3例句与译文、搭配；熟练度/最近与下次复习/私人笔记。
- 状态：真实字段缺失而非占位伪造；无合法音频/播放失败；授权/版本信息；私人笔记空/编辑/本地/保存待确认/冲突；释义服务失败保留原来源。
- 交互：目录词条→释义例句展开→必要音频播放；编辑私人笔记→保存/原请求查询→确认后仅本人可读；返回不丢原词书上下文。
- 实际候选：[378:7688](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7688)。
- 整项核验：UNVERIFIED；OPEN。

## WS-VOC-03 · 词条发音入口与2D/3D可降级示范

- 需求：V2-980-0029。
- 页面：词条发音详情进入对应音素；2D舌位/唇形与文字说明；高画质模型和低配/减少动效替代。
- 状态：源音频或口型不可用；性能降级/用户关闭动效；可播放但用户尚未激活；版权撤销。
- 交互：主动点击发音入口→同音素示范→暂停/关闭→原词条；低配默认2D并保留同等文字信息。
- 实际候选：[378:12301](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-12301)、[378:7688](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7688)。
- 整项核验：UNVERIFIED；OPEN。

## WS-VOC-04 · 词根词缀、衍生词与预制词族关系图

- 需求：V2-980-0030、V2-980-0031、V2-980-0050、V2-980-0051。
- 页面：词根主题目录；根词+词缀拆解；可展开词族关系和词性/含义/例句侧栏；线性关系列表替代/快测/词族拼图入口。
- 状态：关系未展开/已展开；无衍生关系；图形失败转线性；键盘节点可达；素材/版本不可用。
- 交互：选词根→展开派生树→选词显示词性意义例句→回原展开位置；前后缀拆解与衍生关系有版本来源；不做向量或AI生成。
- 实际候选：[378:7796](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7796)、[378:7688](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7688)。
- 整项核验：UNVERIFIED；OPEN。

## WS-VOC-05 · 易混淆词、同反义词与差异比较

- 需求：V2-980-0032。
- 页面：词条关联列表；并排易混词对照；例句语境/差异字母标注与练习入口。
- 状态：无已发布关联；可比较与返回；内容更新/撤销。
- 交互：点易混词→比较→阅读用法/例句→对应练习或返回。
- 实际候选：[378:7688](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7688)、[378:7760](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7760)。
- 整项核验：UNVERIFIED；OPEN。

## WS-VOC-06 · 词汇/句块SRS与回忆质量解释

- 需求：V2-980-0033、V2-980-0034、V2-980-0035、V2-980-0036、V2-980-0037、V2-980-0047、V2-980-0052。
- 页面：主动回忆→翻面→0/1/2/3四级输入；下次复习时间/记忆趋势解释；逾期队列平滑与上限说明；异常刷词非权威提醒。
- 状态：提前翻面与提前复习分别处理；逾期/无到期项；提交未知/冲突；服务端接受数量与本地待同步分离。
- 交互：SRS质量输入→确认收据→下一卡→本批完成；展示algorithmVersion和owner已确认dueAt；记忆曲线只解释风险、不硬编码固定间隔。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WS-VOC-07 · 词汇训练15种交互与受保护反馈

- 需求：V2-980-0038、V2-980-0039、V2-980-0040、V2-980-0041、V2-980-0042。
- 页面：看词选义/看义选词/听音选词/听音拼写；中英回忆、缺字补全、字母重排、例句挖空；词义匹配/同义选择/词根派生/闪卡/易混对比/连续拼写。
- 状态：未答/选中/校验失败；保存中/未知/查询；已确认正确/需要再练；无音频不启动听辨；题包不足关闭。
- 交互：题型选择→与LearningItem一致的题目→保存确认→文字反馈与下一题；键盘重排与拖拽提供等效操作；无AI评分。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WS-VOC-08 · 个人词库检索、标签、掌握筛选与批量复习

- 需求：V2-980-0043、V2-980-0044、V2-980-0045、V2-980-0427。
- 页面：个人库列表与来源；难度/掌握/时间/标签筛选；多选加入复习计划和仅复习我的生词；历史变化只读与移除确认。
- 状态：尚未收藏/筛选无结果；0/1/多选；系统薄弱项与主动收藏分开；待同步/确认/未知/冲突；D7证据不足不标已掌握。
- 交互：收藏或源词→个人库→筛选→多选→预览加入复习→确认→同一队列；移除仅影响个人库/获准范围，不删除历史assessment或强制到期项。
- 实际候选：[378:8906](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-8906)、[378:9050](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-9050)。
- 整项核验：UNVERIFIED；OPEN。

## WS-VOC-09 · 句块详情与独立表达学习

- 需求：V2-980-0046、V2-980-0428。
- 页面：短语/搭配/句型/完整例句的统一详情；场景、关键词、例句、常见错误、发音；句块训练入口与独立复习状态。
- 状态：字段缺失；音频不可用；当前LearningItem类型/版本；未加入/已加入复习。
- 交互：单词相关搭配或句块目录→详情→训练/复习→返回原来源。
- 实际候选：[378:7832](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7832)。
- 整项核验：UNVERIFIED；OPEN。

## WS-VOC-10 · 句子挖掘、表达库与来源往返

- 需求：V2-980-0048、V2-980-0049、V2-980-0429、V2-980-0430。
- 页面：原句选中菜单/面板；收藏整句或句块、我想会说、私人备注、加入SRS；表达库按场景/来源/熟练度/标签过滤；原音重播及返回准确段落/课程。
- 状态：未收藏/编辑草稿/已收藏；同句重复收藏幂等；保存未知/冲突；原内容撤权或失效；来源可用/不可用。
- 交互：阅读/听力选句→挖掘编辑→保存回执→表达库→返回同一contentVersion及段落；原音不可用不伪播放；收藏不改变阅读完成事实。
- 实际候选：[379:19105](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-19105)、[378:9122](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-9122)、[378:8906](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-8906)、[380:9937](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-9937)、[379:21333](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-21333)、[380:10047](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10047)。
- 整项核验：UNVERIFIED；OPEN。

## WS-GRM-01 · 语法知识树全分类与先修依赖

- 需求：V2-980-0071、V2-980-0083、V2-980-0084、V2-980-0085、V2-980-0086、V2-980-0087、V2-980-0088、V2-980-0089、V2-980-0090、V2-980-0091、V2-980-0092、V2-980-0093、V2-980-0094。
- 页面：词法/句法知识树；12类基础到长句分类/展开；先修锁定理由与当前节点状态。
- 状态：部分加载/空分类；锁定/可学/短期/长期/即将遗忘；无掌握证据；版权/阶段拒绝；图失败线性列表。
- 交互：展开分类→选节点→知识点→返回保持展开与位置；先修节点有解释，客户端不能手改掌握状态。
- 实际候选：[354:3184](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=354-3184)、[354:3290](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=354-3290)。
- 整项核验：UNVERIFIED；OPEN。

## WS-GRM-02 · 规则卡、例句、陷阱与关联知识

- 需求：V2-980-0072、V2-980-0073、V2-980-0095、V2-980-0096、V2-980-0097、V2-980-0098、V2-980-0099、V2-980-0100、V2-980-0101、V2-980-0102。
- 页面：一句话规则/展开解释；正例、反例、易错点、公式；关联知识与对应练习。
- 状态：解释折叠/展开；无关联知识；练习不足/未开放；语法内容版本变化。
- 交互：选知识点→展开公式/例句→陷阱比较→关联节点或本点练习。
- 实际候选：[354:3450](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=354-3450)、[354:3514](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=354-3514)。
- 整项核验：UNVERIFIED；OPEN。

## WS-GRM-03 · 结构训练及仿写的确定性规则交互

- 需求：V2-980-0074、V2-980-0075、V2-980-0081、V2-980-0082、V2-980-0103、V2-980-0104、V2-980-0105、V2-980-0106。
- 页面：单选/多选/填空/改错；句型转换/重组/从句识别/成分涂色/时间轴/结构树拼装；黄金句型结构模板/替换槽位/参考答案。
- 状态：可操作控件当前值；不能判定时规则参考+自评；拖拽失败键盘替代；答案保存待确认；非color-only组件标签。
- 交互：结构编辑或填答→版本化规则比对→参考/原因→下一步；自由文本仅规则比对、自评，不能包装成智能总分。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WS-GRM-04 · 弱点图谱、依据解释与靶向强化

- 需求：V2-980-0076、V2-980-0077。
- 页面：语法节点正确率/弱点依据；知识依赖图与风险/掌握解释；生成靶向10题包/无可用题包说明。
- 状态：证据不足WEAKNESS_UNKNOWN；有依据弱点/无当前弱点；投影更新中；前置未解锁；10题不足/策略未开放。
- 交互：选择弱点→看源attempt/维度依据→预览强化→创建/恢复任务→回弱点；D7等权威门未满足不宣称长期掌握；不凭颜色生成诊断。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WS-GRM-05 · 预制长句切片、句法下钻与线性替代

- 需求：V2-980-0078、V2-980-0079、V2-980-0080。
- 页面：主干/主谓宾定状补/连接词/修饰范围分块；点击从句下钻；逐句慢常速朗读与成分同步；线性文本替代。
- 状态：图未加载/可展开/已展开；节点选中；无合法朗读资源；减少动效/高对比；版权撤销。
- 交互：选成分→说明/从句展开→返回上级；合法音频主动播放→对应毫秒片段高亮；不可用保留可读结构。
- 实际候选：[354:3599](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=354-3599)、[354:3673](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=354-3673)、[354:3764](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=354-3764)、[354:4066](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=354-4066)。
- 整项核验：UNVERIFIED；OPEN。

## WS-LST-01 · 播放器毫秒字幕、循环、连续倍速与保音高

- 需求：V2-980-0107、V2-980-0108、V2-980-0113、V2-980-0114、V2-980-0115、V2-980-0116、V2-980-0117。
- 页面：材料播放器；毫秒字幕列表、当前句定位；0.5-2.0连续值+6档快捷、A-B/单句循环、延迟字幕；授权/来源/文本替代面板。
- 状态：未播放/播放/暂停/缓冲/加载失败；播放范围与循环开关；字幕提前/延迟/隐藏；不支持保音高设备降级；素材非READY/CLEAN、缺字幕/文本、撤权。
- 交互：主动播放→定位句→设A/B→循环→调连续速度→退出仍保留同一内容毫秒位置；文本替代不冒充听力已完成；先媒体Gate后播放器。
- 实际候选：[378:10268](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-10268)、[378:10304](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-10304)、[378:10340](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-10340)。
- 整项核验：UNVERIFIED；OPEN。

## WS-LST-02 · 听力雷达音变与听辨专项

- 需求：V2-980-0109、V2-980-0121、V2-980-0122、V2-980-0123、V2-980-0124、V2-980-0125、V2-980-0126、V2-980-0127、V2-980-0128。
- 页面：声音难点目录/筛选；连读弱读失爆重音/数字时间人名地名/最小对立音示例；规则声音标记与自编听辨任务。
- 状态：无授权材料/无匹配；选音变标签；无音频文本替代；题目保存中/待确认；只有自评时无客观分数。
- 交互：选难点→听例音与规则标记→听辨/听写→解释→回当前难点。
- 实际候选：[378:10412](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-10412)。
- 整项核验：UNVERIFIED；OPEN。

## WS-LST-03 · 单词/短句/段落听写与确定性差异

- 需求：V2-980-0110、V2-980-0111、V2-980-0118、V2-980-0119、V2-980-0129、V2-980-0130、V2-980-0131、V2-980-0132、V2-980-0133、V2-980-0134。
- 页面：三级听写任务与输入；逐词挖空/完整输入；保存后按版本化匹配显示差异、漏词/多词/大小写标点策略；错词复习入口。
- 状态：空输入/输入中/字符校验；保存确认后差异；规则忽略大小写或部分标点；未知先查原提交；音频/文本授权缺失。
- 交互：听授权音频→输入→提交确认→差异→重听/练错/下一段；答案未接收前不显示正确答案；局部音频/字幕失败转安全替代。
- 实际候选：[379:17771](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17771)、[379:17915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17915)、[379:17843](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17843)。
- 整项核验：UNVERIFIED；OPEN。

## WS-LST-04 · 错词进入个人库与句子挖掘

- 需求：V2-980-0120。
- 页面：听力错误词列表；选择加入个人库/句块SRS；收藏当前字幕句、来源往返。
- 状态：无错词；已存在/新加入；保存中/未知；授权撤销停止原音。
- 交互：已确认听写/听辨错词→预览加入库→owner收据→同一听力上下文。
- 实际候选：[379:17915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17915)、[378:9122](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-9122)、[380:9937](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-9937)。
- 整项核验：UNVERIFIED；OPEN。

## WS-MEDIA-CLIP-01 · 授权Language Clips完整学习流程

- 需求：V2-980-0112。
- 页面：20-90秒自制/授权短片目录及版权说明；第一遍无字幕→第二遍英字幕；字幕查词/收藏表达/逐句循环/降速；shadowing→理解测试→相关项复习。
- 状态：音视频/封面/字幕分别版权可用；无字幕/英文字幕/当前句；播放失败/低配降级；无合法素材诚实关闭；离线版权拒绝；撤权立即停。
- 交互：短片详情→无字幕看→英字幕回看→句子操作→理解测验→owner确认进度/复习；各步骤共享同contentVersion，字幕查词不泄露题目答案。
- 实际候选：[379:21297](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-21297)、[379:21333](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-21333)、[379:21405](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-21405)、[379:21477](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-21477)、[380:9937](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-9937)、[380:10047](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10047)。
- 整项核验：UNVERIFIED；OPEN。

## WS-RDG-01 · 分级文章目录与真实内容指标

- 需求：V2-980-0135、V2-980-0139、V2-980-0140、V2-980-0141、V2-980-0142、V2-980-0143。
- 页面：文章目录；语学星等级/参考CEFR/词数或词汇难度/文章长度/句法复杂度筛选；文章详情和最近确认位置。
- 状态：空目录/无筛选结果；内容版本/指标未知；可开始/可续读；401/403/下线；加载失败/缓存时间。
- 交互：筛选→文章详情→开始/续读→回目录保留条件；指标显示实际content事实，词数可核对不编造能力等级。
- 实际候选：[379:18925](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-18925)。
- 整项核验：UNVERIFIED；OPEN。

## WS-RDG-02 · 沉浸阅读、查词、句法、双语与阅读进度

- 需求：V2-980-0136、V2-980-0144、V2-980-0145、V2-980-0146、V2-980-0147、V2-980-0148、V2-980-0149、V2-980-0150、V2-980-0151、V2-980-0153。
- 页面：可读正文/段落定位；即点查词/加入生词本/重点词；句子结构展开与双语切换；合法段落音频/计时/进度；两道理解题与完成摘要。
- 状态：原文/双语；查词加载失败不清正文；未经授权无音频；仅本地/待同步/确认；理解题未完不可已完成；内容普通更新/强停。
- 交互：阅读定位→查词/句法→返回原段落→理解题→已确认结果→下一步；滚动到底/计时结束不等于完成；required quiz完成后由owner确认。
- 实际候选：[379:18925](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-18925)、[379:19033](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-19033)、[379:19069](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-19069)、[380:9937](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-9937)、[380:10047](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10047)、[379:19105](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-19105)。
- 整项核验：UNVERIFIED；OPEN。

## WS-RDG-03 · 阅读字号、行距与主题控制

- 需求：V2-980-0137、V2-980-0152。
- 页面：阅读设置面板；字体大小/行距/亮暗高对比/跟随系统；恢复默认和阅读焦点位置。
- 状态：当前选择文字可见；长文重排/200%文本；面板关闭后原段落；减少动效/高对比。
- 交互：打开设置→调字号/行距/主题→正文真实重排→关闭回同段；UI locale与contentLocale不互相覆盖；长词/英文文本有合理断行。
- 实际候选：[379:18997](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-18997)、[379:19177](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-19177)、[379:19213](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-19213)、[379:19393](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-19393)。
- 整项核验：UNVERIFIED；OPEN。

## WS-RDG-04 · 章节故事、预制分支与路径保留

- 需求：V2-980-0138、V2-980-0154、V2-980-0155、V2-980-0156、V2-980-0157、V2-980-0158。
- 页面：故事目录/章节锁定；旅行/城市/大学/职场/科技/悬疑/科幻/喜剧分类；故事阅读与预制选择；已选路径、章节理解测试与解锁。
- 状态：未开始/可续读；分支未选/已确认；章节未解锁理由；无后续内容/结局；普通更新保留路径/强停。
- 交互：章节→阅读→选择预制分支→保存确认→后续章节/结局；分支只改变已发布故事路径，不生成自由内容；不直接将选择当学习掌握。
- 实际候选：[379:20516](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-20516)、[379:20552](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-20552)、[379:20588](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-20588)、[379:20624](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-20624)。
- 整项核验：UNVERIFIED；OPEN。

## WS-SPK-01 · 48音标实验室、2D口型与最小对立音

- 需求：V2-980-0159、V2-980-0160、V2-980-0161、V2-980-0176、V2-980-0177、V2-980-0178、V2-980-0179、V2-980-0180、V2-980-0181、V2-980-0182、V2-980-0183。
- 页面：20元音+28辅音分类图谱；选音素显示口型/舌位/要领/常见错误/合法示范；最小对立音AB比较/点读测试；低配2D/文字降级与录音自评入口。
- 状态：当前音素/分类；原声不可用/权限拒绝；2D/3D或减少动效；有/无可用最小对立对；用户自评非AI分。
- 交互：分类→音素→示范与文字→最小对立比较→点读/自评→返回原音素。
- 实际候选：[378:12265](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-12265)、[378:12301](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-12301)。
- 整项核验：UNVERIFIED；OPEN。

## WS-SPK-02 · 跟读录音、原声AB回听与本地/远端资产

- 需求：V2-980-0162、V2-980-0165、V2-980-0166、V2-980-0167、V2-980-0168、V2-980-0169、V2-980-0170。
- 页面：主动录音专用同意/用途版本；设备允许/拒绝/不支持；录音/停止/重录/取消；原声与本音波形AB/循环/速度/自评；仅本地加密草稿/上传intent/处理中/已远端保存/历史。
- 状态：未同意不可录；拒绝仍静音练习；设备被占用/中断/无有效音频；本地与远端分态；上传未知查原intent/失败保留安全副本；自评待确认/报告生成中。
- 交互：主动录音→录音专用consent校验→麦克风→本地录音→AB回听→选择上传/仅本地→自评→owner确认attempt；media recording asset与assessment attempt分别有状态，不从录音直接写SRS/mastery。
- 实际候选：[378:13579](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-13579)、[378:13615](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-13615)、[378:13759](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-13759)、[378:13867](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-13867)。
- 整项核验：UNVERIFIED；OPEN。

## WS-SPK-03 · Shadowing连续跟读与整体回听

- 需求：V2-980-0163、V2-980-0171、V2-980-0172、V2-980-0173、V2-980-0174、V2-980-0175。
- 页面：连续原声与字幕延迟设置；关键重音/语流标记；分段或整体录音；完成后整体回听与用户自评。
- 状态：0.5s默认延迟或当前值；连续播放/暂停/分段续练；设备中断恢复；无录音替代；音频撤权立即停止。
- 交互：设置延迟→主动播放跟读→暂停/继续同句→整体回听→自评→保存确认。
- 实际候选：[378:13759](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-13759)、[378:13867](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-13867)。
- 整项核验：UNVERIFIED；OPEN。

## WS-SPK-04 · 预编角色A/B情景会话

- 需求：V2-980-0164、V2-980-0184、V2-980-0185、V2-980-0186、V2-980-0187、V2-980-0188。
- 页面：10场景目录/5注册原子场景；角色A/B选择；固定系统台词→用户选择/朗读→预制分支；分段录音/无录音替代与完成回顾。
- 状态：角色未选/已选；固定分支选项；本段未确认/已完成；无后续素材/下线；保存未知/恢复原分支。
- 交互：场景→角色→系统固定台词→用户朗读或选预制回应→分支→完成回顾；角色切换需确认对本轮影响；不启AI/RTC或开放自由社交。
- 实际候选：[378:12553](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-12553)、[378:12589](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-12589)。
- 整项核验：UNVERIFIED；OPEN。

## WS-WRT-01 · 汉译英任务、规则比对与自评

- 需求：V2-980-0189、V2-980-0190、V2-980-0194、V2-980-0195、V2-980-0196、V2-980-0197、V2-980-0198、V2-980-0199。
- 页面：任务目录/等级/主题/版本；中文题干+英文编辑器；确认后参考译文、关键词与结构对照；自评记录、再次练习/报告。
- 状态：空输入/校验不足保留输入；参考答案未解锁；提交保存/判定中/未知原查询；匹配/不匹配/规则无法判断；自评与客观分数分开。
- 交互：选中文任务→英文输入→保存确认→参考/关键词/结构对照→用户自评→确认回执；自由输入只给确定性规则和参考，不以相似度伪造权威分数。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WS-WRT-02 · 模板仿写、替换槽位、扩写与段落拼接

- 需求：V2-980-0191、V2-980-0200、V2-980-0201、V2-980-0202、V2-980-0203。
- 页面：议论文/书信模板目录；结构骨架/模板用途；关键词替换、句子扩写、段落拼接；规则结构比对/参考示例。
- 状态：槽位未填/有输入/校验失败；模板材料不足/版权限制；保存未知/版本冲突；规则无法处理转参考自评。
- 交互：选模板→理解骨架→填替换槽位/扩写/拼接→规则对照→修订/保存。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WS-WRT-03 · 病句定位、修改与规则解析

- 需求：V2-980-0192、V2-980-0204、V2-980-0205、V2-980-0206、V2-980-0207。
- 页面：预制错误材料；选择错误范围/错误类型；修订输入/参考正确句；确认后规则解析与下一题。
- 状态：未定位/已定位；未修改/有修改/校验失败；保存中/未知/原查询；正确/需修改/规则不适用。
- 交互：看预制错误→定位→修改→保存确认→解析→重练或下一题。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WS-WRT-04 · 写作素材库、检索筛选与来源插入

- 需求：V2-980-0193、V2-980-0208、V2-980-0209、V2-980-0210、V2-980-0211、V2-980-0212、V2-980-0213。
- 页面：连接词/搭配/句型/主题词/表达/段落结构目录；标签/主题/类型筛选与例句用途；收藏到个人表达库；从编辑器打开素材并带出处插入/返回。
- 状态：空库/无结果；授权内容不可用；已收藏/保存待确认；来源失效/无匹配。
- 交互：写作打开素材→筛选→详情/使用例→选择插入/收藏→回原草稿光标位置。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WS-WRT-05 · 写作草稿版本、历史与冲突恢复

- 需求：V2-980-0214。
- 页面：草稿列表/历史版本；当前编辑与本地/云端保存状态；版本比较、恢复副本/使用云端/保留本地；已提交作品与规则反馈历史。
- 状态：新草稿/已确认草稿；草稿保存中/未知/原查询失败；离线只保存获准本地draft；409冲突/另一设备较新；已提交只读/新revision。
- 交互：编辑→显式保存草稿→版本回执→历史→比对→恢复为新版本或取消；正式提交与保存草稿分开；迟到回调不覆盖新稿；已提交结果不可原地修改。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-HUB-01 · 练习中心聚合及来源可解释入口

- 需求：V2-980-0218。
- 页面：继续原练习；到期复习；错题修复；快速练习；阶段验收/模考入口。
- 状态：有数据；任务更新中；关闭技能解释。
- 交互：trigger: 进入专项练习/今日来源；result: 读取owner候选且显示来源、预估时长、真实确认进度；safeReturn: 进入原practiceRef；返回今日不新建任务。
- 实际候选：[364:3794](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-3794)、[12:529](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=12-529)、[64:1526](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=64-1526)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-HUB-02 · 练习中心空/错误/无权独立

- 需求：V2-980-0218。
- 页面：无计划；今日完成；无可学内容；暂无到期；加载失败；401/403。
- 状态：空；加载；错误；离线；权限。
- 交互：trigger: 候选查询返回各分支；result: 给出具体原因，不把错误/无权显示为空；safeReturn: 重试原读取/进入可用课程/今日。
- 实际候选：[12:529](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=12-529)、[64:1526](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=64-1526)、[306:5901](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5901)、[306:6027](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-6027)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-QUICK-01 · 3/5/10/20分钟一次性预算选择

- 需求：V2-980-0226。
- 页面：快速练习预算选择；摘要预览。
- 状态：未选；已选；不可用预算说明。
- 交互：trigger: 我现在有几分钟；result: 仅创建一次性练习预算，不修改每日5/15/30/45；safeReturn: 取消返回原hub，保留原计划。
- 实际候选：[364:3830](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-3830)、[364:3866](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-3866)、[364:3902](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-3902)、[364:3938](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-3938)、[364:3974](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-3974)、[378:7479](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7479)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-QUICK-02 · 快速训练领域选择与合法组合

- 需求：V2-980-0226。
- 页面：只练单词；只练听力；全部混合；任务预览。
- 状态：可用组合；某技能关闭；无适配内容；准备中。
- 交互：trigger: 选择预算/领域；result: 只组合有权合法任务；解释选择依据/总时长；safeReturn: 换预算或返回hub，不伪造听力可用。
- 实际候选：[364:3830](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-3830)、[364:4010](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-4010)、[364:4046](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-4046)、[364:3938](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-3938)、[364:3974](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-3974)、[378:7479](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7479)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-QUICK-03 · 快速训练建单/恢复/完成闭环

- 需求：V2-980-0226、V2-980-0219。
- 页面：开始训练；已有进行中轮次；本批小结。
- 状态：创建中；结果未知；查询；已确认未受理；内容撤销；完成。
- 交互：trigger: 开始快速训练；result: 同一创建身份查询/恢复，确认接受后进原session；safeReturn: 稍后继续保留预算、题序、已确认进度；结束返回hub。
- 实际候选：[364:4082](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-4082)、[364:4118](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-4118)、[364:4154](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-4154)、[364:4190](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-4190)、[364:4226](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-4226)、[364:4262](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-4262)、[364:4298](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-4298)、[364:4334](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=364-4334)、[378:7479](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7479)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-STAGE-01 · 阶段能力Checkpoint资格与说明

- 需求：V2-980-0227。
- 页面：阶段验收介绍；模块/题量/完成规则；前置条件/解锁原因。
- 状态：未满足前置；可开始；内容未就绪；版权/阶段拒绝。
- 交互：trigger: 地图区域/课程包/阶段结束；result: 解释验收维度和next-stage gate，展示服务端内容规则；safeReturn: 回来源节点或对应复习。
- 实际候选：[369:4243](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4243)、[369:4279](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4279)、[369:4675](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4675)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-STAGE-02 · 阶段验收测验与结果

- 需求：V2-980-0227。
- 页面：测验会话；提交确认；结果模块分/薄弱项/解锁结论。
- 状态：进行中；未答完；提交未知；查询；判分中；报告失败；已确认结果。
- 交互：trigger: 资格与内容均可用后开测；result: 按固定内容规则和合法题包出结果；不虚构缺题/解锁；safeReturn: 未通过进入修复，已通过回原阶段；保留原report。
- 实际候选：[369:4315](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4315)、[369:4908](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4908)、[369:4351](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4351)、[369:4387](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4387)、[369:4423](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4423)、[369:4459](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4459)、[369:4567](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4567)、[369:4603](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4603)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-STAGE-03 · Checkpoint失败→修复→延迟复测→再次测验

- 需求：V2-980-0227、V2-980-0221、V2-980-0222、V2-980-0223、V2-980-0435。
- 页面：阶段薄弱项；变式修复；复测条件；再次阶段测验。
- 状态：等待合法内容；D1/D7未到期；失败重开；可复测。
- 交互：trigger: 阶段未通过；result: 跟踪来源验收与知识点；新测验新session，旧结果保留；safeReturn: 回阶段/修复队列，不当场自评放行。
- 实际候选：[369:4639](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4639)、[369:4675](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4675)、[369:4603](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4603)、[192:2766](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2766)、[192:3487](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3487)、[192:3730](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3730)、[192:4092](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4092)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-EXAM-01 · CET-4/6自研模拟卷与题型训练目录

- 需求：V2-980-0228、V2-980-0235、V2-980-0236、V2-980-0238、V2-980-0239、V2-980-0240、V2-980-0241、V2-980-0244。
- 页面：CET卷目录；单项训练；试卷详情/版权来源。
- 状态：无卷；筛选无匹配；未发布；版权撤回；内容不可用；加载/错误/权限。
- 交互：trigger: CET学习目标或考试训练入口；result: 只显示自研/开放许可/合法授权材料；不宣称官方题库；safeReturn: 回练习hub/可用单项训练。
- 实际候选：[369:4989](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-4989)、[369:5025](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5025)、[370:5611](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5611)、[370:5647](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5647)、[370:5683](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5683)、[370:5719](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5719)、[370:5739](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5739)、[370:5759](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5759)、[370:5795](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5795)、[370:5831](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5831)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-EXAM-02 · 模考准备、计时规则及听力可用性

- 需求：V2-980-0228、V2-980-0237、V2-980-0238、V2-980-0245、V2-980-0246。
- 页面：模考准备；分区时间说明；音频检查/文本替代政策。
- 状态：设备/媒体不可用；内容缺失；可开始；开始结果未知。
- 交互：trigger: 打开试卷；result: 明确总/分区计时、暂停/自动提交规则、授权音频状态；safeReturn: 未满足条件不开始计时，返回试卷目录/合法单项。
- 实际候选：[369:5025](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5025)、[369:5061](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5061)、[369:5361](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5361)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-EXAM-03 · 模考答题工作区、题卡跳转与疑问标记

- 需求：V2-980-0231、V2-980-0245、V2-980-0246、V2-980-0247、V2-980-0248。
- 页面：计时答题；分区导航；已答/未答/标记题卡。
- 状态：未答；已答；疑问标记；当前题；保存/网络恢复。
- 交互：trigger: 进入已建模考会话；result: 题卡按同一session选择跳转，保留逐题答案与标记；safeReturn: 离开确认→同一计时和checkpoint恢复；不重置考试。
- 实际候选：[369:5061](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5061)、[369:5757](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5757)、[369:5085](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5085)、[369:5121](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5121)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-EXAM-04 · 模考交卷、到时自动交卷和未知结果查询

- 需求：V2-980-0249、V2-980-0219。
- 页面：未答题交卷确认；手动提交；到时自动交卷；原交卷查询。
- 状态：SUBMITTING；AUTO_SUBMITTED；未知；确认未受理；已接受/判分中；过期终态。
- 交互：trigger: 手动交卷/可信到时事实；result: 保持原submissionId摘要；自动与手动幂等汇合；safeReturn: 未知阶段只查原请求；查看原结果不再次开考。
- 实际候选：[369:5121](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5121)、[369:5145](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5145)、[369:5169](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5169)、[369:5193](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5193)、[369:5217](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5217)、[369:5241](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5241)、[369:5265](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5265)、[369:5325](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5325)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-EXAM-05 · 模考结果、历史成绩与错题回流

- 需求：V2-980-0232、V2-980-0242、V2-980-0243、V2-980-0250、V2-980-0251、V2-980-0252、V2-980-0253、V2-980-0254、V2-980-0436。
- 页面：模考结果；题型得分/用时；历史成绩曲线；来源题目/错题详情。
- 状态：报告生成中；部分数据；无历史；无可信对比样本；失败/无权。
- 交互：trigger: 模考判分确认；result: 本人版本化成绩/题型弱项；无可信样本不编全国排名；safeReturn: 来源题、修复、试卷目录；不覆盖旧成绩。
- 实际候选：[369:5289](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5289)、[369:5325](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5325)、[192:1282](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1282)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-EXAM-06 · 切屏/失焦只作非权威提示，不处罚

- 需求：V2-980-0230。
- 页面：切屏说明/继续；结果无作弊定罪。
- 状态：检测不可用；返回会话。
- 交互：trigger: 页面失焦或切屏兼容信号；result: 不影响分数、奖励、封禁或报告权威事实；safeReturn: 恢复同一会话。
- 实际候选：[369:5061](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5061)、[369:5121](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5121)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-EXAM-07 · 考研模考阶段边界

- 需求：V2-980-0229。
- 页面：考研模考关闭说明/条件设计。
- 状态：Phase2未准入。
- 交互：trigger: 目标或旧深链到考研模考；result: 解释尚未开放，保留Phase2条件设计；safeReturn: 可用CET/普通练习。
- 实际候选：[369:5397](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=369-5397)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SESSION-01 · 建单/内容与规则版本pin/查看旧结果

- 需求：V2-980-0215、V2-980-0219。
- 页面：练习准备；进行中；旧结果只读；明确新轮次。
- 状态：加载；内容不足；本人权限拒绝；旧版本继续/紧急撤回。
- 交互：trigger: 来源practiceRef进入；result: 同内容重复开单复用进行中session；明确重练新轮次；safeReturn: 恢复最近确认checkpoint/回来源。
- 实际候选：[161:3999](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-3999)、[161:6350](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-6350)、[198:3278](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3278)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SESSION-02 · 普通题提交保存确认、行内反馈和明确下一题

- 需求：V2-980-0215、V2-980-0216、V2-980-0217。
- 页面：未答；已选；待保存；保存后规则反馈；下一题。
- 状态：输入无效422保留输入；提交中禁重入；已保存/反馈。
- 交互：trigger: 本题有效作答后确认；result: 服务端确认保存后才显示对错与解释；答案不提前泄露；safeReturn: 退出/返回保持本题已确认状态。
- 实际候选：[161:4244](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-4244)、[161:4490](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-4490)、[187:1028](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-1028)、[187:2879](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-2879)、[187:3245](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-3245)、[187:3657](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-3657)、[189:1096](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=189-1096)、[189:3567](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=189-3567)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SESSION-03 · 超时未知先查原请求，确认未接收才同身份恢复

- 需求：V2-980-0215、V2-980-0219。
- 页面：结果待确认；查询原提交；查询失败；确认未受理；确认已保存；安全稍后处理。
- 状态：unknown；querying；query-error；not-received；accepted。
- 交互：trigger: 写请求超时或响应丢失；result: 保留session/题/选择/submission身份；同原键查回执；safeReturn: 安全主页/原来源再进恢复同操作，无重复提交。
- 实际候选：[161:5838](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-5838)、[161:5959](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-5959)、[161:6080](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-6080)、[161:7582](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-7582)、[161:7703](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-7703)、[161:7824](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-7824)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-CHECKPOINT-01 · 断点保存范围与原会话恢复

- 需求：V2-980-0215。
- 页面：保存状态；暂停/恢复；断点列表/详情。
- 状态：本页未提交；仅本地(获准时)；待同步；已同步。
- 交互：trigger: 退出/刷新/任务切换/重新进入；result: 按同session、snapshot和最后服务端确认题恢复；无attemptId仍可保存；safeReturn: 确认保存后离开；未提交选择范围清楚。
- 实际候选：[198:2541](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-2541)、[198:3157](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3157)、[206:7667](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-7667)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-CHECKPOINT-02 · 多tab/多设备版本冲突及终态分流

- 需求：V2-980-0215。
- 页面：冲突比较；读取最新；本地未提交差异；另端已完成只读结果。
- 状态：stale/baseVersion；same-version-different-digest；终态禁止覆盖；读取失败。
- 交互：trigger: 旧checkpoint写入/另一端已推进；result: 保留已接受答案；显式比较不静默last-write-wins；safeReturn: 原任务最新安全恢复点/只读原结果。
- 实际候选：[198:2913](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-2913)、[198:3035](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3035)、[198:3157](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3157)、[198:3889](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3889)、[198:4010](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4010)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-CHECKPOINT-03 · 授权离线、内容更新/撤回、身份变化安全出口

- 需求：V2-980-0215。
- 页面：授权缓存只读；内容强停；旧快照继续；会话/身份失效。
- 状态：离线；内容普通更新；紧急撤权；401/403；expired。
- 交互：trigger: 恢复或继续前检查当前授权；result: 合法旧pin继续；强停停止分发；身份变化取消旧回调；safeReturn: 可用课程/今日，不显示被撤回内容。
- 实际候选：[198:4129](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4129)、[198:4256](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4256)、[198:4376](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4376)、[198:4497](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4497)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SESSION-04 · session/attempt/report/下游投影分态

- 需求：V2-980-0219、V2-980-0220。
- 页面：本轮小结；已接受判分中；报告生成中；错题/SRS投影更新中。
- 状态：ACCEPTED；ASSESSING；ASSESSED；GENERATING；READY；PARTIAL；FAILED。
- 交互：trigger: 源作答已接受而下游仍慢；result: 不要求重做，不将已保存回滚成失败，不伪造积分掌握；safeReturn: 查看原请求/任务，稍后返回原报告。
- 实际候选：[161:6201](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-6201)、[161:7945](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-7945)、[192:2026](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2026)、[192:2147](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2147)、[198:3889](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3889)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SRS-01 · 到期队列与预算剩余/空/无记录/失败分开

- 需求：V2-980-0037。
- 页面：到期队列；本批2卡；暂无到期；尚无记录；剩余待复习。
- 状态：有数据；空；超预算剩余；读取错误；403。
- 交互：trigger: 进入SRS/今日复习；result: 按owner到期事实和预算分批，不改dueAt或伪称清完；safeReturn: 返回今日/新学/结束。
- 实际候选：[306:2664](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-2664)、[306:5901](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5901)、[306:6027](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-6027)、[385:14928](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=385-14928)、[385:14952](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=385-14952)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SRS-02 · 主动回忆、翻面、四级信心与客观约束

- 需求：V2-980-0035、V2-980-0036。
- 页面：回忆前面；已回忆；揭晓/解释；四级信心。
- 状态：未答揭晓→0；错答cap1；猜对cap2；客观确认→raw。
- 交互：trigger: 用户回忆/揭晓/自评；result: 分别显示自评与可信客观反馈；不得自报掌握；safeReturn: 未确认不推进下一卡，暂停恢复同卡。
- 实际候选：[306:2915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-2915)、[306:3040](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-3040)、[306:3161](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-3161)、[306:4033](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-4033)、[306:4158](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-4158)、[306:4279](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-4279)、[381:12623](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=381-12623)、[381:12647](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=381-12647)、[385:15000](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=385-15000)、[385:15024](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=385-15024)、[385:15048](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=385-15048)、[385:15072](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=385-15072)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SRS-03 · 原review确认收据后推进与下一次时间

- 需求：V2-980-0036。
- 页面：待确认；原review查询；确认收据；下一卡；本批报告。
- 状态：unknown；not-received；accepted；all-required-accepted。
- 交互：trigger: 确认本卡评分；result: 唯一owner收据更新本卡0/2→1/2→2/2，展示服务端下次时间；safeReturn: 结果未知保留原reviewEvent；不跳过卡或重复计数。
- 实际候选：[306:3412](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-3412)、[306:3535](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-3535)、[306:3660](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-3660)、[306:3783](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-3783)、[306:4530](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-4530)、[306:4653](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-4653)、[306:4778](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-4778)、[306:4901](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-4901)、[306:5637](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5637)、[381:12623](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=381-12623)、[381:12647](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=381-12647)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SRS-04 · 提前复习阻断与普通额外练习分开

- 需求：V2-980-0036。
- 页面：未到期说明；额外练习入口；下次到期。
- 状态：EARLY_REVIEW_NOT_ALLOWED。
- 交互：trigger: 服务端时间早于dueAt；result: 不推进本算法排程；额外练习只记普通attempt；safeReturn: 回队列/今日，不绕过到期Gate。
- 实际候选：[306:3290](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-3290)、[306:4408](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-4408)、[306:6150](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-6150)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SRS-05 · 暂停/安全返回/再进保留原卡与未知review

- 需求：V2-980-0036。
- 页面：稍后处理；暂停继续；原请求查询。
- 状态：question；recalled；revealed；unknown；early。
- 交互：trigger: 练习中退出或结果未知离开；result: 保留batch/card/selection/q/request身份；已确认项不可重复结算；safeReturn: 原SRS入口恢复，不重置为旧3/10样例。
- 实际候选：[306:2793](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-2793)、[306:3910](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-3910)、[306:5026](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5026)、[306:5149](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5149)、[306:5271](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5271)、[306:5393](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5393)、[306:5515](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5515)、[381:12623](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=381-12623)、[381:12647](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=381-12647)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SRS-06 · 复习历史、算法版本、遗忘回退原因和撤销边界

- 需求：V2-980-0034、V2-980-0037。
- 页面：复习历史；本批报告；回落原因；静态撤销条件说明。
- 状态：无历史；已接受；未来排程非已完成；版本冲突。
- 交互：trigger: 查看历史/本批报告；result: 显示真实完成/延期/算法解释；不把系统延迟算遗忘，不删不可变记录；safeReturn: 回队列或今日。
- 实际候选：[306:5637](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5637)、[306:5767](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5767)、[381:12623](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=381-12623)、[381:12647](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=381-12647)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SRS-07 · 记忆曲线展示与权威排程分开

- 需求：V2-980-0034。
- 页面：记忆曲线；历史变化；解释和文本替代。
- 状态：无历史；有限数据；更新中。
- 交互：trigger: 打开item记忆曲线；result: 解释性图层，非医学预测；间隔来自版本化owner算法；safeReturn: 回词卡/复习历史。
- 实际候选：[370:5083](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5083)、[306:5767](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-5767)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-MISTAKE-01 · 独立错题本与领域/类型/来源/错因筛选

- 需求：V2-980-0220、V2-980-0225、V2-980-0431。
- 页面：错题列表；8域来源筛选；错误类型筛选；只练本类。
- 状态：有记录；筛选无匹配；尚未练；已练全对；投影更新中；错误/无权。
- 交互：trigger: hub/报告/今日进入错题本；result: 同一错题事实底座；显示筛选和数量的真实投影；safeReturn: 清筛选/原报告/继续修复。
- 实际候选：[370:4867](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4867)、[370:4903](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4903)、[370:4939](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4939)、[192:2766](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2766)、[192:2897](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2897)、[192:3015](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3015)、[192:3133](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3133)、[192:3251](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3251)、[192:3369](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3369)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-MISTAKE-02 · 原题、作答、规则、来源与错误历史明细

- 需求：V2-980-0220、V2-980-0225。
- 页面：错题详情；语义错因；来源题/attempt；首次/最近/次数/下次验证。
- 状态：可读；内容撤回但历史保留；权限失效。
- 交互：trigger: 点开错题；result: 题型失败分类不替代语义错因；其他备注非权威；safeReturn: 原筛选列表/来源报告。
- 实际候选：[370:4975](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4975)、[192:3487](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3487)、[46:1764](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=46-1764)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-MISTAKE-03 · 规则回顾与合法变式，不用原题冒充

- 需求：V2-980-0221、V2-980-0432。
- 页面：回顾规则；合法变式准备；变式练习；暂无变式。
- 状态：variant有权可用；WAITING_FOR_CONTENT；下线替代。
- 交互：trigger: 开始修复；result: 同LearningItem规则的合法变式/情境等价；缺货保留原错误；safeReturn: 回错题/其他可用练习，不捏造修复通过。
- 实际候选：[192:3487](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3487)、[192:3611](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3611)、[124:610](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=124-610)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-MISTAKE-04 · 修复任务中断恢复和一次修复不等于掌握

- 需求：V2-980-0221、V2-980-0224。
- 页面：进行中修复；确认本次修复；恢复原repair任务。
- 状态：已确认进度；unknown；查询；稍后继续。
- 交互：trigger: 修复退出或提交未知；result: 同任务恢复；自评非验证，已确认结果不可重做销账；safeReturn: 原修复入口保留进度和操作身份。
- 实际候选：[192:3487](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3487)、[192:3730](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3730)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-VERIFY-01 · D1排期、未到期禁用与独立验证会话

- 需求：V2-980-0222。
- 页面：D1待到期；D1可验证；D1验证会话；D1结果。
- 状态：scheduled；due；passed；failed；WAITING_FOR_CONTENT。
- 交互：trigger: 当场修复确认后/到期任务；result: D1=修复当地日期之后第1配置学习日；由owner给dueAt；safeReturn: 未到期回队列；通过去D7排期，失败REOPENED。
- 实际候选：[192:3730](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3730)、[192:3851](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3851)、[192:3973](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3973)、[192:4453](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4453)、[192:4689](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4689)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-VERIFY-02 · D7排期、未到期禁用与独立验证会话

- 需求：V2-980-0223。
- 页面：D7待到期；D7可验证；D7验证会话；D7结果。
- 状态：scheduled；due；passed；failed；WAITING_FOR_CONTENT。
- 交互：trigger: D1 PASS后/到期任务；result: nominal=D1 PASS当地日期+7日，顺延至配置学习日；保留时区与nominal/scheduled；safeReturn: 返回验证队列；失败重新修复。
- 实际候选：[192:4092](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4092)、[192:4213](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4213)、[192:4335](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4335)、[192:4571](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4571)、[192:4807](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4807)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-VERIFY-03 · D7通过仍不满足掌握Gate的REOPENED解释

- 需求：V2-980-0224。
- 页面：掌握依据；证据不足；D7 PASS但mastery gate未满足；REOPENED回修复。
- 状态：LEARNING；MASTERED；CONSOLIDATED；MASTERY_GATE_NOT_MET。
- 交互：trigger: 延迟验证结果确认；result: 至少3不同localDate qualifying evidence、D7 PASS与分数门满足后才晋级；无自报直写；safeReturn: 继续合法修复/SRS，保留D7结果事实。
- 实际候选：[192:4335](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4335)、[192:4925](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4925)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-MISTAKE-05 · 弱点与错因7/30天分布、依据不足

- 需求：V2-980-0220、V2-980-0224、V2-980-0225。
- 页面：弱点聚合；错因分布；7/30天窗口；高频优先修复。
- 状态：有依据；数据不足；投影更新中；错误/权限。
- 交互：trigger: 打开弱点/错因分析；result: 本人来源事实、窗口、水位及解释；不编造心理推断；safeReturn: 只练该类/来源记录/原报告。
- 实际候选：[370:4579](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4579)、[370:4759](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4759)、[370:4651](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4651)、[370:4723](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4723)、[192:4925](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4925)、[192:2766](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2766)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-REPORT-01 · 日报/周报/阶段报告目录、窗口与筛选

- 需求：V2-980-0233、V2-980-0437。
- 页面：报告目录；daily；weekly；phase；筛选/无匹配。
- 状态：ready；empty；loading；processing；partial；failed；forbidden。
- 交互：trigger: 报告入口/指定窗口；result: 显示固定时区、起止窗口、生成时间与当前版本；safeReturn: 原条件返回/清筛选/今日。
- 实际候选：[192:1282](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1282)、[192:1413](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1413)、[192:1538](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1538)、[192:1660](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1660)、[192:1782](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1782)、[192:1908](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1908)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-REPORT-02 · 指标分子分母与owner水位，不平均百分比

- 需求：V2-980-0233。
- 页面：指标明细；来源水位；正确率/任务完成率/验证通过率。
- 状态：有数据；分母0→N/A；事实缺失→null/PROCESSING。
- 交互：trigger: 查看报告指标；result: 仅accepted owner事实；creditedSeconds不以本地计时冒充；safeReturn: 原report；来源事实/等待刷新。
- 实际候选：[192:1413](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1413)、[192:1538](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1538)、[192:1660](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1660)、[192:2026](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2026)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-REPORT-03 · 报告生成延迟、部分、失败和原任务恢复

- 需求：V2-980-0233。
- 页面：正在生成；查询任务；部分数据；生成失败；无记录。
- 状态：GENERATING；PARTIAL；FAILED；NOT_APPLICABLE。
- 交互：trigger: 报告未完成/水位缺失；result: 已保存作答仍成功；缺失metric不计0；不要求重答；safeReturn: 原报告任务查询/安全主页再进/客服。
- 实际候选：[192:2026](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2026)、[192:2147](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2147)、[192:2502](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2502)、[192:2384](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2384)、[298:2667](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=298-2667)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-REPORT-04 · 历史快照固定与迟到事实新版本重建

- 需求：V2-980-0233。
- 页面：历史版本；新版本提示；生成关系/重建原因。
- 状态：vOld只读；vNew ready；rebuild processing。
- 交互：trigger: 晚到事实或规则纠错；result: 新reportVersion+supersedes；不静默改旧报告和已分享快照；safeReturn: 原历史版本/当前版本明确切换。
- 实际候选：[192:2265](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-2265)、[192:1413](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1413)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-REPORT-05 · 报告回题目/来源任务/错因/修复/SRS/计划

- 需求：V2-980-0232、V2-980-0233、V2-980-0254。
- 页面：来源任务；来源attempt/题；错因详情；推荐修复；SRS/继续计划。
- 状态：来源失效；内容撤回；owner拒绝；本报告只读。
- 交互：trigger: 点来源/修复/继续；result: 保持原report和来源身份；新练习明确新轮次；safeReturn: 返回原报告窗口/版本，不落旧示例进度。
- 实际候选：[192:1282](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1282)、[192:3487](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-3487)、[306:2664](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-2664)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-REPORT-06 · 规则教练建议及数据不足起步提示

- 需求：V2-980-0233。
- 页面：下周建议；建议依据/窗口；数据不足。
- 状态：有证据；不足；更新中。
- 交互：trigger: 查看报告建议；result: 可解释规则，非生成AI/非认证结论；safeReturn: 对应合法练习/计划。
- 实际候选：[192:1413](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1413)、[192:1660](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-1660)、[192:4925](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4925)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-REPORT-07 · 分享最小字段/授权/预览/创建撤销原请求恢复

- 需求：V2-980-0234。
- 页面：关闭Gate；条件配置；预览；unknown/query；active；revoke；guest expired/revoked/forbidden。
- 状态：default closed；create unknown；revoke unknown；expired；revoked。
- 交互：trigger: 本人主动分享；result: 标题/窗口最小字段，无token/完整私人报告；不可枚举引用、TTL/撤销保持条件策略；safeReturn: 原报告；访客不进本人私域。
- 实际候选：[319:2724](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=319-2724)、[319:2857](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=319-2857)、[319:3959](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=319-3959)、[319:4091](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=319-4091)、[319:4480](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=319-4480)、[319:4746](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=319-4746)、[319:4874](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=319-4874)、[319:5710](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=319-5710)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-REPORT-08 · 月报需求与当前DAILY/WEEKLY/PHASE读模型差异

- 需求：V2-980-0233。
- 页面：月报关闭说明或已批准月窗口映射；月指标/能力雷达目标稿。
- 状态：policy待确认；数据不足；明确非官方能力图。
- 交互：trigger: 历史PRD月报入口；result: 不可把phase替代月报或悄悄造新reportKind；说明待确认与可用周报；safeReturn: 可用报告目录。
- 实际候选：[370:5867](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5867)、[370:5903](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5903)、[370:5939](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5939)、[370:5975](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5975)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-TYPE-01 · 词义正反选择、例句挖空与同义辨析

- 需求：V2-980-0038、V2-980-0040、V2-980-0075、V2-980-0103。
- 页面：看词选义/看义选词模式；例句上下文选词；语法辨析。
- 状态：未选；已选；正确；错误；unknown/query；422/409。
- 交互：trigger: 选择对应题型；result: 字段映射和选项规则明确；模式不同不串答案；safeReturn: 原题型与来源任务。
- 实际候选：[161:3999](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=161-3999)、[187:2879](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-2879)、[214:6404](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-6404)、[382:12545](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-12545)、[382:12569](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-12569)、[382:12593](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-12593)、[382:12617](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-12617)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-TYPE-02 · 听音辨词、听音拼写与缺字补全

- 需求：V2-980-0039、V2-980-0042。
- 页面：授权音频选择；音频拼写；缺字输入。
- 状态：媒体未就绪；加载/播放失败；错误拼写反馈；输入校验保留；unknown/query。
- 交互：trigger: 主动播放后答题；result: 无音频不假播放；完整/缺字输入规则分别解释；safeReturn: 回原练习或合法文字替代。
- 实际候选：[187:3657](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-3657)、[382:12689](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-12689)、[382:12713](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-12713)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-TYPE-03 · 字母重排与连续拼写训练

- 需求：V2-980-0041、V2-980-0042。
- 页面：字母序列选择/撤回；键盘等价；连续拼写进度。
- 状态：空序列；已组词；无效/错误；正确；中断恢复。
- 交互：trigger: 进入anagram/拼写挑战；result: 保留字符顺序和当前轮次；每次确认后推进；safeReturn: 原字符序列与已确认题。
- 实际候选：[187:4134](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-4134)、[187:3657](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-3657)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-TYPE-04 · 多选、填空和改错的完整输入/错误/恢复

- 需求：V2-980-0074、V2-980-0104、V2-980-0105、V2-980-0106、V2-980-0215。
- 页面：多选0/1/n项；填空空/有效/错误；改错修改位置/替换输入。
- 状态：校验保留输入；正确/错误规则反馈；unknown/query；409安全恢复。
- 交互：trigger: 普通练习提交；result: 保留选择与每个输入；未受理才重试同身份；safeReturn: 原题同选择/草稿。
- 实际候选：[187:1028](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-1028)、[187:2879](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-2879)、[187:3245](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=187-3245)、[382:12713](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-12713)、[382:12857](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-12857)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-TYPE-05 · 图文/词义配对的非拖拽等价与恢复

- 需求：V2-980-0216。
- 页面：逐左逐右配对；键盘选择等价；已选配对关系；错误定位。
- 状态：未完整；已完整；错误；pending/query；未保存退出。
- 交互：trigger: 配对题；result: 文字描述图像意义；未全配不可交；关系错误可修复；safeReturn: 恢复同一关系集合。
- 实际候选：[189:1096](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=189-1096)、[189:1884](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=189-1884)、[189:2273](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=189-2273)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-TYPE-06 · 4–6块语序/从句成分重组与替代操作

- 需求：V2-980-0081、V2-980-0217。
- 页面：4–6词块多层次序；上移/下移/放置等价；重置确认。
- 状态：初始；局部排序；完整；错误；unknown/query。
- 交互：trigger: 句子重组；result: 不只两词交换；词块/从句层级清晰，键盘可完成；safeReturn: 原排序/层级集合。
- 实际候选：[189:3567](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=189-3567)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-TYPE-07 · 句型转换、结构仿写与规则反馈自评

- 需求：V2-980-0082。
- 页面：给定结构/提示；转换或仿写输入；规则比对/参考表达；自评。
- 状态：空草稿；输入校验；保存未知；仅规则参考非AI；历史。
- 交互：trigger: 结构转换或仿写；result: 规则无法权威评分时只给规则比对/参考/自评；safeReturn: 本任务草稿或来源语法点。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-TYPE-08 · 从句识别、成分标注、时间轴与结构树拼装

- 需求：V2-980-0081。
- 页面：从句范围选择；成分文字标签加色；时间轴选择；结构树节点装配/列表等价。
- 状态：未选；已选；错误定位；确认反馈；恢复原结构。
- 交互：trigger: 对应语法训练模式；result: 状态不只靠颜色，图形结构有文本等价，不以排序2词替代；safeReturn: 原语法点/该模式选择。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SRS-08 · 单词与句块独立item排程和重复/旧事件拒绝

- 需求：V2-980-0033、V2-980-0047。
- 页面：item来源与算法解释；逐项排程收据；冲突恢复。
- 状态：词/句块独立；同event同hash复用；旧seq/base/content拒绝。
- 交互：trigger: 提交词或句块review；result: 同解释器不同item独立状态；不跨对象复用旧收据；safeReturn: 原batch/item。
- 实际候选：[306:2664](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-2664)、[306:3783](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-3783)、[306:4901](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=306-4901)、[385:14904](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=385-14904)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-SRS-09 · 批量刷词异常频率限制与保留当前作答

- 需求：V2-980-0052。
- 页面：操作过快等待；原提交查询；安全继续。
- 状态：429/限流；等待期；已接受回执。
- 交互：trigger: 服务端明确频率限制；result: 不把系统重试/失焦当作弊，不抹已接受结果；safeReturn: 保留本卡/原请求稍后查询。
- 实际候选：[385:14856](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=385-14856)、[385:14880](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=385-14880)、[385:14976](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=385-14976)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-MASTERY-01 · 记忆中心四入口与7天趋势

- 需求：V2-980-0433。
- 页面：今日复习；即将遗忘；我的错题；长期掌握；7天变化及文本。
- 状态：有据计数；数据不足；投影更新中；读取错误/无权。
- 交互：trigger: 进入记忆与掌握中心；result: 显示owner来源各计数和水位；风险只是解释，不医学预测；safeReturn: 接既有SRS/错题/掌握列表。
- 实际候选：[370:4579](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4579)、[370:4615](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4615)、[370:5083](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5083)、[192:4925](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4925)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-MASTERY-02 · 全局掌握图谱、弱点图、节点证据与靶向包

- 需求：V2-980-0076、V2-980-0077、V2-980-0434。
- 页面：全局知识图/列表等价；节点详情；证据来源/阶段；靶向练习预览。
- 状态：NEW/LEARNING/MASTERED/CONSOLIDATED；证据不足；更新中；无合法变式。
- 交互：trigger: 点掌握或弱点节点；result: 证据/版本/窗口与下一合法动作明确；不自评晋级；safeReturn: 回同图节点与筛选，进入关联练习可回。
- 实际候选：[370:4651](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4651)、[370:4687](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4687)、[370:5119](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-5119)、[370:4723](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4723)、[370:4759](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4759)、[370:4795](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4795)、[370:4831](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=370-4831)、[192:4925](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=192-4925)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-PRACTICE-MASTERY-03 · 专项与交错练习模式区分

- 需求：V2-980-0077、V2-980-0226、V2-980-0432。
- 页面：专项/交错模式；合法混合预览；来源解释。
- 状态：有可用内容；不足以交错；准备中；关闭技能。
- 交互：trigger: Quick或掌握中心开始练习；result: 近期/薄弱/即忘内容混合，避免连续同类靠上下文猜题，不生成新题；safeReturn: 回来源节点与练习预算。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WG-01 · 成长入口与学习出口独立

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：成长入口与学习出口独立。
- 状态：默认关闭旧链接说明；允许时只读摘要；loading/error/401/403/offline stale；返回学习/练习。
- 交互：学习辅助入口→资格与分项Gate→摘要或关闭原因→今日/练习；关闭不得抢首页主CTA。
- 实际候选：[194:4170](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-4170)、[383:17616](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17616)。
- 整项核验：UNVERIFIED；OPEN。

## WG-02 · XP/星币来源、等级与账本分录

- 需求：V2-980-0267、V2-980-0271、V2-980-0289、V2-980-0290、V2-980-0291、V2-980-0292、V2-980-0293、V2-980-0294、V2-980-0300、V2-980-0301、V2-980-0302、V2-980-0303、V2-980-0304、V2-980-0305、V2-980-0306、V2-980-0307、V2-980-0308、V2-980-0309、V2-980-0310、V2-980-0311、V2-980-0312、V2-980-0313、V2-980-0314。
- 页面：XP/星币来源、等级与账本分录。
- 状态：已确认余额/结算中分开；XP/星币筛选；原分录来源；补偿分录；无记录与读取失败不同。
- 交互：摘要→XP/星币流水→指定来源/时间/规则→返回原筛选；补偿追加展示，不覆写历史；无现金/付费随机入口。
- 实际候选：[194:4170](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-4170)、[194:4314](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-4314)、[194:4710](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-4710)、[383:17972](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17972)、[383:18095](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18095)、[383:19104](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19104)、[383:22677](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22677)、[383:22729](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22729)。
- 整项核验：UNVERIFIED；OPEN。

## WG-03 · 连续学习、断签、补签和保护日

- 需求：V2-980-0268、V2-980-0269、V2-980-0270、V2-980-0295、V2-980-0296、V2-980-0297、V2-980-0298、V2-980-0299。
- 页面：连续学习、断签、补签和保护日。
- 状态：按学习日/时区的日历；已完成/未完成/断签；7/30/100/365里程碑；补签资格/余额/处理中/重复/确认失败；周末保护未签策略关闭。
- 交互：日历→规则/日期详情→有资格才申请补签→原请求查询→确认后读回新日历；离线不改连续天数；返回学习。
- 实际候选：[194:5070](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-5070)、[383:18706](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18706)、[383:18797](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18797)、[383:18850](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18850)、[383:18897](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18897)、[383:18962](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18962)、[383:19027](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19027)、[383:19067](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19067)、[383:19104](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19104)、[383:19162](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19162)、[383:19202](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19202)、[383:19267](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19267)、[383:19321](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19321)、[383:19386](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19386)、[383:19433](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19433)、[383:19529](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19529)。
- 整项核验：UNVERIFIED；OPEN。

## WG-04 · 每日/每周成长任务与成就

- 需求：V2-980-0272、V2-980-0273、V2-980-0274、V2-980-0313、V2-980-0314、V2-980-0315、V2-980-0316、V2-980-0317、V2-980-0318、V2-980-0319、V2-980-0320、V2-980-0321、V2-980-0322、V2-980-0323、V2-980-0324、V2-980-0438。
- 页面：每日/每周成长任务与成就。
- 状态：每日/周任务；不同成就类别；未达标/已达标待结算/可领取/已领取；无证据/能力未开/读取失败；日/周界和规则版本。
- 交互：任务/勋章列表→目标/来源/进度明细→真实学习入口→服务端回执→领取→原请求查询→账本；无任务与读取失败分开。
- 实际候选：[194:4170](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-4170)、[383:17616](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17616)、[383:17719](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17719)、[383:17792](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17792)、[383:17862](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17862)、[383:17921](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17921)、[383:17972](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17972)、[383:18019](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18019)、[383:18058](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18058)、[383:18095](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18095)、[383:18152](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18152)、[383:18192](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18192)、[383:18239](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18239)、[383:18286](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18286)、[383:18333](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18333)、[383:18436](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-18436)。
- 整项核验：UNVERIFIED；OPEN。

## WG-05 · 学习空间、赛季及奖励时间边界

- 需求：V2-980-0287、V2-980-0288。
- 页面：学习空间、赛季及奖励时间边界。
- 状态：空间未开放/空空间/已有布置；高画质/静态降级；赛季未开始/进行/结算/已到账/结束；规则未签关闭。
- 交互：世界→本人学习空间/赛季规则→已有解锁资产/指定赛季→领取原请求→账本→学习；无确定规则不承诺日期。
- 实际候选：[194:4170](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-4170)、[383:19805](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19805)、[383:19876](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19876)、[383:19969](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19969)、[383:20031](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20031)、[383:20085](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20085)、[383:20137](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20137)、[383:20199](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20199)、[383:20276](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20276)、[383:20338](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20338)、[383:20407](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20407)、[383:20476](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20476)、[383:20545](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20545)、[383:20614](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20614)、[383:20683](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20683)、[383:20777](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20777)。
- 整项核验：UNVERIFIED；OPEN。

## WG-06 · 游戏目录、版本及P0/P1/LONG_TERM分层

- 需求：V2-980-0275、V2-980-0276、V2-980-0277、V2-980-0278、V2-980-0325、V2-980-0326、V2-980-0327、V2-980-0328、V2-980-0329、V2-980-0330、V2-980-0331、V2-980-0332、V2-980-0333、V2-980-0334。
- 页面：游戏目录、版本及P0/P1/LONG_TERM分层。
- 状态：当前关闭；P0 Sentence Train可准入目录；P1三款disabled；长期扩展disabled；版本/内容不足；空目录/错误/无权。
- 交互：默认学习路由不展示未开放游戏→旧链接关闭→条件目录审查→服务端允许的学习关联题包→开始；其它只放次级规划。
- 实际候选：[383:22270](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22270)、[383:22395](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22395)、[383:22442](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22442)、[383:22536](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22536)、[383:22583](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22583)、[383:22924](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22924)、[383:23055](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23055)。
- 整项核验：UNVERIFIED；OPEN。

## WG-07 · Sentence Train操作、离开与无障碍替代

- 需求：V2-980-0275、V2-980-0333、V2-980-0334。
- 页面：Sentence Train操作、离开与无障碍替代。
- 状态：未选/第一词/两种顺序；更改/撤销；未提交离开确认；词块长文本/键盘点击替代拖拽；减少动效/静态结果。
- 交互：开始→逐块选择/撤销→确认提交；未提交离开确认保草稿或明确放弃；反馈文字与状态不只靠动画。
- 实际候选：[383:22270](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22270)、[383:22833](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22833)、[383:22924](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22924)、[383:23055](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23055)、[383:23186](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23186)、[383:23279](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23279)。
- 整项核验：UNVERIFIED；OPEN。

## WG-08 · 对局开局、核验、待确认与奖励结算

- 需求：V2-980-0275、V2-980-0333、V2-980-0334。
- 页面：对局开局、核验、待确认与奖励结算。
- 状态：开局失败/题包过期/资格失效；提交unknown/query/fail/not-received/confirmed；结果核验拒绝与网络失败不同；奖励结算pending/posted/rejected。
- 交互：同一gameSession/contentPin→同请求提交→未知只查原请求→确认对错→单独查奖励账本；已结算不重复领奖；确认违规才给原因/真实客服。
- 实际候选：[206:4154](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-4154)、[206:4518](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-4518)、[206:4762](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-4762)、[206:5126](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-5126)、[383:22395](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22395)、[383:22489](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22489)、[383:22536](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22536)、[383:22583](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22583)、[383:22630](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22630)、[383:22677](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22677)、[383:22729](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22729)、[383:22781](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22781)。
- 整项核验：UNVERIFIED；OPEN。

## WG-09 · 空间类型、房间目录与入座

- 需求：V2-980-0335、V2-980-0336、V2-980-0344、V2-980-0351、V2-980-0352、V2-980-0353、V2-980-0354、V2-980-0355、V2-980-0356、V2-980-0357、V2-980-0358、V2-980-0443、V2-980-0447、V2-980-0449。
- 页面：空间类型、房间目录与入座。
- 状态：PUBLIC20-30/P0；INVITE2-8/P1关闭；CHECKIN3-10/P1无租约关闭；空/满/加入中/已入座/无权/失败。
- 交互：目录→本人资格/容量→同一join请求→本人seat读回→房间；满员换房；邀请房与打卡组各保留关闭原因与学习出口。
- 实际候选：[225:1810](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-1810)、[225:2054](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-2054)。
- 整项核验：UNVERIFIED；OPEN。

## WG-10 · 25/45专注、断线恢复、释座及离开

- 需求：V2-980-0337、V2-980-0338。
- 页面：25/45专注、断线恢复、释座及离开。
- 状态：FOCUSING/PAUSED/COMPLETED/ABORTED/AUTO_RELEASED；25/45；disconnect/recover/expired；离开确认/unknown/query/left；未完成0分钟。
- 交互：原lease/focusVersion→断线先读本人席位→有效恢复/已释座重入；完成以服务端已到时+有效租约为准；离开未知不再占第二席；返回原学习。
- 实际候选：[225:2190](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-2190)、[225:2554](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-2554)、[225:3033](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-3033)、[225:3752](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-3752)、[391:15137](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15137)、[391:15197](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15197)、[391:15261](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15261)、[391:15304](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15304)、[391:15346](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15346)、[391:15417](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15417)、[391:15461](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15461)、[391:15505](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15505)、[391:15549](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15549)、[391:15596](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15596)、[391:15647](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15647)、[391:15694](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15694)、[391:15725](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15725)、[391:15785](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=391-15785)。
- 整项核验：UNVERIFIED；OPEN。

## WG-11 · 白噪音与受控互动

- 需求：V2-980-0337、V2-980-0339。
- 页面：白噪音与受控互动。
- 状态：声音关闭/音量/不可用/文本替代；合法预设选择；发送中/待审/已发布/拒绝/限流/失败；权限失效/原请求unknown。
- 交互：主动启音→可静音；互动只能选择已审预设→提交→确认文字反馈；失败不伪成功；无自由文本/私聊/上传/外链。
- 实际候选：[225:2054](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-2054)、[383:21111](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21111)、[383:21171](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21171)、[383:21274](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21274)、[383:21309](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21309)、[383:21342](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21342)、[383:21395](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21395)、[383:22036](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22036)、[383:22129](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22129)。
- 整项核验：UNVERIFIED；OPEN。

## WG-12 · 榜单指标、快照与隐私

- 需求：V2-980-0340、V2-980-0341、V2-980-0345、V2-980-0346、V2-980-0347、V2-980-0348、V2-980-0349、V2-980-0350。
- 页面：榜单指标、快照与隐私。
- 状态：FOCUS_MINUTES/MASTERED_WORDS/XP；period/timezone/version/snapshotAt；排名/空榜/未开始/加载失败；昵称/匿名/退出；stale/不支持指标关闭。
- 交互：榜单→指标/周期→可信快照→隐私设置→同请求保存/查询→读回；退出后不残留可识别身份；连续/Checkpoint榜无canonical时关闭。
- 实际候选：[237:3983](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-3983)、[383:21111](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21111)、[383:21432](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21432)、[383:21514](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21514)、[383:21596](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21596)、[383:21678](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21678)、[383:22036](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22036)、[383:22129](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22129)。
- 整项核验：UNVERIFIED；OPEN。

## WG-13 · 学习Feed与成员公开资料卡

- 需求：V2-980-0342、V2-980-0343、V2-980-0448、V2-980-0449。
- 页面：学习Feed与成员公开资料卡。
- 状态：系统生成Feed/空/错误/stale；授权公开成员卡；隐藏字段/匿名/撤销/不存在；预设反应/举报返回。
- 交互：房间成员/合法Feed→仅对方公开字段卡→预设反应或举报→原房间；私人成绩/记录默认不公开，撤销后隐藏缓存字段。
- 实际候选：[225:2054](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-2054)、[383:21111](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21111)、[383:21743](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21743)、[383:21818](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21818)、[383:21891](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21891)、[383:21964](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-21964)、[383:22036](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22036)、[383:22129](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-22129)。
- 整项核验：UNVERIFIED；OPEN。

## WG-14 · 举报目标、原因与原请求生命周期

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：举报目标、原因与原请求生命周期。
- 状态：SEAT/ROOM/PRESET；五canonical原因；review/unknown/query/notreceived/fail/receipt/later；SUBMITTED/TRIAGED/RESOLVED/DISMISSED；目标失效/401/403。
- 交互：选目标/原因→确认→同请求unknown/query→确认receipt→本人案件状态→回原目标；无自由输入和自动处罚承诺。
- 实际候选：[251:7763](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=251-7763)、[251:8123](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=251-8123)、[255:3175](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=255-3175)、[255:4018](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=255-4018)、[383:23546](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23546)、[383:23601](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23601)、[383:23674](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23674)、[383:23747](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23747)、[383:23820](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23820)、[383:23893](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23893)、[383:23944](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-23944)、[383:24011](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24011)、[383:24078](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24078)、[383:24129](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24129)、[383:24180](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24180)、[383:24231](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24231)、[383:24278](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24278)、[383:24333](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24333)。
- 整项核验：UNVERIFIED；OPEN。

## WG-15 · 角色基础编辑与性能降级

- 需求：V2-980-0279、V2-980-0441。
- 页面：角色基础编辑与性能降级。
- 状态：体型/肤色/脸型/发型/发色/眉眼表情/站姿；模板昵称/签名；预览/保存中/未知/失败/版本冲突；3D降级静态/关闭动效。
- 交互：本人角色→模板编辑→预览→保存原请求→读回已保存→取消恢复旧角色；不采真人脸；学习页不常驻3D。
- 实际候选：[383:12430](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-12430)、[383:12539](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-12539)、[383:12717](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-12717)、[383:12807](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-12807)、[383:12882](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-12882)、[383:12955](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-12955)、[383:13052](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-13052)、[383:13127](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-13127)、[383:13260](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-13260)、[383:13392](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-13392)、[383:13438](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-13438)、[383:13536](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-13536)、[383:13605](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-13605)、[383:13788](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-13788)、[383:20276](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20276)。
- 整项核验：UNVERIFIED；OPEN。

## WG-16 · 衣柜分类、品质与试穿

- 需求：V2-980-0280、V2-980-0281、V2-980-0442、V2-980-0444、V2-980-0445。
- 页面：衣柜分类、品质与试穿。
- 状态：人物/场景/收藏分类；已拥有/未拥有/已装备/不可用；Common/Rare/Epic/Legendary/Collectible文字；试穿原装/取消；空目录/失败。
- 交互：目录→分类/物品详情/获得来源→试穿→取消原装或确认兑换；品质不影响学习/SRS/排行公平。
- 实际候选：[225:5498](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-5498)、[383:13536](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-13536)、[383:14198](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14198)、[383:14373](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14373)、[383:15085](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15085)、[383:15284](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15284)、[383:16477](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16477)、[383:19805](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-19805)。
- 整项核验：UNVERIFIED；OPEN。

## WG-17 · 固定兑换、权属及余额前置

- 需求：V2-980-0271、V2-980-0280、V2-980-0285。
- 页面：固定兑换、权属及余额前置。
- 状态：规则/花费/余额/物品版本确认；余额不足/条件不符/已拥有/下架；unknown/query/fail/notreceived/confirmed；权属确认后装备。
- 交互：试穿→确认固定花费→原兑换请求→查原请求→权属/账本读回→装备；未确认不重复扣减；回原选择。
- 实际候选：[383:14198](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14198)、[383:14373](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14373)、[383:14898](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14898)、[383:15022](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15022)、[383:15085](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15085)、[383:15284](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15284)、[383:16419](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16419)。
- 整项核验：UNVERIFIED；OPEN。

## WG-18 · 装备/卸下、并发与权益失效

- 需求：V2-980-0280。
- 页面：装备/卸下、并发与权益失效。
- 状态：未装备/已装备/卸下；save unknown/query；版本冲突；物品过期/撤销/不可用；取消保留原装。
- 交互：仅有效本人权属→提交equip/unequip+expectedVersion→unknown查原请求→已装备读回；409选择最新状态或重试同一操作；失效后合规替换。
- 实际候选：[225:5498](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-5498)、[383:14198](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14198)、[383:14373](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14373)、[383:14442](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14442)、[383:14506](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14506)、[383:14556](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14556)、[383:14604](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14604)、[383:14681](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14681)、[383:14745](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14745)、[383:14794](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14794)、[383:14841](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14841)、[383:14898](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14898)、[383:14959](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-14959)、[383:15022](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15022)、[383:15085](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15085)、[383:15284](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15284)。
- 整项核验：UNVERIFIED；OPEN。

## WG-19 · 免费箱资格、概率规则与领取

- 需求：V2-980-0282、V2-980-0283、V2-980-0284、V2-980-0446。
- 页面：免费箱资格、概率规则与领取。
- 状态：无资格/可领取/已领取；规则/完整池/品质或物品概率/版本变更历史；领取unknown/query/confirmed/rejected；动画或静态结果；原抽取记录。
- 交互：真实学习资格→预先可读规则概率→免费确认→原claim查询→服务端权属/ledger确认→开箱动画→本人记录→学习；规则未批准关闭不编概率。
- 实际候选：[383:15762](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15762)、[383:15840](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15840)、[383:15891](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15891)、[383:15969](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15969)、[383:16023](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16023)、[383:16105](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16105)、[383:16146](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16146)、[383:16185](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16185)、[383:16249](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16249)、[383:16304](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16304)、[383:16547](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16547)、[383:16625](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16625)。
- 整项核验：UNVERIFIED；OPEN。

## WG-20 · 重复物品碎片、图鉴与赛季资产

- 需求：V2-980-0285、V2-980-0286、V2-980-0288、V2-980-0439、V2-980-0445、V2-980-0446。
- 页面：重复物品碎片、图鉴与赛季资产。
- 状态：重复→碎片回执；固定碎片兑换/不足/unknown；已拥有/未拥有/未开放图鉴；套装进度/称号；赛季资格/结束/结算待确认。
- 交互：抽取回执→重复转碎片ledger→固定目标兑换→权属→图鉴点亮；图鉴记录只由确认事实驱动；返回原物品/学习。
- 实际候选：[194:4314](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-4314)、[383:15762](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-15762)、[383:16185](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16185)、[383:16304](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16304)、[383:16361](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16361)、[383:16419](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16419)、[383:16477](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16477)、[383:20338](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20338)、[383:20407](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20407)、[383:20476](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20476)、[383:20545](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20545)、[383:20614](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-20614)。
- 整项核验：UNVERIFIED；OPEN。

## WC-01 · 免费/付费权益与非自动续费SKU

- 需求：V2-980-0461、V2-980-0462、V2-980-0463、V2-980-0470、V2-980-0472、V2-980-0473、V2-980-0480、V2-980-0481、V2-980-0486。
- 页面：免费/付费权益与非自动续费SKU。
- 状态：免费/当前有效/即将到期/过期/撤销；可售/关闭/无商品/加载失败；SKU周期/币种/价格/权益固定快照；当前权益与下次扣款分开。
- 交互：商品/本人权益→明确可用范围/有效期/来源→已开放内容或原学习页；不可售仅说明，不以支付解锁所有未知内容。
- 实际候选：[237:2021](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-2021)、[237:2988](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-2988)、[237:3111](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-3111)、[363:3618](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3618)、[379:16536](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16536)、[379:16611](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16611)、[379:16683](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16683)。
- 整项核验：UNVERIFIED；OPEN。

## WC-02 · 订单列表、详情与分页

- 需求：V2-980-0469、V2-980-0475、V2-980-0482、V2-980-0483、V2-980-0484、V2-980-0492。
- 页面：订单列表、详情与分页。
- 状态：list/loading/empty/error/offline/401/403；指定orderId详情/不存在/跨账户不可见；待支付/取消/确认中/已付待开通/已完成/退款中/已退；返回原筛选/分页。
- 交互：交易中心→本人订单筛选/分页→锁定订单详情→支付/权益/退款/票据的对应状态→回原列表；不同订单/请求身份不能串。
- 实际候选：[237:2507](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-2507)、[237:2988](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-2988)、[237:3833](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-3833)、[363:3618](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3618)、[363:3702](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3702)、[363:3782](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3782)、[363:3825](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3825)、[363:3868](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3868)、[363:3926](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3926)、[363:4003](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4003)、[363:4079](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4079)、[363:4156](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4156)、[363:4231](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4231)、[363:4275](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4275)、[363:4355](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4355)、[379:14110](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14110)、[379:14215](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14215)。
- 整项核验：UNVERIFIED；OPEN。

## WC-03 · 下单确认、价格过期与原请求恢复

- 需求：V2-980-0463、V2-980-0469、V2-980-0482、V2-980-0483。
- 页面：下单确认、价格过期与原请求恢复。
- 状态：snapshot确认；价格/可售变化409；unknown/query/notreceived/queryfail/confirmed；同键异体冲突；稍后返回原订单。
- 交互：SKU+expectedPriceSnapshot→总价周期续费确认→同键创建→unknown只查询原请求→确定未受理才重新确认；保留旧快照不可静默涨价。
- 实际候选：[237:2507](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-2507)、[363:3926](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3926)、[379:14110](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14110)、[379:14154](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14154)、[379:14186](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14186)、[379:14215](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14215)。
- 整项核验：UNVERIFIED；OPEN。

## WC-04 · 沙盒收银与安全返回

- 需求：V2-980-0464、V2-980-0465。
- 页面：沙盒收银与安全返回。
- 状态：用户购买关闭；仅测试角色SANDBOX_HMAC；创建intent/unknown/query/failed/expired；返回渠道cancel/fail/pending；严禁live provider。
- 交互：测试用户订单→sandbox意图→外部渠道安全流程示例→返回先读原订单→确认资金与权益；普通学习者不能访问测试权限；Web不绘制iOS StoreKit native界面。
- 实际候选：[237:2507](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-2507)、[363:3926](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3926)、[379:14286](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14286)、[379:14355](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14355)、[379:14398](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14398)。
- 整项核验：UNVERIFIED；OPEN。

## WC-05 · 支付与权益分别查询、失效降级和权益准入

- 需求：V2-980-0472、V2-980-0473、V2-980-0480、V2-980-0481、V2-980-0482、V2-980-0483、V2-980-0486。
- 页面：支付与权益分别查询、失效降级和权益准入。
- 状态：未支付/取消/失败；付款确认中/已付待开通；ACTIVE/EXPIRED/REVOKED/unknown；权限失效说明；原学习数据保留。
- 交互：原订单读回资金→权益读回范围有效期→允许内容入口；paidPending不可再次付款；失效返回可用免费内容/客服，不删除学习记录；unknown拒绝放行。
- 实际候选：[237:2988](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-2988)、[237:3111](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-3111)、[237:3833](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-3833)、[363:4003](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4003)、[363:4079](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4079)、[363:4156](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4156)、[379:14286](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14286)、[379:14355](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14355)、[379:14398](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14398)、[379:14659](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14659)、[379:15327](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15327)、[379:16536](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16536)、[379:16611](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16611)、[379:16683](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16683)、[379:16759](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16759)、[379:16835](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16835)。
- 整项核验：UNVERIFIED；OPEN。

## WC-06 · 兑换激活码输入、验证与权益读回

- 需求：V2-980-0478、V2-980-0480、V2-980-0486。
- 页面：兑换激活码输入、验证与权益读回。
- 状态：input empty/invalid；redeeming unknown/query；invalid/expired/revoked/already redeemed/rate limited；same redemption result；success→entitlement pending/active；401/403/offline。
- 交互：短暂输入raw code→校验/同键兑换→unknown查询opaque redemption→confirmed后清空code→读本人权益→学习；不在普通缓存/审计/截图暴露raw/digest/hash-prefix；不作为绕过iOS规则。
- 实际候选：[363:3618](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3618)、[379:14853](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14853)、[379:14907](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14907)、[379:14958](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14958)、[379:15006](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15006)、[379:15050](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15050)、[379:15082](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15082)、[379:15111](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15111)、[379:15142](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15142)、[379:15186](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15186)、[379:15233](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15233)、[379:15280](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15280)、[379:15327](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15327)、[379:15400](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15400)、[379:15451](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15451)。
- 整项核验：UNVERIFIED；OPEN。

## WC-07 · 订阅、取消续订、续费失败和恢复购买

- 需求：V2-980-0463。
- 页面：订阅、取消续订、续费失败和恢复购买。
- 状态：当前autoRenewOff明确；未来确认/取消下次续订；续费失败/到期；恢复校验/已恢复/未找到/账户不符；Web到真实渠道管理安全出口。
- 交互：当前非自动续费→权益有效期；未来条件draft才允许manage/restore→原渠道/原请求确认→最新权益；取消续订不等于退款；不发明宽限期。
- 实际候选：[237:3111](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-3111)、[379:16683](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16683)、[379:17012](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17012)、[379:17069](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17069)、[379:17125](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17125)、[379:17175](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17175)、[379:17213](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17213)、[379:17242](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17242)、[379:17279](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17279)、[379:17329](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17329)、[379:17377](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17377)、[379:17426](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17426)、[379:17475](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-17475)。
- 整项核验：UNVERIFIED；OPEN。

## WC-08 · 退款申请、资金与权益分别展示

- 需求：V2-980-0476、V2-980-0484。
- 页面：退款申请、资金与权益分别展示。
- 状态：资格不符/可申请/确认金额；unknown/query/notreceived/fail；processing/rejected/settled；权益维持或撤销/降级；原订单/请求返回。
- 交互：指定本人订单→服务端资格金额→原refund请求→待确认只查询→实际资金状态+权益各自显示→原订单；不伪造双人审批；受理不等于到账。
- 实际候选：[237:3833](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-3833)、[363:4079](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4079)、[363:4156](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4156)、[379:14442](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14442)、[379:14513](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14513)、[379:14584](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14584)、[379:14659](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-14659)。
- 整项核验：UNVERIFIED；OPEN。

## WC-09 · 发票/票据入口与独立申请状态

- 需求：V2-980-0469。
- 页面：发票/票据入口与独立申请状态。
- 状态：actual invoice capability/关闭原因；申请字段校验；原invoice请求unknown/query/failed/notreceived；processing/issued/download expired/unsupported；与商店receipt明确区分。
- 交互：指定订单→票据资格/主体/渠道→独立invoiceRequestId→原请求查询→正式票据可用时安全查看/下载→原订单；不把receipt叫发票。
- 实际候选：[363:3618](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3618)、[363:4079](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-4079)、[379:15630](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15630)、[379:15684](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15684)、[379:15728](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15728)、[379:15788](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15788)、[379:15846](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15846)、[379:15890](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15890)、[379:15922](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15922)、[379:15951](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15951)、[379:15982](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-15982)、[379:16025](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16025)、[379:16093](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16093)、[379:16191](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16191)、[379:16234](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16234)、[379:16278](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16278)、[379:16338](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16338)。
- 整项核验：UNVERIFIED；OPEN。

## WC-10 · Household未来权益共享、优惠券及合并关闭边界

- 需求：V2-980-0468、V2-980-0470、V2-980-0471、V2-980-0474、V2-980-0477、V2-980-0485、V2-980-0490、V2-980-0491。
- 页面：Household未来权益共享、优惠券及合并关闭边界。
- 状态：成人独立账号；未来邀请/接受/满员/失效/退出/移除/unknown；权益与学习数据分离；同意/风控冷却待政策；coupon/merge/household canonical写未准入关闭。
- 交互：现有成员身份只读→明确共享权益不共享学习数据→条件邀请/退出/移除原请求恢复；未准入仅关闭原因和普通学习/支持出口。
- 实际候选：[363:3618](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=363-3618)、[379:16871](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=379-16871)、[382:11514](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11514)、[382:11560](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11560)、[382:11641](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11641)、[382:11688](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11688)、[382:11747](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11747)、[382:11795](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11795)、[382:11830](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11830)、[382:11863](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11863)、[382:11917](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11917)、[382:11952](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11952)、[382:11987](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-11987)、[382:12039](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=382-12039)、[383:11625](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-11625)、[383:11672](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-11672)、[383:11722](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-11722)、[383:11770](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-11770)、[383:11816](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-11816)、[383:11857](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-11857)、[383:11894](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-11894)、[383:11942](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-11942)、[383:11991](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-11991)、[383:12036](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-12036)、[383:12077](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-12077)、[383:12143](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-12143)、[383:12190](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-12190)、[383:16848](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16848)、[383:16918](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16918)、[383:16966](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-16966)、[383:17012](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17012)、[383:17056](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17056)、[383:17102](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17102)、[383:17149](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17149)、[383:17197](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17197)、[383:17243](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17243)、[383:17287](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17287)、[383:17335](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17335)、[383:17381](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17381)、[383:17428](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-17428)。
- 整项核验：UNVERIFIED；OPEN。

## WC-11 · 交易消息与外部通知的状态读取

- 需求：V2-980-0487、V2-980-0488、V2-980-0489。
- 页面：交易消息与外部通知的状态读取。
- 状态：会员开通/将到期/订单/退款/权益变化；message target本人授权；失效/撤销链接；渠道不可用提示。
- 交互：本人通知→安全校验对应order/entitlement状态→原详情→消息；SMS/Email模板属于notification域，不在商业页伪造已送达。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-001 · 六类消息目录、未读角标、只读缓存时效

- 需求：V2-980-0405、V2-980-0450。
- 页面：消息中心；分类列表；无消息；缓存列表。
- 状态：initial loading；empty vs 401/403 vs failed distinct；unread/read；offline stale timestamp。
- 交互：账户入口→本人消息目录→分类→详情→原分类，刷新失败保留旧可读内容。
- 实际候选：[323:2850](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-2850)、[323:2976](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-2976)、[323:3094](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-3094)、[323:3212](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-3212)、[323:5129](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-5129)、[323:5226](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-5226)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-002 · 单条已读、批量已读、后到消息不误标

- 需求：V2-980-0405。
- 页面：单条详情；批量确认；待确认；原请求查询；回执；新到消息。
- 状态：not received；query failure；server readAt receipt；new arrival remains unread。
- 交互：确认→unknown→same original query→receipt，安全离开再进保留原操作；后到消息不属于旧批次。
- 实际候选：[75:1371](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=75-1371)、[194:1342](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-1342)、[323:3317](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-3317)、[323:3413](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-3413)、[323:3795](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-3795)、[323:3508](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-3508)、[323:3892](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-3892)、[323:3988](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-3988)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-003 · 消息过期、重要消息置顶与删除管理保护

- 需求：V2-980-0405。
- 页面：重要消息条目；删除/批量选择；删除确认与结果；已过期详情。
- 状态：pinned protected/ineligible；0/1/2 selected；unknown/result policy pending；expired。
- 交互：重要安全消息不作为可选删除项；结果待确认只查原请求；保留/移除策略未决时列表事实不假消失。
- 实际候选：[327:3047](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=327-3047)、[327:3230](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=327-3230)、[327:3291](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=327-3291)、[327:3341](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=327-3341)、[327:3393](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=327-3393)、[327:3653](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=327-3653)、[327:3705](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=327-3705)、[323:4668](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-4668)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-004 · 通知深链目标权限、内容/版本、登录与失效检查

- 需求：V2-980-0395、V2-980-0405。
- 页面：目标检查；SRS/设备目标；失效/撤权/禁止目标；重新登录。
- 状态：401；403；404/expired；revoked；unsafe/external target rejected。
- 交互：消息详情→校验原消息/本人/授权→目标；失败回原消息上下文，不进入私人或任意外部页。
- 实际候选：[323:4371](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-4371)、[323:4478](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-4478)、[323:4573](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-4573)、[323:4668](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-4668)、[323:4759](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-4759)、[323:4850](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-4850)、[323:4941](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-4941)、[323:5032](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-5032)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-005 · 十类可选提醒逐项设置，必要通知单独说明

- 需求：V2-980-0407、V2-980-0386、V2-980-0389、V2-980-0451。
- 页面：类别偏好矩阵；类别详情/开关；必要安全/交易通知说明。
- 状态：enabled/disabled per category；unavailable gated category；necessary read-only。
- 交互：选择学习/复习/Streak/考试/Checkpoint/StudyRoom/奖励/新课/会员/营销→review→原请求保存查询→回读；必要通知不能被总开关误关。
- 实际候选：[206:1682](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-1682)、[206:1805](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-1805)、[206:1928](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-1928)、[373:4957](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-4957)、[373:5381](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5381)、[373:5450](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5450)、[373:5509](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5509)、[373:5537](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5537)、[373:5819](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5819)、[378:14755](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-14755)、[378:15067](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15067)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-006 · 通知渠道能力、授权、退订与短信白名单

- 需求：V2-980-0407、V2-980-0396。
- 页面：站内/Email/Push/SMS渠道概览；未开放/拒绝授权说明；退订影响说明。
- 状态：channel available/unavailable；consent required/revoked；marketing SMS denied；necessary transaction retained。
- 交互：仅获准渠道能设置；Web/PWA与原生Push区别明确；不把保存偏好当发送成功，不为手机端Push增加Web默认通道。
- 实际候选：[206:1682](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-1682)、[206:3257](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-3257)、[373:5120](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5120)、[373:4957](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-4957)、[378:14921](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-14921)、[378:15243](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15243)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-007 · 免打扰、时区、频率策略、通知语言与同意版本

- 需求：V2-980-0407。
- 页面：免打扰编辑；立即/日报/周报/禁用策略；通知语言/授权版本说明。
- 状态：cross-midnight valid；time validation；server timezone；stale consent/version。
- 交互：编辑→校验→review→expectedVersion保存→same query，安全与必要交易绕过免打扰有明确说明。
- 实际候选：[206:1805](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-1805)、[206:1928](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-1928)、[206:2051](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-2051)、[206:3257](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-3257)、[373:5181](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5181)、[373:5257](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5257)、[373:5381](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5381)、[373:5450](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5450)、[373:5509](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5509)、[373:5819](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5819)、[378:14985](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-14985)、[378:15307](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15307)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-008 · 偏好版本冲突、部分失败、查询失败和离开恢复

- 需求：V2-980-0407。
- 页面：保存review；部分失败；最新值对比；later。
- 状态：unknown；query failed；CAS conflict；one item saved/one failed。
- 交互：只重试失败项且保留原身份；已保存项不重复提交；回消息中心再进恢复待确认上下文。
- 实际候选：[206:2051](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-2051)、[206:2172](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-2172)、[206:2296](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-2296)、[206:2416](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-2416)、[206:2537](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-2537)、[206:2898](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-2898)、[206:3016](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=206-3016)、[373:4957](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-4957)、[373:5381](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5381)、[373:5450](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5450)、[373:5509](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5509)、[373:5537](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5537)、[373:5596](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5596)、[373:5653](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5653)、[373:5708](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5708)、[373:5819](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=373-5819)、[378:14755](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-14755)、[378:15067](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15067)、[378:14985](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-14985)、[378:15307](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15307)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-009 · 本人设备有序队列与owner回执摘要

- 需求：V2-980-0409、V2-980-0382、V2-980-0393。
- 页面：队列/阶段；部分结果；原操作查询。
- 状态：empty/loading/error separate；PROCESSING/APPLIED/REPLAYED；unknown。
- 交互：学习页/设置→队列→original owner receipt，不把中央同步器作为写owner；已确认项不重复提交。
- 实际候选：[198:2541](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-2541)、[198:2673](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-2673)、[198:2792](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-2792)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-010 · 异hash/乱序/gap/旧版/未来版/内容pin/撤权冲突

- 需求：V2-980-0409。
- 页面：冲突列表；原因详情；local vs server对比；允许动作。
- 状态：8 explicit reason codes；read-only protected facts；no blind merge。
- 交互：冲突原因→安全服务端版本→KEEP_LOCAL_DRAFT/RELOAD_SERVER/许可后新base/客服/确认丢弃；attempt/mastery/XP/权益禁止client merge。
- 实际候选：[198:2913](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-2913)、[198:3035](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3035)、[59:1457](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=59-1457)、[59:1529](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=59-1529)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-011 · 断点继续保留session/内容版本/已确认题及提交阶段

- 需求：V2-980-0409。
- 页面：断点摘要；继续题目；已保存反馈；整轮结果。
- 状态：checkpoint confirmed；local draft unconfirmed；content withdrawn；report generating distinct。
- 交互：1/3已确认→第2题→保存→继续；整轮session提交另确认后才允许报告，不将某题正确当整轮完成。
- 实际候选：[198:3157](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3157)、[198:3278](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3278)、[198:3399](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3399)、[198:3523](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3523)、[198:3647](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3647)、[198:3768](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3768)、[198:3889](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-3889)、[198:4010](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4010)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-012 · 离线内容包目录、授权与兼容性

- 需求：V2-980-0408、V2-980-0454、V2-980-0440。
- 页面：下载存储目录；包详情；不可下载关闭入口；已授权缓存阅读。
- 状态：none/loading/error；not downloaded；READY verified；rights expiry/revoked；incompatible。
- 交互：仅可读目录→包版本/内容/大小/可用性；byte distribution未Gate前下载禁用并解释，条件入口可预览目标。
- 实际候选：[198:4129](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4129)、[198:4256](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4256)、[198:4376](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4376)、[198:4497](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4497)、[198:4618](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4618)、[376:6556](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6556)、[376:6694](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6694)、[376:6756](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6756)、[376:6985](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6985)、[376:7231](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-7231)、[380:10113](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10113)、[380:10375](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10375)、[380:10249](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10249)、[380:10511](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10511)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-013 · 下载暂停继续、失败、损坏校验与空间不足

- 需求：V2-980-0408。
- 页面：下载详情；暂停/恢复；失败与重试；损坏校验；存储不足。
- 状态：queued/downloading/paused/verifying/ready；network/rights revoked；corrupt hash/manifest；storage denied/quota。
- 交互：条件下载→进度→校验完整性→可读；失败保留已确认块，未通过校验不可开始；退出可回同包状态。
- 实际候选：[198:4129](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4129)、[198:4618](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4618)、[376:6556](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6556)、[376:6802](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6802)、[376:6866](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6866)、[376:6926](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6926)、[376:7047](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-7047)、[376:7107](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-7107)、[376:7169](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-7169)、[376:7231](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-7231)、[376:6985](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6985)、[380:10113](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10113)、[380:10375](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10375)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-014 · 缓存删除范围、未同步阻止与删除后返回

- 需求：V2-980-0408。
- 页面：存储占用；选择缓存；清除确认；有待同步记录阻止；删除回执。
- 状态：select all/none；pending protected；unknown receipt；deleted local only。
- 交互：先核对待同步→确认仅内容缓存→本地清除回执→留在存储中心；服务端记录/队列/其他账号不删除。
- 实际候选：[198:4618](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4618)、[198:4739](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4739)、[198:4860](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4860)、[376:7294](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-7294)、[376:7367](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-7367)、[376:7417](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-7417)、[376:7459](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-7459)、[380:10306](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10306)、[380:10568](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=380-10568)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-015 · PWA更新、离线限制、切号与晚回包隔离

- 需求：V2-980-0409、V2-980-0382。
- 页面：PWA工作区/更新提示；离线限制；切号清理说明；恢复登录。
- 状态：old cache/schema incompatible；service worker update deferred；old-account response ignored。
- 交互：更新前保留草稿→待确认原请求→可安全升级；登出/切号清私有UI缓存，旧请求不可写入新账号。
- 实际候选：[59:1817](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=59-1817)、[64:2534](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=64-2534)、[31:52](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=31-52)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-016 · 个人资料只读摘要、昵称和系统头像编辑

- 需求：V2-980-0364、V2-980-0372、V2-980-0373、V2-980-0413、V2-980-0414。
- 页面：资料总页；昵称编辑；系统头像选择；预览；回执。
- 状态：invalid/empty/name length；dirty discard；pending/query/conflict。
- 交互：查看当前→编辑→校验→预览→original save query→回读，取消不改变服务器事实。
- 实际候选：[214:1720](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-1720)、[214:1844](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-1844)、[214:1968](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-1968)、[214:2092](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-2092)、[214:2216](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-2216)、[214:2337](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-2337)、[214:2459](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-2459)、[214:2700](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-2700)、[214:3665](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-3665)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-017 · 系统头像默认与未来上传裁剪的范围裁定、发音偏好

- 需求：V2-980-0364。
- 页面：头像来源/系统头像；条件上传/裁剪；美音/英音偏好。
- 状态：upload unsupported/scan pending/fail；crop cancel；pronunciation unavailable。
- 交互：系统头像默认；上传裁剪在media/扫描/策略许可后启用，未准入明确禁用；发音偏好保存不伪造缺失音频。
- 实际候选：[214:1844](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-1844)、[214:2092](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-2092)、[376:5090](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5090)、[376:5276](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5276)、[376:5564](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5564)、[378:15585](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15585)、[378:16094](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-16094)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-018 · 目标语言、学习目标、目标日期和每日分钟变更

- 需求：V2-980-0374、V2-980-0375、V2-980-0376、V2-980-0377。
- 页面：目标编辑；分钟/日期；影响预览；计划版本冲突；保存后读回。
- 状态：valid/invalid date；dirty discard；CAS conflict；old/new report unchanged。
- 交互：目标修改预览→targetVersion保存→计划新版本/只重排未开始任务，不删除已完成SRS/旧报告。
- 实际候选：[214:3785](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-3785)、[214:3910](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-3910)、[214:4034](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4034)、[214:4399](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4399)、[214:4640](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4640)、[214:4763](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-4763)、[214:5364](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-5364)、[214:5604](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-5604)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-019 · UI语言、contentLocale分离和缺词回退说明

- 需求：V2-980-0390、V2-980-0375。
- 页面：界面语言；学习内容语言；不可用语言说明。
- 状态：available/unavailable；fallback key；pseudo-long label。
- 交互：分别选择→校验已发布语言→保存确认；内容语言不改变UIlocale，主题/locale不扩大版权。
- 实际候选：[235:2043](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-2043)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-020 · 学习参数：每周天数、新词量、强度、回忆/交错和积压策略

- 需求：V2-980-0390。
- 页面：学习设置；参数选项；积压处理；计划影响预览。
- 状态：per-field validation；unavailable rule pending；conflict/unknown/not saved。
- 交互：按规则能力展示参数→说明对未来学习影响→保存查询→回读，用户不能直接写SRSdue/mastery。
- 实际候选：[235:1915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-1915)、[214:3785](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=214-3785)、[376:5090](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5090)、[376:5163](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5163)、[376:5564](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5564)、[376:5715](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5715)、[376:6265](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6265)、[378:15463](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15463)、[378:15966](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15966)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-021 · 个性化首页：固定功能、编辑、恢复与推荐解释

- 需求：V2-980-0390。
- 页面：首页个性化设置；编辑布局；固定功能；推荐解释；恢复默认确认。
- 状态：no recommendations；unsupported/closed condition；dirty cancel；save conflict。
- 交互：预览首页布局→确认→保存/读回；恢复默认只改显示，不重建学习计划/学习记录。
- 实际候选：[235:1915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-1915)、[235:2588](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-2588)、[376:5090](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5090)、[376:5469](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5469)、[376:5564](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5564)、[376:5715](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5715)、[376:6265](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6265)、[378:15794](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15794)、[378:16314](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-16314)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-022 · 音频偏好：语速、自动播、耳机、后台、音量记忆

- 需求：V2-980-0390、V2-980-0455。
- 页面：音频设置；受浏览器限制提示；播放预览。
- 状态：autoplay blocked；background unsupported；no headphones；missing media。
- 交互：编辑预览→浏览器需手势则明确开始键→保存确认；不声称Web浏览器强制可后台播。
- 实际候选：[235:1915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-1915)、[235:2445](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-2445)、[376:5276](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5276)、[376:5564](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5564)、[376:5715](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5715)、[376:6265](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6265)、[378:15585](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15585)、[378:16094](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-16094)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-023 · 亮暗跟随系统、高对比、文字大小与非颜色状态

- 需求：V2-980-0390、V2-980-0397。
- 页面：主题选择；字号选择；focus/disabled/control specification。
- 状态：selected text label；200% reflow；all semantic states。
- 交互：选主题/字号→独立本机显示与账号同步→可回退且控件可操作。
- 实际候选：[235:2182](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-2182)、[235:2315](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-2315)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-024 · 四级画质、减少动效、粒子/振动与自动降级

- 需求：V2-980-0390。
- 页面：画质和动效；自动降级说明；关闭实时3D/快照/特效。
- 状态：Ultra/High/Medium/Performance；OS reduced motion；no vibration capability；auto fallback。
- 交互：选择→说明当前设备有效档位/自动降级→保存；关闭动效仍有文字反馈。
- 实际候选：[235:2445](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-2445)、[376:5090](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5090)、[376:5564](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5564)、[378:15393](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15393)、[378:15896](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15896)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-025 · 下载偏好：网络确认、质量、自动清理

- 需求：V2-980-0390、V2-980-0408。
- 页面：下载偏好；移动网络确认；质量选择；自动清理范围。
- 状态：Web network type unknown；unavailable format；cache has pending；policy closed。
- 交互：只对获准包设置偏好→首次耗流量确认→不会静默清待同步/录音/其他账号数据。
- 实际候选：[235:1915](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-1915)、[198:4618](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=198-4618)、[376:5385](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5385)、[376:5564](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5564)、[376:5715](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5715)、[376:6265](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6265)、[378:15703](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15703)、[378:16219](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-16219)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-026 · 偏好保存本机/账号区分及unknown/CAS恢复

- 需求：V2-980-0390。
- 页面：保存阶段；本机；待同步；回执；最新对比。
- 状态：LOCAL_ONLY；PENDING_SYNC；UNKNOWN；CONFLICT；FAILED；CONFIRMED。
- 交互：未知先查原请求→明确未保存才重试；返回设置重新进入保留未决状态及字段选择。
- 实际候选：[235:2707](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-2707)、[235:2824](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-2824)、[235:2952](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-2952)、[235:3069](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-3069)、[235:3186](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-3186)、[235:3305](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-3305)、[235:3428](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-3428)、[235:3545](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=235-3545)、[376:5090](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5090)、[376:5715](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5715)、[376:5798](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5798)、[376:5871](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5871)、[376:5899](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5899)、[376:5972](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-5972)、[376:6043](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6043)、[376:6112](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6112)、[376:6265](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=376-6265)、[378:15393](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15393)、[378:15896](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15896)、[378:15463](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15463)、[378:15966](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15966)、[378:15585](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15585)、[378:16094](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-16094)、[378:15703](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15703)、[378:16219](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-16219)、[378:15794](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-15794)、[378:16314](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-16314)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-027 · 设备列表、当前设备、最近活动与粗粒度地区

- 需求：V2-980-0363、V2-980-0371、V2-980-0387、V2-980-0452。
- 页面：当前/其他设备列表；设备详情；登录历史。
- 状态：loading/empty/error/401/403；current-device marker；stale lastSeen。
- 交互：账户安全→本人设备→查看活动/单设备退出→列表刷新；不得展示精确位置或其他人会话。
- 实际候选：[25:468](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-468)、[383:24548](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24548)、[383:24584](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24584)、[383:24644](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24644)、[383:24668](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24668)、[383:24704](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24704)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-028 · 退出单设备/其他设备的二次认证与确认

- 需求：V2-980-0363、V2-980-0371。
- 页面：影响确认；IAM reauth；认证失败；待确认。
- 状态：current/other selection；credentials invalid/rate-limited；no permission。
- 交互：选设备范围→确认保持当前设备或说明当前退出→IAM二次认证→发出唯一撤销请求。
- 实际候选：[25:540](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-540)、[184:996](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-996)、[184:1119](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-1119)、[184:1239](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-1239)、[383:24620](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24620)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-029 · 设备撤销unknown、部分成功、原操作恢复和最终列表

- 需求：V2-980-0363、V2-980-0371。
- 页面：safe hub；query；partial；receipt；refreshed list。
- 状态：unknown/query failure/not received；partial vs all revoked；401 old sessions。
- 交互：保留原撤销ID/目标范围→查询→仅未完成设备恢复→服务端确认后列表，不重复撤销成功设备。
- 实际候选：[184:1360](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-1360)、[184:1480](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-1480)、[184:1607](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-1607)、[184:1728](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-1728)、[184:1847](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-1847)、[184:1968](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-1968)、[184:2088](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-2088)、[184:2211](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-2211)、[184:2453](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-2453)、[184:2573](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-2573)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-030 · 异常登录、安全提醒、账号冻结与凭据入口

- 需求：V2-980-0387、V2-980-0360、V2-980-0391。
- 页面：安全中心；异常登录详情；受限账号；重置密码入口。
- 状态：locked/rate-limited；risk frozen；session expired；necessary alert。
- 交互：提醒→设备详情或密码重置→IAM确认→安全返回；Phase1不新增第三方身份绑定/手机验证码正式登录。
- 实际候选：[25:468](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-468)、[31:52](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=31-52)、[323:4181](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-4181)、[323:4573](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-4573)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-031 · 授权版本列表、详情、撤回影响与版本冲突

- 需求：V2-980-0383、V2-980-0384、V2-980-0404。
- 页面：同意记录；条款详情；撤回确认；最新版本；受限学习出口。
- 状态：active/latest/revoked；unknown/queryfailed；conflict。
- 交互：查看本人版本→撤回影响→原请求查询→最新权限事实；必要授权撤回后学习受限但隐私请求继续可查。
- 实际候选：[184:2723](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-2723)、[184:2845](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-2845)、[184:2967](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-2967)、[184:3089](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-3089)、[184:3208](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-3208)、[184:3331](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-3331)、[184:3450](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-3450)、[184:3569](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-3569)、[184:3688](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-3688)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-032 · 资格受限/授权撤回后已知隐私请求只读闭环

- 需求：V2-980-0365、V2-980-0385。
- 页面：restricted account/privacy；本人请求列表；已知query；failure/empty；safe account exit。
- 状态：latest consent required；revoked consent；known query failed；not authorized。
- 交互：受限页→既有本人export/delete请求→原查询→安全账号出口，不误重启学习或新建隐私请求。
- 实际候选：[225:7117](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7117)、[225:7236](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7236)、[225:7355](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7355)、[225:7474](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7474)、[244:2669](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=244-2669)、[244:3631](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=244-3631)、[297:2559](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=297-2559)、[297:2804](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=297-2804)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-033 · 导出身份确认、范围与完整八态阶段

- 需求：V2-980-0365、V2-980-0404。
- 页面：export request；reauth；original query；collecting/assembling；ready/failed/recovery。
- 状态：REQUESTED；COLLECTING；ASSEMBLING；READY；DOWNLOAD_ISSUED；EXPIRED；FAILED；RECOVERY_REQUIRED。
- 交互：二次认证发起→requestId进度查询→READY才申请download grant；失败原任务恢复不造第二份副本。
- 实际候选：[160:495](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-495)、[160:614](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-614)、[160:741](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-741)、[160:860](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-860)、[160:982](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-982)、[160:1101](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-1101)、[160:1220](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-1220)、[170:3646](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-3646)、[170:3773](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-3773)、[170:3894](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-3894)、[170:4019](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=170-4019)、[383:24721](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24721)、[383:24757](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24757)、[383:24793](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24793)、[383:24829](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24829)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-034 · 一次性短时导出grant、过期/失效领取与最小回执

- 需求：V2-980-0365、V2-980-0404。
- 页面：ready领取；grant已签发；过期/已使用；receipt最小字段。
- 状态：second factor required；used/expired；access lost；download unavailable。
- 交互：READY→身份校验→一次性no-store grant→领取状态或回任务；原文/URL/token不进入普通日志或图稿。
- 实际候选：[160:860](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-860)、[160:982](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-982)、[160:1220](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-1220)、[383:24865](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24865)、[383:24901](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24901)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-035 · 账号注销168小时冷静期、撤回和执行限制

- 需求：V2-980-0365、V2-980-0379、V2-980-0380、V2-980-0385。
- 页面：删除影响说明；reauth；cooling status；cancel reauth；executing/no cancel。
- 状态：PENDING_COOLING_OFF；CANCELLED；EXECUTING；ANONYMIZED；RECOVERY_REQUIRED。
- 交互：确认影响/订阅渠道→IAM二次认证→受理冷静期→期内可撤回→重读资格；执行后不可撤回且无学习出口。
- 实际候选：[25:681](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-681)、[27:47](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=27-47)、[160:1353](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-1353)、[160:1720](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-1720)、[160:1967](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-1967)、[160:2086](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-2086)、[160:2205](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-2205)、[160:2566](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-2566)、[160:2810](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-2810)、[160:3292](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3292)、[160:3411](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3411)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-036 · 删除/撤回unknown、notreceived、部分恢复和法律保留

- 需求：V2-980-0365、V2-980-0404。
- 页面：original query；not received；owner receipt；recovery；retained legal hold。
- 状态：unknown/queryfailed；partial owner success；legal hold unknown DENY；minimum retained。
- 交互：按原request查询；成功owner不重执行；全部对账+会话撤销后才ANONYMIZED，法律保留可解释但不暴露敏感原文。
- 实际候选：[160:1472](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-1472)、[160:1601](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-1601)、[160:2086](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-2086)、[160:2443](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-2443)、[160:2685](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-2685)、[160:2929](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-2929)、[160:3048](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3048)、[160:3170](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3170)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-037 · 本地录音草稿、远端asset、保留/删除分态

- 需求：V2-980-0365、V2-980-0404。
- 页面：local drafts；remote recordings；delete local confirm；remote delete query；retained receipt。
- 状态：local not uploaded；uploaded remote；unknown/partial/query failure；retained legal hold。
- 交互：本地删除只移本机；远端删除原request查询；删除源asset/同意撤回影响、保留事实分开；未批准长期采集保持关闭。
- 实际候选：[225:5646](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-5646)、[225:5768](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-5768)、[225:5892](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-5892)、[225:6013](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-6013)、[225:6249](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-6249)、[225:6371](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-6371)、[225:6490](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-6490)、[225:6613](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-6613)、[225:6853](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-6853)、[237:4605](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-4605)、[237:4728](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=237-4728)、[244:2418](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=244-2418)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-038 · 本人数据类别、权限授权、SDK与关联关系说明

- 需求：V2-980-0384、V2-980-0394、V2-980-0453。
- 页面：我的数据概览；权限状态；SDK说明；学习/收藏/设备/录音/登录历史；受限关系说明。
- 状态：authorized/denied/unsupported；stale permission；closed Household Phase3。
- 交互：隐私入口→各类别最小信息→相应可管理页/帮助→回隐私；Web权限只解释浏览器能力，不拿管理端RBAC充数。
- 实际候选：[65:276](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=65-276)、[225:7236](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7236)、[225:7474](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-7474)、[378:5765](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-5765)、[378:5920](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-5920)、[378:5978](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-5978)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-039 · 搜索历史清除、部分学习数据删除与进度重置

- 需求：V2-980-0365、V2-980-0404。
- 页面：操作范围说明；部分数据选择；不可删除/法律保留；重置影响确认；待确认/恢复。
- 状态：scope empty/eligible/ineligible；current operation unknown；partial failure；cancel/reset denied。
- 交互：区分清本机搜索/删除指定数据/重置未来学习安排/注销；有损动作需批准策略、二次确认与owner回执，未批准时只画关闭条件和安全帮助。
- 实际候选：[25:611](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=25-611)、[65:276](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=65-276)、[225:5646](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=225-5646)、[378:5857](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-5857)、[378:6024](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6024)、[378:6078](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6078)、[378:6131](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6131)、[378:6184](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6184)、[378:6234](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6234)、[378:6287](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6287)、[378:6322](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6322)、[378:6352](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6352)、[378:6387](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6387)、[378:6438](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6438)、[378:6494](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6494)、[378:6539](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6539)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-040 · 退出登录、账号切换与删除后的不同出口

- 需求：V2-980-0365、V2-980-0362。
- 页面：普通登出；待确认登出；删除中状态；取消后资格重读；匿名化完成说明。
- 状态：ordinary logout may login；deleting cannot resume learner；late old response ignored；private cache cleanup scope。
- 交互：普通退出→登录；删除冷静期→查/撤回；执行恢复→只读进度；匿名化→完成说明；不循环提示登录继续学习。
- 实际候选：[160:3411](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-3411)、[160:2205](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=160-2205)、[297:2713](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=297-2713)、[297:2958](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=297-2958)、[31:52](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=31-52)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-041 · FAQ九主题与20+可阅读自助内容

- 需求：V2-980-0412、V2-980-0392、V2-980-0456。
- 页面：FAQ目录；主题筛选/搜索；问题详情；无结果；加载失败。
- 状态：empty search not error；topic unavailable/closed；offline cached；safe contact fallback。
- 交互：问题分类→解答→有帮助/继续联系支持；至少20条实际自助设计内容，不能用一段“FAQ将包括”占位。
- 实际候选：[56:654](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=56-654)、[56:732](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=56-732)、[377:5442](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-5442)、[377:5661](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-5661)、[377:5868](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-5868)、[377:6075](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6075)、[377:6126](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6126)、[377:6168](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6168)、[377:6214](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6214)、[377:6254](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6254)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-042 · 七类工单、范围/脱敏说明与草稿校验

- 需求：V2-980-0412、V2-980-0388、V2-980-0457、V2-980-0458。
- 页面：分类选择；各类安全表单；必填校验；草稿取消。
- 状态：7canonical categories；no sensitive free text；consent/purpose unavailable；form no submit while invalid。
- 交互：选分类→安全内容引用/最小描述→校验→原请求提交；subject/tenant/owner/assignment/SLA不可客户端选择。
- 实际候选：[240:2080](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-2080)、[240:2214](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-2214)、[240:2942](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-2942)、[240:3670](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-3670)、[240:4398](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-4398)、[240:5126](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-5126)、[240:5854](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-5854)、[240:6582](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-6582)、[75:1028](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=75-1028)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-043 · 工单创建unknown与原操作查询安全返回

- 需求：V2-980-0412。
- 页面：create pending；query；query failed；not received；accepted receipt；safe later。
- 状态：same original request；NO ticket duplicate；receipt vs delivery distinct。
- 交互：提交→unknown→original query→明确未受理回草稿/已受理ticketId；安全离开重进仍查原请求。
- 实际候选：[194:1584](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-1584)、[194:1707](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-1707)、[194:1830](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-1830)、[194:1949](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-1949)、[240:2342](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-2342)、[240:2462](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-2462)、[240:2585](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-2585)、[240:2704](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-2704)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-044 · 附件选择/上传/扫描/授权/法律保全核验

- 需求：V2-980-0412。
- 页面：selected not uploaded；upload failure；unknown query；scan pending；clean safe preview；quarantine/denied。
- 状态：unknown scan/access/legal hold DENY；CLEAN only preview；upload receipt not ticket submitted；file-type/size validation。
- 交互：选择→上传查询→scan/access/hold checks→safePreviewRef→建单；拒绝保留草稿并可移除，未CLEAN不发送。
- 实际候选：[77:785](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=77-785)、[77:871](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=77-871)、[77:542](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=77-542)、[77:623](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=77-623)、[77:704](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=77-704)、[194:2577](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-2577)、[194:2698](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-2698)、[194:2827](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-2827)、[194:2947](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-2947)、[194:3067](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-3067)、[194:3187](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-3187)、[194:3307](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-3307)、[194:3426](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-3426)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-045 · 本人七态列表、分类/状态筛选和空/错/无权

- 需求：V2-980-0412、V2-980-0457。
- 页面：工单列表；filter chips；7态当前/历史；empty/loading/error/forbidden。
- 状态：OPEN；ASSIGNED；WAITING_USER；WAITING_INTERNAL；RESOLVED；CLOSED；REOPENED。
- 交互：列表筛选→本人详情→返回原筛选/分页；不显示其他人票据或把403当空。
- 实际候选：[77:297](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=77-297)、[77:461](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=77-461)、[79:1805](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1805)、[377:6498](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6498)、[377:7293](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7293)、[377:7335](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7335)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-046 · 工单详情、版本、SLA/处理记录和解决依据

- 需求：V2-980-0412、V2-980-0457。
- 页面：ticket detail；reply timeline；status history；resolution evidence；read-only closed。
- 状态：waiting user/internal；safe redacted preview；missing information historical；owner receipt absent。
- 交互：只展示获准安全内容/本人消息；状态由support返回，解决说明关联owner恢复事实；没有依据不假回复/假解决。
- 实际候选：[77:380](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=77-380)、[79:322](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-322)、[79:1033](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1033)、[79:1420](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1420)、[79:1728](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1728)、[377:6622](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6622)、[377:6686](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6686)、[377:6746](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6746)、[377:7006](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7006)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-047 · 用户补充回复、版本冲突、权限变化和已提交可见性

- 需求：V2-980-0412。
- 页面：reply draft；validation；processing；query；new message detail；latest vs draft。
- 状态：empty/filled；unknown/not submitted/accepted；stale version；permission changed。
- 交互：WAITING_USER→补充→expectedVersion→unknown原查询→回票据含本次消息；冲突保草稿看最新，不自动覆盖。
- 实际候选：[79:401](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-401)、[79:483](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-483)、[79:564](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-564)、[79:648](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-648)、[79:723](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-723)、[79:802](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-802)、[79:956](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-956)、[79:1033](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1033)、[79:1343](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1343)、[79:1420](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1420)、[79:1497](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1497)、[79:1882](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1882)、[194:2068](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-2068)、[194:2191](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-2191)、[377:6802](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6802)、[377:6864](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6864)、[377:6923](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6923)、[377:6968](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6968)、[377:7006](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7006)、[377:7061](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7061)、[377:7104](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7104)、[377:7137](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7137)、[377:7170](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7170)、[377:6622](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6622)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-048 · 解决后关闭、original query与关闭不等于领域修复

- 需求：V2-980-0412。
- 页面：RESOLVED close allowed；confirm；unknown/query；closed receipt/list。
- 状态：owner reconciliation missing disables close；not closed；closed；conflict。
- 交互：先有解决/owner receipt→确认关闭→查原请求→CLOSED；关闭不写订单/学习事实。
- 实际候选：[79:879](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-879)、[79:1110](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1110)、[79:1189](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1189)、[79:1266](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1266)、[79:1728](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1728)、[79:1805](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1805)、[194:2310](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-2310)、[194:2433](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=194-2433)、[377:6622](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6622)、[377:6864](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6864)、[377:6923](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6923)、[377:6968](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6968)、[377:7006](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7006)、[377:6746](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6746)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-049 · 获准窗口内重开、不可重开原因和新问题分流

- 需求：V2-980-0412。
- 页面：closed/resolved detail；reopen eligibility；reopen reason；query/result；new ticket alternative。
- 状态：allowed window；window expired；policy unconfirmed closed；stale state；unknown。
- 交互：已解决/关闭→看可重开条件→说明原问题未解决→same request查询→REOPENED，同票历史保留；策略不准入时入口禁用解释。
- 实际候选：[79:1728](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1728)、[79:1805](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=79-1805)、[377:7233](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7233)、[377:6864](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6864)、[377:6923](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6923)、[377:6968](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-6968)、[377:7006](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7006)、[377:7335](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=377-7335)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-050 · 内容纠错九类、关联版本上下文与本人记录

- 需求：V2-980-0411、V2-980-0459。
- 页面：content overflow report；9reason form；context preview；submitted/query；correction records/detail。
- 状态：missing context/version；safe attachments；unknown create；received/in review/returned/fixed published。
- 交互：具体content/question/lesson/course版本入口→类型→安全内容引用提交→本人记录可回看处理；发布修订不直接改旧attempt/原题版本。
- 实际候选：[240:2942](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-2942)、[240:3070](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-3070)、[240:3190](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-3190)、[240:3432](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=240-3432)、[378:6674](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6674)、[378:6772](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6772)、[378:6832](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6832)、[378:6887](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6887)、[378:6933](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6933)、[378:6976](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-6976)、[378:7016](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7016)、[378:7059](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7059)、[378:7114](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7114)、[378:7177](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7177)、[378:7244](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7244)、[378:7287](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7287)、[378:7330](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7330)、[378:7379](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=378-7379)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-051 · 页头快捷消息入口与未读红点/角标

- 需求：V2-980-0020。
- 页面：页头消息入口；未读数字/红点；快捷预览或直达本人消息中心。
- 状态：zero vs unread；loading/stale count；sensitive body hidden；pending read stays consistent。
- 交互：页头铃铛/角标→本人消息中心→详情/已读回执→角标由确认事实更新；未确认不消未读，新到消息留未读。
- 实际候选：[2:2](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=2-2)、[323:2850](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-2850)、[323:3988](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=323-3988)、[383:24937](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24937)、[383:24973](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-24973)、[383:25009](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-25009)、[383:25045](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=383-25045)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-AS-052 · 账号设置可达当前用户协议与隐私说明版本

- 需求：V2-980-0460、V2-980-0383。
- 页面：协议列表；当前发布协议详情；已签历史版本；版本不可用/加载失败。
- 状态：current/historical version；read-only；consent changed distinct from reading。
- 交互：设置隐私→当前协议/历史同意版本→只读正文→原设置；阅读不自动同意/续签，版本失效有明确返回。
- 实际候选：[65:276](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=65-276)、[184:2723](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-2723)、[184:2845](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=184-2845)、[165:1819](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1819)、[165:1903](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1903)、[165:1987](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=165-1987)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-GS-01 · Unified search panel, recent history and no-history state

- 需求：V2-980-0019。
- 页面：Unified search panel, recent history and no-history state。
- 状态：Normal/search-empty-input; history is actor-private。
- 交互：Choose recent term；Search current term；Manage history via account privacy。
- 实际候选：[389:14848](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-14848)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-GS-02 · Ten content-type facets and deterministic grouped results

- 需求：V2-980-0019。
- 页面：Ten content-type facets and deterministic grouped results。
- 状态：Loaded data projection; no vector/AI; no-result is distinct from failed read。
- 交互：All/type filter；Change term；Read result count and source metadata。
- 实际候选：[389:14908](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-14908)、[389:15194](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15194)、[389:15230](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15230)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-GS-03 · Type-specific result preview and source entity identity

- 需求：V2-980-0019。
- 页面：Type-specific result preview and source entity identity。
- 状态：Content ID/version/category preserved; private entries only actor-owned。
- 交互：Preview exact word/phrase/collocation/pattern/grammar/example/article/listening/course/personal expression；Open exact source after access check。
- 实际候选：[389:14944](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-14944)、[389:14980](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-14980)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-GS-04 · Read loading, empty, error and offline

- 需求：V2-980-0019。
- 页面：Read loading, empty, error and offline。
- 状态：No error disguised as zero hits; offline does not fabricate complete index or fresh rights。
- 交互：800ms visible loading then read result；Retry original query/filter；Clear type or modify term。
- 实际候选：[389:14884](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-14884)、[389:15004](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15004)、[389:15040](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15040)、[389:15076](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15076)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-GS-05 · 401,403,revoked and missing content

- 需求：V2-980-0019。
- 页面：401,403,revoked and missing content。
- 状态：Access check before source; denied/revoked projections are hidden, not cached as accessible。
- 交互：Authenticate through IAM entry；Account/privacy/support safe exits；Return to query without stale private disclosure。
- 实际候选：[389:15112](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15112)、[389:15129](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15129)、[389:15146](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15146)、[389:15170](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15170)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-GS-06 · Return from exact source to original query/filter/viewport

- 需求：V2-980-0019。
- 页面：Return from exact source to original query/filter/viewport。
- 状态：No generic home substituted for search-result context。
- 交互：Original-source return button visible only for active search context；Revalidate same query; keep selected category and1440/1024/768 layout。
- 实际候选：[389:14980](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-14980)、[389:14884](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-14884)、[389:14908](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-14908)、[389:15194](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15194)、[389:15230](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15230)。
- 整项核验：UNVERIFIED；OPEN。

## WEB-GS-07 · Native1440,1024 and768 search layouts

- 需求：V2-980-0019。
- 页面：Native1440,1024 and768 search layouts。
- 状态：No scaling1440; actual CSS zoom/keyboard/SR remain separate validation。
- 交互：Scroll result body while actions remain fixed；Read type/status labels beyond color。
- 实际候选：[389:14908](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-14908)、[389:15194](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15194)、[389:15230](https://www.figma.com/design/cbUQgN4Kdd3GrYeDVfF7sk/?node-id=389-15230)。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-AUTH-LOGIN · PAGE-P1-AUTH-LOGIN / 账号密码、returnTo、限流提示、会话恢复、成人 Gate 后续分流

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：账号密码、returnTo、限流提示、会话恢复、成人 Gate 后续分流。
- 状态：STATE-AUTH；密码只经 IAM TLS；服务端成人判定；Gateway 与服务双鉴权；Web Access Token 仅内存；mobile 仅 Keychain/Keystore；无普通 storage fallback；安全 returnTo allow-list。
- 交互：18+ 访客/学习者；官网登录、受保护深链、App 启动；登录→onboarding/原深链；注册/重置/官网；Web Access Token 仅内存；mobile 仅 Keychain/Keystore；无普通 storage fallback；安全 returnTo allow-list。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-AUTH-REGISTER-RESET · PAGE-P1-AUTH-REGISTER-RESET / 注册年龄与条款、密码重置请求/确认、失败锁定和结果出口

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：注册年龄与条款、密码重置请求/确认、失败锁定和结果出口。
- 状态：STATE-AUTH；仅成人公开注册；密码不得进入领域服务；重置 token 只经 IAM；Web 不落 token；mobile 安全存储；重置草稿不存密码。
- 交互：18+ 访客；login/官网 CTA；注册→成人 Gate/onboarding；重置→login；客服；Web 不落 token；mobile 安全存储；重置草稿不存密码。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-ADULT-CONSENT · PAGE-P1-ADULT-CONSENT / 年龄资格、成人声明、条款/隐私/必要同意版本、拒绝后的安全出口

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：年龄资格、成人声明、条款/隐私/必要同意版本、拒绝后的安全出口。
- 状态：STATE-AUTH；服务端成人 Gate 和 consent 为进入学习的硬 Gate；不能由客户端 role/字段绕过；同意事实服务端持久化；离线不能提交或放行；仅保留非敏感 UI 草稿。
- 交互：已登录新用户；登录后、受保护深链、未完成 Gate；同意→onboarding/assessment；拒绝→forbidden/官网合规；修改→privacy；同意事实服务端持久化；离线不能提交或放行；仅保留非敏感 UI 草稿。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-ONB-GOAL · PAGE-P1-ONB-GOAL / UI/content locale、目标语言、`FOUNDATION`/`COLLEGE_CET`/`POSTGRADUATE_ENGLISH`/`WORKPLACE_DAILY`、水平、每日 `5/15/30/45`、首个目标、首日任务预览

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：UI/content locale、目标语言、`FOUNDATION`/`COLLEGE_CET`/`POSTGRADUATE_ENGLISH`/`WORKPLACE_DAILY`、水平、每日 `5/15/30/45`、首个目标、首日任务预览。
- 状态：STATE-LEARN；成人、tenant、content rights；UI locale 与 contentLocale 分离；targetVersion 与兼容 stateVersion 等价且由服务端校验；B9 服务端是唯一事实源；profileVersion/preferenceVersion、targetVersion 与 IAM `eligibilitySnapshotVersion/eligibilitySnapshotDigest` 被 planning input pin；客户端不能提交原始 Gate/consent；草稿可本地/服务端受控，提交幂等；离线仅恢复草稿，不虚构成功。
- 交互：成人 Gate 通过的学习者；登录、首日、继续学习；保存→assessment 或 home；返回登录/退出；B9 服务端是唯一事实源；profileVersion/preferenceVersion、targetVersion 与 IAM `eligibilitySnapshotVersion/eligibilitySnapshotDigest` 被 planning input pin；客户端不能提交原始 Gate/consent；草稿可本地/服务端受控，提交幂等；离线仅恢复草稿，不虚构成功。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-ASSESSMENT · PAGE-P1-ASSESSMENT / 固定 `P1_PLACEMENT_V1` 10 题 manifest、步骤题、跳过、进度、断点、提交前确认

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：固定 `P1_PLACEMENT_V1` 10 题 manifest、步骤题、跳过、进度、断点、提交前确认。
- 状态：STATE-PRACTICE；adult Gate、session owner、目标/内容/规则 pin 和幂等键均服务端判定；403 不当空题；客户端 score/level/confidence/owner 无效；checkpoint 服务端持久化；同一 snapshot 恢复；原始作答不进入事件、分析或普通审计。
- 交互：完成 onboarding 的学习者；首日 CTA、继续学习；开始/继续→题目；完成→result/plan；跳过→`UNVERIFIED` 保守基线；checkpoint 服务端持久化；同一 snapshot 恢复；原始作答不进入事件、分析或普通审计。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-ASSESSMENT-RESULT · PAGE-P1-ASSESSMENT-RESULT / `ASSESSED` 显示规则化分数、参考等级、置信度、覆盖率和四维安全摘要；`SKIPPED` 只显示 `UNVERIFIED` 与可选非权威起点提示

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：`ASSESSED` 显示规则化分数、参考等级、置信度、覆盖率和四维安全摘要；`SKIPPED` 只显示 `UNVERIFIED` 与可选非权威起点提示。
- 状态：STATE-PRACTICE；只可读本人 report；服务端 owner/阶段判定；结果非官方认证，不能产生 mastery/SRS 权威事实；首次耐久 result/report 不可变；可缓存只读版本；计划失败仍保留报告并显示 recovery。
- 交互：完成或跳过 placement 的学习者；assessment success/恢复；继续→首日 `PROCESSING/READY/DEGRADED`；复测创建新 result，不覆盖旧 result/report；客服/恢复；首次耐久 result/report 不可变；可缓存只读版本；计划失败仍保留报告并显示 recovery。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-PLAN-MAP · PAGE-P1-PLAN-MAP / 计划节点、前置关系、当前阶段、锁定原因、课程/技能入口、继续上下文

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：计划节点、前置关系、当前阶段、锁定原因、课程/技能入口、继续上下文。
- 状态：STATE-LEARN；plan owner、content rights、阶段 Gate；锁定节点必须说明原因；plan 服务端事实；continue/checkpoint 幂等；离线只读已缓存 map。
- 交互：已有目标和 placement 结果的学习者；home/today/课程 CTA；开始/继续节点→course/session；回 today/home；plan 服务端事实；continue/checkpoint 幂等；离线只读已缓存 map。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-LEARN-HOME · PAGE-P1-LEARN-HOME / 继续学习、首日进度、今日摘要、推荐课程、状态/错误恢复

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：继续学习、首日进度、今日摘要、推荐课程、状态/错误恢复。
- 状态：STATE-LEARN；adult Gate、session/owner、内容版权；401/403 显式处理；first-day 仅显示 B9 owner 返回的 `NOT_READY`/`PROCESSING`/`READY`/`DEGRADED`；`PROCESSING` 显示回访任务，`DEGRADED` 显示只读恢复入口；projection 可短时缓存但不伪造计划结果。
- 交互：已登录学习者；登录后、tab 首页、官网登录回跳；继续→session；查看今日→today；查看计划→map；first-day 仅显示 B9 owner 返回的 `NOT_READY`/`PROCESSING`/`READY`/`DEGRADED`；`PROCESSING` 显示回访任务，`DEGRADED` 显示只读恢复入口；projection 可短时缓存但不伪造计划结果。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-TODAY · PAGE-P1-TODAY / 今日任务流、优先级、预计时长、完成状态、恢复提示

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：今日任务流、优先级、预计时长、完成状态、恢复提示。
- 状态：STATE-LEARN；`learning-service` 是 plan/task owner；成人/内容 Gate；任务事实服务端；可本地缓存排序；完成动作幂等，离线进入 pending；算法/SRS/mastery 不由本页或 M1-011 定义。
- 交互：已登录学习者；home/底部导航；开始任务→session；完成→下一个/报告；任务事实服务端；可本地缓存排序；完成动作幂等，离线进入 pending；算法/SRS/mastery 不由本页或 M1-011 定义。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-COURSE-SHELF · PAGE-P1-COURSE-SHELF / 课程目录、级别/技能筛选、解锁/版权状态、课程详情和进入学习

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：课程目录、级别/技能筛选、解锁/版权状态、课程详情和进入学习。
- 状态：STATE-LEARN；learner content rights、phase、tenant；不可用课程显式 permission/content 状态；筛选 URL/本地偏好；content snapshot 可离线只读，不能绕版权。
- 交互：已登录学习者；主导航/计划；选课/继续→技能或 session；回 plan；筛选 URL/本地偏好；content snapshot 可离线只读，不能绕版权。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-VOCAB · PAGE-P1-VOCAB / 词书、词条/词块/词根、个人库、SRS queue、掌握反馈

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：词书、词条/词块/词根、个人库、SRS queue、掌握反馈。
- 状态：STATE-PRACTICE；内容版权、owner、学习阶段；收藏/复习不得接受客户端掌握度；词卡/manifest 可按策略离线；复习事件本地队列，联网 syncReviewEvents。
- 交互：学习者；courses、practice、today；开始复习→SRS/session；收藏→library；回 plan；词卡/manifest 可按策略离线；复习事件本地队列，联网 syncReviewEvents。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-GRAMMAR · PAGE-P1-GRAMMAR / 语法树/知识点、句子图、陷阱、练习、掌握度和弱点出口

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：语法树/知识点、句子图、陷阱、练习、掌握度和弱点出口。
- 状态：STATE-PRACTICE；content rights、plan stage、session owner；练习 checkpoint/答案按 session；可缓存只读 grammar tree；提交幂等。
- 交互：学习者；courses、map、today；开始练习→session；弱点→report；回 map；练习 checkpoint/答案按 session；可缓存只读 grammar tree；提交幂等。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-LISTENING · PAGE-P1-LISTENING / 材料目录、播放器、逐句字幕/文本替代、精听/听写、进度、媒体状态、报告出口

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：材料目录、播放器、逐句字幕/文本替代、精听/听写、进度、媒体状态、报告出口。
- 状态：STATE-MEDIA；版权、设备能力、session owner、phase；源媒体非 `READY/CLEAN`、rights 撤销或字幕/文本替代缺失均显式拒绝，不显示为空列表；manifest/授权媒体按版权策略离线；progress/答题事件可排队并幂等同步；音频/字幕不可用时转文本或练习替代。
- 交互：学习者；courses、today、practice；播放/开始精听→session；完成→report/next；manifest/授权媒体按版权策略离线；progress/答题事件可排队并幂等同步；音频/字幕不可用时转文本或练习替代。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-READING · PAGE-P1-READING / 文章目录、reader、句子/段落标注、进度、挖掘和报告

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：文章目录、reader、句子/段落标注、进度、挖掘和报告。
- 状态：STATE-LEARN；content rights、owner、阶段；文章版本必须可追踪；reader progress/标注可本地草稿；同步冲突走 recovery，不覆盖服务端事实。
- 交互：学习者；courses、today、practice；阅读/继续→reader；挖掘→library；完成→report；reader progress/标注可本地草稿；同步冲突走 recovery，不覆盖服务端事实。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-SPEAKING · PAGE-P1-SPEAKING / 音素/口型、录音、回放、自评、shadowing attempt、失败恢复和静音练习出口

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：音素/口型、录音、回放、自评、shadowing attempt、失败恢复和静音练习出口。
- 状态：STATE-MEDIA；麦克风/设备 permission、content rights、本人 owner；拒绝权限仍可练习；Phase 1 不接 ASR、AI 评分、生成式 AI、数字人或 RTC；`LOCAL_ENCRYPTED_DRAFT` 与远端 recording asset 分态；上传可重试但不伪造评分；retention 仅引用 M1-017 policyRef/version，legal hold/delete/purge receipt 由服务端处理；录音不得直接写 SRS/mastery。
- 交互：学习者；courses、practice、phonetics；主动点击后申请录音专用 consent/麦克风→本地录音/重录→上传或本地保留→assessment attempt；完成→报告/下个任务；`LOCAL_ENCRYPTED_DRAFT` 与远端 recording asset 分态；上传可重试但不伪造评分；retention 仅引用 M1-017 policyRef/version，legal hold/delete/purge receipt 由服务端处理；录音不得直接写 SRS/mastery。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-WRITING · PAGE-P1-WRITING / prompt、草稿、提交、规则化评价、纠错和历史

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：prompt、草稿、提交、规则化评价、纠错和历史。
- 状态：STATE-PRACTICE；content rights、attempt owner；Phase 1 不生成式 AI；草稿本地/服务端版本化；提交幂等；离线只能保存 draft，不能声称评价完成。
- 交互：学习者；courses、today、report；保存草稿；提交→evaluation/correction；回 report；草稿本地/服务端版本化；提交幂等；离线只能保存 draft，不能声称评价完成。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-PRACTICE-HUB · PAGE-P1-PRACTICE-HUB / 待复习、快速练习、弱点、assessment、checkpoint 入口和任务摘要

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：待复习、快速练习、弱点、assessment、checkpoint 入口和任务摘要。
- 状态：STATE-PRACTICE；成人、plan、content rights；队列事实不可由客户端拼接；队列 projection 可短缓存；动作服务端幂等；离线显示 pending。
- 交互：学习者；tab、today、技能页；开始下一个→session；查看 SRS/report；回 today；队列 projection 可短缓存；动作服务端幂等；离线显示 pending。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-PRACTICE-SESSION · PAGE-P1-PRACTICE-SESSION / session、题目、答题、导航、计时（如规则需要）、答案反馈、提交结果

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：session、题目、答题、导航、计时（如规则需要）、答案反馈、提交结果。
- 状态：STATE-PRACTICE；session owner、阶段、内容版本、幂等；禁止信任 role header；checkpoint/答案按 session；离线按规则继续并入队；冲突走 recovery。
- 交互：学习者；hub/today/map/技能；暂存 checkpoint；提交/完成→report/next；退出→resume；checkpoint/答案按 session；离线按规则继续并入队；冲突走 recovery。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-SRS · PAGE-P1-SRS / SRS queue、间隔、评分、批次、提交与下一张卡

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：SRS queue、间隔、评分、批次、提交与下一张卡。
- 状态：STATE-PRACTICE；review owner、规则版本、幂等 eventId；不能客户端改 due/mastery；review 事件本地队列；syncReviewEvents 去重；离线只允许规则定义动作。
- 交互：学习者；today/practice/词卡；开始批次→review；暂停→resume；完成→report；review 事件本地队列；syncReviewEvents 去重；离线只允许规则定义动作。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-MISTAKES-MASTERY · PAGE-P1-MISTAKES-MASTERY / 错题列表/详情、重做、掌握验证、弱点聚合和解释

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：错题列表/详情、重做、掌握验证、弱点聚合和解释。
- 状态：STATE-PRACTICE；attempt/learner owner、内容版本；权限失败不可伪装 empty；只读报告缓存；重做/验证服务端幂等；离线标记 pending。
- 交互：学习者；practice/report/today；重做→session；验证→mastery；回 plan；只读报告缓存；重做/验证服务端幂等；离线标记 pending。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-CHECKPOINT · PAGE-P1-CHECKPOINT / 自动保存、断点列表、冲突版本、恢复/放弃确认

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：自动保存、断点列表、冲突版本、恢复/放弃确认。
- 状态：STATE-PRACTICE；session owner、版本和幂等；服务侧拒绝越权恢复；本地 draft + 服务端 session checkpoint；冲突不得静默覆盖；恢复需审计。
- 交互：学习者；退出 session、网络恢复、继续学习；恢复→session；放弃→安全返回；冲突→recovery；本地 draft + 服务端 session checkpoint；冲突不得静默覆盖；恢复需审计。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-REPORT · PAGE-P1-REPORT / 结果、解释、正确率、掌握/弱点、D+1/D+7 复习、分享安全出口

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：结果、解释、正确率、掌握/弱点、D+1/D+7 复习、分享安全出口。
- 状态：STATE-PRACTICE；仅本人报告；分享需脱敏/权限；内容/阶段事实服务端；报告只读缓存带版本；分享 asset 服务端；离线显示已同步报告。
- 交互：学习者；session 完成、today、practice；查看复习→queue；继续→plan；回 home；报告只读缓存带版本；分享 asset 服务端；离线显示已同步报告。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-WORLD · PAGE-P1-WORLD / 世界摘要、游戏、社交、avatar、奖励、房间和安全规则

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：世界摘要、游戏、社交、avatar、奖励、房间和安全规则。
- 状态：STATE-GROWTH；成人、社交可见性、阶段和 owner；Phase 1 规则能力；只读 summary 可短缓存；奖励/社交事实不离线伪造。
- 交互：学习者；主导航/探索；进入 games/social/avatar；回 home/practice；只读 summary 可短缓存；奖励/社交事实不离线伪造。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-GAME · PAGE-P1-GAME / 游戏目录、规则、开始/退出、可信完成和奖励结果

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：游戏目录、规则、开始/退出、可信完成和奖励结果。
- 状态：STATE-GROWTH；trusted completion、阶段、owner；不可由客户端发奖励；游戏规则/静态资源可缓存；完成和奖励必须在线事实/幂等。
- 交互：学习者；world CTA；开始/完成→reward/report；退出→world；游戏规则/静态资源可缓存；完成和奖励必须在线事实/幂等。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-SOCIAL · PAGE-P1-SOCIAL / study room、受控活动流、预设互动、leaderboard、可见性、举报、离开/恢复席位

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：study room、受控活动流、预设互动、leaderboard、可见性、举报、离开/恢复席位。
- 状态：STATE-GROWTH；成人、visibility、seat owner、moderation；服务端 PEP；Phase 1 禁止陌生人私聊和自由发帖；lease/focus 需在线；受控活动流可只读缓存；举报必须在线幂等。
- 交互：学习者；world；加入/退出房间；发送预设互动/举报；回 world；lease/focus 需在线；受控活动流可只读缓存；举报必须在线幂等。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-AVATAR-REWARD · PAGE-P1-AVATAR-REWARD / avatar、藏品、奖励 ledger、概率/领取、连续学习 streak

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：avatar、藏品、奖励 ledger、概率/领取、连续学习 streak。
- 状态：STATE-GROWTH；奖励资格/概率/领取由服务端；阶段和 owner Gate；ledger/claim 在线事实；静态 avatar 可缓存；重复领取幂等。
- 交互：学习者；world/reward CTA；领取→world；查看 ledger/collection；异常→support；ledger/claim 在线事实；静态 avatar 可缓存；重复领取幂等。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-COMMERCE · PAGE-P1-COMMERCE / 商品、权益、订单、支付意图、回调状态、恢复/客服

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：商品、权益、订单、支付意图、回调状态、恢复/客服。
- 状态：STATE-COMMERCE；IAM session、成人/地区/商品 rights；支付 provider callback 只信服务端；禁止离线下单；订单/支付状态服务端；客户端只保存安全 return context。
- 交互：学习者；pricing/世界/设置；查看/购买→payment；查询订单/权益；失败→recovery/support；禁止离线下单；订单/支付状态服务端；客户端只保存安全 return context。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-MESSAGES · PAGE-P1-MESSAGES / 未读、消息详情、已读、通知偏好、深链和安全过滤

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：未读、消息详情、已读、通知偏好、深链和安全过滤。
- 状态：STATE-LEARN；tenant/user owner；敏感消息需服务端权限；401/403 显式；已读 cursor 服务端；可缓存未读计数；离线只读并标 stale。
- 交互：学习者；home/header、客服/系统通知；打开详情→目标 page；全部已读；设置偏好；已读 cursor 服务端；可缓存未读计数；离线只读并标 stale。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-SYNC-OFFLINE · PAGE-P1-SYNC-OFFLINE / offline manifest、队列、cursor、冲突、重试、删除缓存、兼容版本

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：offline manifest、队列、cursor、冲突、重试、删除缓存、兼容版本。
- 状态：STATE-LEARN；设备/session owner、内容 rights；冲突 recovery 不可自动越权；mobile 本地队列 + secure storage；web IndexedDB/受控缓存；以服务端事实和幂等 sync 为准。
- 交互：学习者；网络失败、设置、技能页；立即同步/恢复冲突；查看缓存；回原业务页；mobile 本地队列 + secure storage；web IndexedDB/受控缓存；以服务端事实和幂等 sync 为准。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-SETTINGS · PAGE-P1-SETTINGS / UI locale/contentLocale、主题、暗色/高对比、动效等级、通知、学习偏好

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：UI locale/contentLocale、主题、暗色/高对比、动效等级、通知、学习偏好。
- 状态：STATE-LEARN；仅本人；主题/locale 不改变服务端 content rights；四级画质 Gate；preference 服务端 + 设备本地显示偏好；保存幂等；离线可改本地但标待同步。
- 交互：学习者；profile/me、header；保存→me/原页；恢复默认；性能帮助；preference 服务端 + 设备本地显示偏好；保存幂等；离线可改本地但标待同步。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-DEVICES · PAGE-P1-DEVICES / 设备列表、最近活动、当前设备、踢出、会话状态

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：设备列表、最近活动、当前设备、踢出、会话状态。
- 状态：STATE-AUTH；IAM principal/device owner；高风险操作需 re-auth/审计；设备事实不离线写；安全 session 只在系统安全存储。
- 交互：学习者；settings/security、异常登录；revoke device→确认→刷新；回 settings；设备事实不离线写；安全 session 只在系统安全存储。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-PRIVACY · PAGE-P1-PRIVACY / 数据说明、同意查看/撤回、导出、删除/保留策略、音频隐私

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：数据说明、同意查看/撤回、导出、删除/保留策略、音频隐私。
- 状态：STATE-AUTH；IAM/consent、owner、成人和审计；隐私失败不能伪装成功；导出请求服务端异步；不在普通 storage 保存 Token/原始音频；离线只读。
- 交互：学习者；settings/footer privacy；查看/导出→processing；撤回/删除→确认/客服；回 settings；导出请求服务端异步；不在普通 storage 保存 Token/原始音频；离线只读。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/PAGE-P1-SUPPORT · PAGE-P1-SUPPORT / FAQ/状态、创建工单、附件/trace ID、工单状态、恢复/客服出口

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：FAQ/状态、创建工单、附件/trace ID、工单状态、恢复/客服出口。
- 状态：STATE-LEARN；只读本人 ticket；附件/隐私按 PEP；不暴露内部审计；草稿可本地保存但脱敏；提交在线幂等；附件不可离线伪造上传。
- 交互：学习者；错误、支付、隐私、官网 CTA；创建/查看工单→processing/detail；回原页；草稿可本地保存但脱敏；提交在线幂等；附件不可离线伪造上传。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-01 · 访客浏览、注册与登录

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J01.1 浏览公开信息；J01.2 成人候选注册；J01.3 登录并恢复安全会话。
- 状态：发布撤回、版权失效或网络错误必须解释，不能伪装为空课程；参数/频率/重复账号错误不泄露账号存在性；重复请求按幂等键返回同一业务结果；不创建儿童、家长、权益或学习画像；刷新仅一次合并静默重试；重放/撤销/失败清理本地状态并回登录；Token 不进入 URL、日志、事件或埋点。
- 交互：step: J01.1 浏览公开信息；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 51；text: | J01.1 浏览公开信息 | `Official` `/`、`/courses`、`/pricing`；访客 | 公开内容、受控 `returnTo`；不携带业务 Token | `listB9PublicContentCatalog`、`getB9PublicContentProjection` | `content-service`／公开内容投影、版权/发布状态 | 无（只读） | 可公开展示的课程/价格/合规信息 | 登录或下载深链 | 发布撤回、版权失效或网络错误必须解释，不能伪装为空课程 | AC-C.1、AC-F.1、AC-K.3 |；cells: J01.1 浏览公开信息；`Official` `/`、`/courses`、`/pricing`；访客；公开内容、受控 `returnTo`；不携带业务 Token；`listB9PublicContentCatalog`、`getB9PublicContentProjection`；`content-service`／公开内容投影、版权/发布状态；无（只读）；可公开展示的课程/价格/合规信息；登录或下载深链；发布撤回、版权失效或网络错误必须解释，不能伪装为空课程；AC-C.1、AC-F.1、AC-K.3；normalizedCells: J01.1 浏览公开信息；`Official` `/`、`/courses`、`/pricing`；访客；公开内容、受控 `returnTo`；不携带业务 Token；`listB9PublicContentCatalog`、`getB9PublicContentProjection`；`content-service`／公开内容投影、版权/发布状态；无（只读）；可公开展示的课程/价格/合规信息；登录或下载深链；发布撤回、版权失效或网络错误必须解释，不能伪装为空课程；AC-C.1、AC-F.1、AC-K.3；columns: 步骤: J01.1 浏览公开信息；页面／角色: `Official` `/`、`/courses`、`/pricing`；访客；输入与前置: 公开内容、受控 `returnTo`；不携带业务 Token；API（operationId 或 GAP）: `listB9PublicContentCatalog`、`getB9PublicContentProjection`；服务／事实 owner: `content-service`／公开内容投影、版权/发布状态；状态／目标事件: 无（只读）；输出: 可公开展示的课程/价格/合规信息；下一步: 登录或下载深链；失败／补偿: 发布撤回、版权失效或网络错误必须解释，不能伪装为空课程；验收: AC-C.1、AC-F.1、AC-K.3；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J01.2 成人候选注册；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 52；text: | J01.2 成人候选注册 | `Mobile`/`Learner Web` `auth/*`；访客 | `identifier`、`password`、`device`；密码只经 TLS 到 IAM | `registerB8Account` | `iam-service`／账号、principal、设备/会话 | `auth.account.registered.v1` | 账号和受控认证会话；**尚无学习能力** | 成人 Gate | 参数/频率/重复账号错误不泄露账号存在性；重复请求按幂等键返回同一业务结果；不创建儿童、家长、权益或学习画像 | AC-A.1、AC-H.1、AC-H.5、AC-H.7 |；cells: J01.2 成人候选注册；`Mobile`/`Learner Web` `auth/*`；访客；`identifier`、`password`、`device`；密码只经 TLS 到 IAM；`registerB8Account`；`iam-service`／账号、principal、设备/会话；`auth.account.registered.v1`；账号和受控认证会话；**尚无学习能力**；成人 Gate；参数/频率/重复账号错误不泄露账号存在性；重复请求按幂等键返回同一业务结果；不创建儿童、家长、权益或学习画像；AC-A.1、AC-H.1、AC-H.5、AC-H.7；normalizedCells: J01.2 成人候选注册；`Mobile`/`Learner Web` `auth/*`；访客；`identifier`、`password`、`device`；密码只经 TLS 到 IAM；`registerB8Account`；`iam-service`／账号、principal、设备/会话；`auth.account.registered.v1`；账号和受控认证会话；**尚无学习能力**；成人 Gate；参数/频率/重复账号错误不泄露账号存在性；重复请求按幂等键返回同一业务结果；不创建儿童、家长、权益或学习画像；AC-A.1、AC-H.1、AC-H.5、AC-H.7；columns: 步骤: J01.2 成人候选注册；页面／角色: `Mobile`/`Learner Web` `auth/*`；访客；输入与前置: `identifier`、`password`、`device`；密码只经 TLS 到 IAM；API（operationId 或 GAP）: `registerB8Account`；服务／事实 owner: `iam-service`／账号、principal、设备/会话；状态／目标事件: `auth.account.registered.v1`；输出: 账号和受控认证会话；**尚无学习能力**；下一步: 成人 Gate；失败／补偿: 参数/频率/重复账号错误不泄露账号存在性；重复请求按幂等键返回同一业务结果；不创建儿童、家长、权益或学习画像；验收: AC-A.1、AC-H.1、AC-H.5、AC-H.7；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J01.3 登录并恢复安全会话；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 53；text: | J01.3 登录并恢复安全会话 | `Mobile`/`Learner Web` `auth/*`；已注册成人候选或已通过 Gate 的用户 | `identifier`、`password`、`device`；仅 IAM 验证凭据 | `loginB8Account`、`refreshB8JwtSession`、`getB8Principal` | `iam-service`／JWT 会话、设备、撤销事实 | `auth.login.succeeded.v1`、`auth.session.rotated.v1` | 内存 Access Token；Web 的 HttpOnly/Secure/SameSite Refresh Cookie 或移动端安全存储会话 | Gate 未完成则进入成人 Gate；否则进入 onboarding 或恢复的学习页 | 刷新仅一次合并静默重试；重放/撤销/失败清理本地状态并回登录；Token 不进入 URL、日志、事件或埋点 | AC-A.1、AC-H.1–AC-H.6、AC-K.3 |；cells: J01.3 登录并恢复安全会话；`Mobile`/`Learner Web` `auth/*`；已注册成人候选或已通过 Gate 的用户；`identifier`、`password`、`device`；仅 IAM 验证凭据；`loginB8Account`、`refreshB8JwtSession`、`getB8Principal`；`iam-service`／JWT 会话、设备、撤销事实；`auth.login.succeeded.v1`、`auth.session.rotated.v1`；内存 Access Token；Web 的 HttpOnly/Secure/SameSite Refresh Cookie 或移动端安全存储会话；Gate 未完成则进入成人 Gate；否则进入 onboarding 或恢复的学习页；刷新仅一次合并静默重试；重放/撤销/失败清理本地状态并回登录；Token 不进入 URL、日志、事件或埋点；AC-A.1、AC-H.1–AC-H.6、AC-K.3；normalizedCells: J01.3 登录并恢复安全会话；`Mobile`/`Learner Web` `auth/*`；已注册成人候选或已通过 Gate 的用户；`identifier`、`password`、`device`；仅 IAM 验证凭据；`loginB8Account`、`refreshB8JwtSession`、`getB8Principal`；`iam-service`／JWT 会话、设备、撤销事实；`auth.login.succeeded.v1`、`auth.session.rotated.v1`；内存 Access Token；Web 的 HttpOnly/Secure/SameSite Refresh Cookie 或移动端安全存储会话；Gate 未完成则进入成人 Gate；否则进入 onboarding 或恢复的学习页；刷新仅一次合并静默重试；重放/撤销/失败清理本地状态并回登录；Token 不进入 URL、日志、事件或埋点；AC-A.1、AC-H.1–AC-H.6、AC-K.3；columns: 步骤: J01.3 登录并恢复安全会话；页面／角色: `Mobile`/`Learner Web` `auth/*`；已注册成人候选或已通过 Gate 的用户；输入与前置: `identifier`、`password`、`device`；仅 IAM 验证凭据；API（operationId 或 GAP）: `loginB8Account`、`refreshB8JwtSession`、`getB8Principal`；服务／事实 owner: `iam-service`／JWT 会话、设备、撤销事实；状态／目标事件: `auth.login.succeeded.v1`、`auth.session.rotated.v1`；输出: 内存 Access Token；Web 的 HttpOnly/Secure/SameSite Refresh Cookie 或移动端安全存储会话；下一步: Gate 未完成则进入成人 Gate；否则进入 onboarding 或恢复的学习页；失败／补偿: 刷新仅一次合并静默重试；重放/撤销/失败清理本地状态并回登录；Token 不进入 URL、日志、事件或埋点；验收: AC-A.1、AC-H.1–AC-H.6、AC-K.3；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-02 · 成人 Gate、同意与可学习资格

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J02.1 服务端成人判定；J02.2 记录隐私与必要同意。
- 状态：拒绝时不创建儿童/监护/未成年人支付或 K12 主体；重试不改变已记录判定；权限失败须明示；并发版本冲突回读后确认；未同意时服务侧 PEP 默认拒绝相关能力，不能以本地勾选放行。
- 交互：step: J02.1 服务端成人判定；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 59；text: | J02.1 服务端成人判定 | `Mobile`/`Learner Web` `onboarding/*`；已认证主体 | `confirmed`、`birthYear`、`policyVersion`；JWT subject/tenant 由服务端派生 | `evaluateB8AdultGate` | `iam-service`／成人 Gate 判定、审计 | `PASSED` 或 `REJECTED`；目录已有 `auth.adult_gate.rejected.v1`；通过事件为 `EVENT-GAP-IAM-001`（除非确有跨域消费） | 通过才开放学习路径；拒绝页有安全退出 | 通过 → 同意；拒绝 → 公开页/退出 | 拒绝时不创建儿童/监护/未成年人支付或 K12 主体；重试不改变已记录判定；权限失败须明示 | AC-A.1、AC-H.8、AC-H.9、AC-K.3 |；cells: J02.1 服务端成人判定；`Mobile`/`Learner Web` `onboarding/*`；已认证主体；`confirmed`、`birthYear`、`policyVersion`；JWT subject/tenant 由服务端派生；`evaluateB8AdultGate`；`iam-service`／成人 Gate 判定、审计；`PASSED` 或 `REJECTED`；目录已有 `auth.adult_gate.rejected.v1`；通过事件为 `EVENT-GAP-IAM-001`（除非确有跨域消费）；通过才开放学习路径；拒绝页有安全退出；通过 → 同意；拒绝 → 公开页/退出；拒绝时不创建儿童/监护/未成年人支付或 K12 主体；重试不改变已记录判定；权限失败须明示；AC-A.1、AC-H.8、AC-H.9、AC-K.3；normalizedCells: J02.1 服务端成人判定；`Mobile`/`Learner Web` `onboarding/*`；已认证主体；`confirmed`、`birthYear`、`policyVersion`；JWT subject/tenant 由服务端派生；`evaluateB8AdultGate`；`iam-service`／成人 Gate 判定、审计；`PASSED` 或 `REJECTED`；目录已有 `auth.adult_gate.rejected.v1`；通过事件为 `EVENT-GAP-IAM-001`（除非确有跨域消费）；通过才开放学习路径；拒绝页有安全退出；通过 → 同意；拒绝 → 公开页/退出；拒绝时不创建儿童/监护/未成年人支付或 K12 主体；重试不改变已记录判定；权限失败须明示；AC-A.1、AC-H.8、AC-H.9、AC-K.3；columns: 步骤: J02.1 服务端成人判定；页面／角色: `Mobile`/`Learner Web` `onboarding/*`；已认证主体；输入与前置: `confirmed`、`birthYear`、`policyVersion`；JWT subject/tenant 由服务端派生；API（operationId 或 GAP）: `evaluateB8AdultGate`；服务／事实 owner: `iam-service`／成人 Gate 判定、审计；状态／目标事件: `PASSED` 或 `REJECTED`；目录已有 `auth.adult_gate.rejected.v1`；通过事件为 `EVENT-GAP-IAM-001`（除非确有跨域消费）；输出: 通过才开放学习路径；拒绝页有安全退出；下一步: 通过 → 同意；拒绝 → 公开页/退出；失败／补偿: 拒绝时不创建儿童/监护/未成年人支付或 K12 主体；重试不改变已记录判定；权限失败须明示；验收: AC-A.1、AC-H.8、AC-H.9、AC-K.3；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J02.2 记录隐私与必要同意；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 60；text: | J02.2 记录隐私与必要同意 | `Mobile`/`Learner Web` `onboarding/*` 或 `me/privacy`；已通过 Gate | 同意类型、版本、`decision`；可读当前版本 | `listB8Consents`、`updateB8Consent` | `iam-service`／同意记录、同意版本 | `auth.consent.updated.v1` | 可审计的同意状态 | 目标与时长设置；撤回时进入受限解释/数据处理流程 | 并发版本冲突回读后确认；未同意时服务侧 PEP 默认拒绝相关能力，不能以本地勾选放行 | AC-D.1、AC-H.8、AC-H.12、AC-L.2 |；cells: J02.2 记录隐私与必要同意；`Mobile`/`Learner Web` `onboarding/*` 或 `me/privacy`；已通过 Gate；同意类型、版本、`decision`；可读当前版本；`listB8Consents`、`updateB8Consent`；`iam-service`／同意记录、同意版本；`auth.consent.updated.v1`；可审计的同意状态；目标与时长设置；撤回时进入受限解释/数据处理流程；并发版本冲突回读后确认；未同意时服务侧 PEP 默认拒绝相关能力，不能以本地勾选放行；AC-D.1、AC-H.8、AC-H.12、AC-L.2；normalizedCells: J02.2 记录隐私与必要同意；`Mobile`/`Learner Web` `onboarding/*` 或 `me/privacy`；已通过 Gate；同意类型、版本、`decision`；可读当前版本；`listB8Consents`、`updateB8Consent`；`iam-service`／同意记录、同意版本；`auth.consent.updated.v1`；可审计的同意状态；目标与时长设置；撤回时进入受限解释/数据处理流程；并发版本冲突回读后确认；未同意时服务侧 PEP 默认拒绝相关能力，不能以本地勾选放行；AC-D.1、AC-H.8、AC-H.12、AC-L.2；columns: 步骤: J02.2 记录隐私与必要同意；页面／角色: `Mobile`/`Learner Web` `onboarding/*` 或 `me/privacy`；已通过 Gate；输入与前置: 同意类型、版本、`decision`；可读当前版本；API（operationId 或 GAP）: `listB8Consents`、`updateB8Consent`；服务／事实 owner: `iam-service`／同意记录、同意版本；状态／目标事件: `auth.consent.updated.v1`；输出: 可审计的同意状态；下一步: 目标与时长设置；撤回时进入受限解释/数据处理流程；失败／补偿: 并发版本冲突回读后确认；未同意时服务侧 PEP 默认拒绝相关能力，不能以本地勾选放行；验收: AC-D.1、AC-H.8、AC-H.12、AC-L.2；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-03 · 学习目标与每日时长

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J03.1 选择目标/时长；J03.2 由目标触发 planning input/首日投影。
- 状态：409/版本冲突需回读并让用户确认；同 key 同摘要返回首次耐久结果、同 key 异摘要冲突；不得采用旧 `5/10/20/30` 口径或由客户端修改 tenant/owner；计划失败不回滚已确认 target；`DEGRADED` 返回只读 recovery task/reference，允许 workflow 重放；不得在 BFF/前端跨域双写或把失败显示为空任务。
- 交互：step: J03.1 选择目标/时长；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 66；text: | J03.1 选择目标/时长 | `Mobile`/`Learner Web` `onboarding/goal`；成人 Gate、必要同意通过 | `goalCode ∈ {FOUNDATION,COLLEGE_CET,POSTGRADUATE_ENGLISH,WORKPLACE_DAILY}`、`targetLevel`、`dailyQuotaMinutes ∈ {5,15,30,45}`、`expectedTargetVersion`（兼容 `expectedStateVersion`） | `getB9LearnerTarget`、`putB9LearnerTarget` | `learner-service`／学习目标、目标版本；`targetVersion` 与 B9 兼容字段 `stateVersion` 强制等价 | D2 唯一目标事实事件为 `learner.target.updated.v1`；`EVENT-GAP-ONB-001` 已完成 catalog 契约签收 | 已确认目标事实与版本 | 定级或跳过定级后的首日编排 | 409/版本冲突需回读并让用户确认；同 key 同摘要返回首次耐久结果、同 key 异摘要冲突；不得采用旧 `5/10/20/30` 口径或由客户端修改 tenant/owner | AC-A.1、AC-A.4、AC-H.8、AC-I.3 |；cells: J03.1 选择目标/时长；`Mobile`/`Learner Web` `onboarding/goal`；成人 Gate、必要同意通过；`goalCode ∈ {FOUNDATION,COLLEGE_CET,POSTGRADUATE_ENGLISH,WORKPLACE_DAILY}`、`targetLevel`、`dailyQuotaMinutes ∈ {5,15,30,45}`、`expectedTargetVersion`（兼容 `expectedStateVersion`）；`getB9LearnerTarget`、`putB9LearnerTarget`；`learner-service`／学习目标、目标版本；`targetVersion` 与 B9 兼容字段 `stateVersion` 强制等价；D2 唯一目标事实事件为 `learner.target.updated.v1`；`EVENT-GAP-ONB-001` 已完成 catalog 契约签收；已确认目标事实与版本；定级或跳过定级后的首日编排；409/版本冲突需回读并让用户确认；同 key 同摘要返回首次耐久结果、同 key 异摘要冲突；不得采用旧 `5/10/20/30` 口径或由客户端修改 tenant/owner；AC-A.1、AC-A.4、AC-H.8、AC-I.3；normalizedCells: J03.1 选择目标/时长；`Mobile`/`Learner Web` `onboarding/goal`；成人 Gate、必要同意通过；`goalCode ∈ {FOUNDATION,COLLEGE_CET,POSTGRADUATE_ENGLISH,WORKPLACE_DAILY}`、`targetLevel`、`dailyQuotaMinutes ∈ {5,15,30,45}`、`expectedTargetVersion`（兼容 `expectedStateVersion`）；`getB9LearnerTarget`、`putB9LearnerTarget`；`learner-service`／学习目标、目标版本；`targetVersion` 与 B9 兼容字段 `stateVersion` 强制等价；D2 唯一目标事实事件为 `learner.target.updated.v1`；`EVENT-GAP-ONB-001` 已完成 catalog 契约签收；已确认目标事实与版本；定级或跳过定级后的首日编排；409/版本冲突需回读并让用户确认；同 key 同摘要返回首次耐久结果、同 key 异摘要冲突；不得采用旧 `5/10/20/30` 口径或由客户端修改 tenant/owner；AC-A.1、AC-A.4、AC-H.8、AC-I.3；columns: 步骤: J03.1 选择目标/时长；页面／角色: `Mobile`/`Learner Web` `onboarding/goal`；成人 Gate、必要同意通过；输入与前置: `goalCode ∈ {FOUNDATION,COLLEGE_CET,POSTGRADUATE_ENGLISH,WORKPLACE_DAILY}`、`targetLevel`、`dailyQuotaMinutes ∈ {5,15,30,45}`、`expectedTargetVersion`（兼容 `expectedStateVersion`）；API（operationId 或 GAP）: `getB9LearnerTarget`、`putB9LearnerTarget`；服务／事实 owner: `learner-service`／学习目标、目标版本；`targetVersion` 与 B9 兼容字段 `stateVersion` 强制等价；状态／目标事件: D2 唯一目标事实事件为 `learner.target.updated.v1`；`EVENT-GAP-ONB-001` 已完成 catalog 契约签收；输出: 已确认目标事实与版本；下一步: 定级或跳过定级后的首日编排；失败／补偿: 409/版本冲突需回读并让用户确认；同 key 同摘要返回首次耐久结果、同 key 异摘要冲突；不得采用旧 `5/10/20/30` 口径或由客户端修改 tenant/owner；验收: AC-A.1、AC-A.4、AC-H.8、AC-I.3；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J03.2 由目标触发 planning input/首日投影；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 67；text: | J03.2 由目标触发 planning input/首日投影 | 不是独立页面；系统衔接 | 已持久化 target、成人/同意状态、`profileVersion`、`preferenceVersion`；IAM 只提供服务端生成的 `eligibilitySnapshotVersion/eligibilitySnapshotDigest`，不传客户端 Gate/consent 布尔或 tenant/owner/plan | `CONTRACT-GAP-ONB-001`：已冻结 target → `learning-service` planning input → plan/`learner-service` first-day read projection 的 API、版本 pin、查询与恢复引用；`EVENT-GAP-ONB-001`：已冻结相同链路的 producer/consumer/binding，受 M1-006 catalog governance 约束 | `learner-service` 只拥有 profile/target/preferences 与 first-day read projection；`learning-service` 唯一拥有 immutable planning input、plan/today；`workflow-service` 只拥有恢复任务，不写领域表 | target 更新以 `targetId/targetVersion` 去重；首日投影按 target/version、IAM eligibility pin、planning-input digest、plan/version、content epoch 生成；catalog 签收只证明 D2 契约闭合，仍不是运行证明 | 安全、可回放的 planning input 与首日读投影 | `PROCESSING`→`READY`/`DEGRADED` 的首日查询 | 计划失败不回滚已确认 target；`DEGRADED` 返回只读 recovery task/reference，允许 workflow 重放；不得在 BFF/前端跨域双写或把失败显示为空任务 | AC-A.4、AC-A.5、AC-I.2–AC-I.5 |；cells: J03.2 由目标触发 planning input/首日投影；不是独立页面；系统衔接；已持久化 target、成人/同意状态、`profileVersion`、`preferenceVersion`；IAM 只提供服务端生成的 `eligibilitySnapshotVersion/eligibilitySnapshotDigest`，不传客户端 Gate/consent 布尔或 tenant/owner/plan；`CONTRACT-GAP-ONB-001`：已冻结 target → `learning-service` planning input → plan/`learner-service` first-day read projection 的 API、版本 pin、查询与恢复引用；`EVENT-GAP-ONB-001`：已冻结相同链路的 producer/consumer/binding，受 M1-006 catalog governance 约束；`learner-service` 只拥有 profile/target/preferences 与 first-day read projection；`learning-service` 唯一拥有 immutable planning input、plan/today；`workflow-service` 只拥有恢复任务，不写领域表；target 更新以 `targetId/targetVersion` 去重；首日投影按 target/version、IAM eligibility pin、planning-input digest、plan/version、content epoch 生成；catalog 签收只证明 D2 契约闭合，仍不是运行证明；安全、可回放的 planning input 与首日读投影；`PROCESSING`→`READY`/`DEGRADED` 的首日查询；计划失败不回滚已确认 target；`DEGRADED` 返回只读 recovery task/reference，允许 workflow 重放；不得在 BFF/前端跨域双写或把失败显示为空任务；AC-A.4、AC-A.5、AC-I.2–AC-I.5；normalizedCells: J03.2 由目标触发 planning input/首日投影；不是独立页面；系统衔接；已持久化 target、成人/同意状态、`profileVersion`、`preferenceVersion`；IAM 只提供服务端生成的 `eligibilitySnapshotVersion/eligibilitySnapshotDigest`，不传客户端 Gate/consent 布尔或 tenant/owner/plan；`CONTRACT-GAP-ONB-001`：已冻结 target → `learning-service` planning input → plan/`learner-service` first-day read projection 的 API、版本 pin、查询与恢复引用；`EVENT-GAP-ONB-001`：已冻结相同链路的 producer/consumer/binding，受 M1-006 catalog governance 约束；`learner-service` 只拥有 profile/target/preferences 与 first-day read projection；`learning-service` 唯一拥有 immutable planning input、plan/today；`workflow-service` 只拥有恢复任务，不写领域表；target 更新以 `targetId/targetVersion` 去重；首日投影按 target/version、IAM eligibility pin、planning-input digest、plan/version、content epoch 生成；catalog 签收只证明 D2 契约闭合，仍不是运行证明；安全、可回放的 planning input 与首日读投影；`PROCESSING`→`READY`/`DEGRADED` 的首日查询；计划失败不回滚已确认 target；`DEGRADED` 返回只读 recovery task/reference，允许 workflow 重放；不得在 BFF/前端跨域双写或把失败显示为空任务；AC-A.4、AC-A.5、AC-I.2–AC-I.5；columns: 步骤: J03.2 由目标触发 planning input/首日投影；页面／角色: 不是独立页面；系统衔接；输入与前置: 已持久化 target、成人/同意状态、`profileVersion`、`preferenceVersion`；IAM 只提供服务端生成的 `eligibilitySnapshotVersion/eligibilitySnapshotDigest`，不传客户端 Gate/consent 布尔或 tenant/owner/plan；API（operationId 或 GAP）: `CONTRACT-GAP-ONB-001`：已冻结 target → `learning-service` planning input → plan/`learner-service` first-day read projection 的 API、版本 pin、查询与恢复引用；`EVENT-GAP-ONB-001`：已冻结相同链路的 producer/consumer/binding，受 M1-006 catalog governance 约束；服务／事实 owner: `learner-service` 只拥有 profile/target/preferences 与 first-day read projection；`learning-service` 唯一拥有 immutable planning input、plan/today；`workflow-service` 只拥有恢复任务，不写领域表；状态／目标事件: target 更新以 `targetId/targetVersion` 去重；首日投影按 target/version、IAM eligibility pin、planning-input digest、plan/version、content epoch 生成；catalog 签收只证明 D2 契约闭合，仍不是运行证明；输出: 安全、可回放的 planning input 与首日读投影；下一步: `PROCESSING`→`READY`/`DEGRADED` 的首日查询；失败／补偿: 计划失败不回滚已确认 target；`DEGRADED` 返回只读 recovery task/reference，允许 workflow 重放；不得在 BFF/前端跨域双写或把失败显示为空任务；验收: AC-A.4、AC-A.5、AC-I.2–AC-I.5；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-04 · 规则化定级与中断恢复

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J04.1 创建/恢复定级会话；J04.2 提交题目与得到报告；J04.3 将结果交给计划编排。
- 状态：内容版本下线、权限或网络错误需解释；不要以空态掩盖；同一 session/snapshot 恢复，禁止客户端提交 owner、score、level 或规则 pin；断线后读同一 checkpoint；同 key 同 payload 重放原结果、异 payload 返回 409；报告只作产品参考，不宣称官方认证；B1 fast-track 只降映射为非权威跳过提示；Outbox/Kafka/Saga 只在 M2 运行验收；重复/乱序事件按 effect key 去重，计划写失败保留 assessment 报告并打开 owner-scoped recovery，workflow 不跨 owner 写表。
- 交互：step: J04.1 创建/恢复定级会话；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 73；text: | J04.1 创建/恢复定级会话 | `Mobile`/`Learner Web` `onboarding/placement`；目标已选，内容版本可用 | 认证主体；目标、内容、manifest 和答案规则 pin 全部由服务端派生 | canonical `createB10PlacementSession`、`getB10PlacementSession`；`startPlacementSession`/`readPlacementSession` 仅 deprecated B1 adapter | `assessment-service`／placement session、规则化判分与 checkpoint；不另建第二套 placement 状态机 | 沿用 B10 `CREATED/IN_PROGRESS/INTERRUPTED/SUBMITTING/COMPLETED/AUTO_SUBMITTED/CANCELLED/EXPIRED` | 可恢复的同一会话、10 题 manifest 与学习者安全题目快照 | 作答与 checkpoint | 内容版本下线、权限或网络错误需解释；不要以空态掩盖；同一 session/snapshot 恢复，禁止客户端提交 owner、score、level 或规则 pin | AC-A.2、AC-A.3、AC-B.2、AC-H.9 |；cells: J04.1 创建/恢复定级会话；`Mobile`/`Learner Web` `onboarding/placement`；目标已选，内容版本可用；认证主体；目标、内容、manifest 和答案规则 pin 全部由服务端派生；canonical `createB10PlacementSession`、`getB10PlacementSession`；`startPlacementSession`/`readPlacementSession` 仅 deprecated B1 adapter；`assessment-service`／placement session、规则化判分与 checkpoint；不另建第二套 placement 状态机；沿用 B10 `CREATED/IN_PROGRESS/INTERRUPTED/SUBMITTING/COMPLETED/AUTO_SUBMITTED/CANCELLED/EXPIRED`；可恢复的同一会话、10 题 manifest 与学习者安全题目快照；作答与 checkpoint；内容版本下线、权限或网络错误需解释；不要以空态掩盖；同一 session/snapshot 恢复，禁止客户端提交 owner、score、level 或规则 pin；AC-A.2、AC-A.3、AC-B.2、AC-H.9；normalizedCells: J04.1 创建/恢复定级会话；`Mobile`/`Learner Web` `onboarding/placement`；目标已选，内容版本可用；认证主体；目标、内容、manifest 和答案规则 pin 全部由服务端派生；canonical `createB10PlacementSession`、`getB10PlacementSession`；`startPlacementSession`/`readPlacementSession` 仅 deprecated B1 adapter；`assessment-service`／placement session、规则化判分与 checkpoint；不另建第二套 placement 状态机；沿用 B10 `CREATED/IN_PROGRESS/INTERRUPTED/SUBMITTING/COMPLETED/AUTO_SUBMITTED/CANCELLED/EXPIRED`；可恢复的同一会话、10 题 manifest 与学习者安全题目快照；作答与 checkpoint；内容版本下线、权限或网络错误需解释；不要以空态掩盖；同一 session/snapshot 恢复，禁止客户端提交 owner、score、level 或规则 pin；AC-A.2、AC-A.3、AC-B.2、AC-H.9；columns: 步骤: J04.1 创建/恢复定级会话；页面／角色: `Mobile`/`Learner Web` `onboarding/placement`；目标已选，内容版本可用；输入与前置: 认证主体；目标、内容、manifest 和答案规则 pin 全部由服务端派生；API（operationId 或 GAP）: canonical `createB10PlacementSession`、`getB10PlacementSession`；`startPlacementSession`/`readPlacementSession` 仅 deprecated B1 adapter；服务／事实 owner: `assessment-service`／placement session、规则化判分与 checkpoint；不另建第二套 placement 状态机；状态／目标事件: 沿用 B10 `CREATED/IN_PROGRESS/INTERRUPTED/SUBMITTING/COMPLETED/AUTO_SUBMITTED/CANCELLED/EXPIRED`；输出: 可恢复的同一会话、10 题 manifest 与学习者安全题目快照；下一步: 作答与 checkpoint；失败／补偿: 内容版本下线、权限或网络错误需解释；不要以空态掩盖；同一 session/snapshot 恢复，禁止客户端提交 owner、score、level 或规则 pin；验收: AC-A.2、AC-A.3、AC-B.2、AC-H.9；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J04.2 提交题目与得到报告；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 74；text: | J04.2 提交题目与得到报告 | `onboarding/placement`；成人学习者 | `sessionId`、`expectedStateVersion`、题号、闭合作答、耗时、响应摘要与幂等键 | canonical `submitB10PlacementResponse`、`getB10PlacementReport`；`submitPlacementStep`/`getB1PlacementReport` 仅 deprecated B1 adapter | `assessment-service`／作答、判分、首次耐久 result/report；原始作答只留在受保护判分边界 | 首次完成产生不可变 `ASSESSED`；跳过入口 `createB10PlacementSkipBaseline` 产生不可变 `SKIPPED` | 规则化分数、参考等级、置信度、覆盖率、四维安全摘要或 `UNVERIFIED` 跳过基线 | 生成计划和今日任务 | 断线后读同一 checkpoint；同 key 同 payload 重放原结果、异 payload 返回 409；报告只作产品参考，不宣称官方认证；B1 fast-track 只降映射为非权威跳过提示 | AC-A.2、AC-A.3、AC-B.2、AC-I.3 |；cells: J04.2 提交题目与得到报告；`onboarding/placement`；成人学习者；`sessionId`、`expectedStateVersion`、题号、闭合作答、耗时、响应摘要与幂等键；canonical `submitB10PlacementResponse`、`getB10PlacementReport`；`submitPlacementStep`/`getB1PlacementReport` 仅 deprecated B1 adapter；`assessment-service`／作答、判分、首次耐久 result/report；原始作答只留在受保护判分边界；首次完成产生不可变 `ASSESSED`；跳过入口 `createB10PlacementSkipBaseline` 产生不可变 `SKIPPED`；规则化分数、参考等级、置信度、覆盖率、四维安全摘要或 `UNVERIFIED` 跳过基线；生成计划和今日任务；断线后读同一 checkpoint；同 key 同 payload 重放原结果、异 payload 返回 409；报告只作产品参考，不宣称官方认证；B1 fast-track 只降映射为非权威跳过提示；AC-A.2、AC-A.3、AC-B.2、AC-I.3；normalizedCells: J04.2 提交题目与得到报告；`onboarding/placement`；成人学习者；`sessionId`、`expectedStateVersion`、题号、闭合作答、耗时、响应摘要与幂等键；canonical `submitB10PlacementResponse`、`getB10PlacementReport`；`submitPlacementStep`/`getB1PlacementReport` 仅 deprecated B1 adapter；`assessment-service`／作答、判分、首次耐久 result/report；原始作答只留在受保护判分边界；首次完成产生不可变 `ASSESSED`；跳过入口 `createB10PlacementSkipBaseline` 产生不可变 `SKIPPED`；规则化分数、参考等级、置信度、覆盖率、四维安全摘要或 `UNVERIFIED` 跳过基线；生成计划和今日任务；断线后读同一 checkpoint；同 key 同 payload 重放原结果、异 payload 返回 409；报告只作产品参考，不宣称官方认证；B1 fast-track 只降映射为非权威跳过提示；AC-A.2、AC-A.3、AC-B.2、AC-I.3；columns: 步骤: J04.2 提交题目与得到报告；页面／角色: `onboarding/placement`；成人学习者；输入与前置: `sessionId`、`expectedStateVersion`、题号、闭合作答、耗时、响应摘要与幂等键；API（operationId 或 GAP）: canonical `submitB10PlacementResponse`、`getB10PlacementReport`；`submitPlacementStep`/`getB1PlacementReport` 仅 deprecated B1 adapter；服务／事实 owner: `assessment-service`／作答、判分、首次耐久 result/report；原始作答只留在受保护判分边界；状态／目标事件: 首次完成产生不可变 `ASSESSED`；跳过入口 `createB10PlacementSkipBaseline` 产生不可变 `SKIPPED`；输出: 规则化分数、参考等级、置信度、覆盖率、四维安全摘要或 `UNVERIFIED` 跳过基线；下一步: 生成计划和今日任务；失败／补偿: 断线后读同一 checkpoint；同 key 同 payload 重放原结果、异 payload 返回 409；报告只作产品参考，不宣称官方认证；B1 fast-track 只降映射为非权威跳过提示；验收: AC-A.2、AC-A.3、AC-B.2、AC-I.3；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J04.3 将结果交给计划编排；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 75；text: | J04.3 将结果交给计划编排 | 系统衔接 | 首个耐久 placement result/report、target/content/rule/manifest pins；learning 从 completion envelope 派生 source/root lineage | canonical `assessment.placement.completed.v1`；`workflow-service` 按 `VALIDATE_COMPLETION_FACT → ASSEMBLE_OR_REPLAY_PLANNING_INPUT → CREATE_OR_REPLAY_INITIAL_PLAN → PROJECT_LEARNER_REFERENCE` 协调 | `assessment-service` 保留结果/报告；`learning-service` 拥有 planning input/计划；`learner-service` 只拥有首日投影 | `CONTRACT-GAP-ONB-002`、`EVENT-GAP-ONB-002`、`EVENT-GAP-PLACEMENT-PLAN` 已完成 M1-012 静态 D2 闭合；仍为 `NOT_RUNTIME_VERIFIED` | 可查询 `PROCESSING/READY/DEGRADED` 首日状态 | 首日页 | Outbox/Kafka/Saga 只在 M2 运行验收；重复/乱序事件按 effect key 去重，计划写失败保留 assessment 报告并打开 owner-scoped recovery，workflow 不跨 owner 写表 | AC-A.2、AC-A.4、AC-A.5、AC-I.2–AC-I.5 |；cells: J04.3 将结果交给计划编排；系统衔接；首个耐久 placement result/report、target/content/rule/manifest pins；learning 从 completion envelope 派生 source/root lineage；canonical `assessment.placement.completed.v1`；`workflow-service` 按 `VALIDATE_COMPLETION_FACT → ASSEMBLE_OR_REPLAY_PLANNING_INPUT → CREATE_OR_REPLAY_INITIAL_PLAN → PROJECT_LEARNER_REFERENCE` 协调；`assessment-service` 保留结果/报告；`learning-service` 拥有 planning input/计划；`learner-service` 只拥有首日投影；`CONTRACT-GAP-ONB-002`、`EVENT-GAP-ONB-002`、`EVENT-GAP-PLACEMENT-PLAN` 已完成 M1-012 静态 D2 闭合；仍为 `NOT_RUNTIME_VERIFIED`；可查询 `PROCESSING/READY/DEGRADED` 首日状态；首日页；Outbox/Kafka/Saga 只在 M2 运行验收；重复/乱序事件按 effect key 去重，计划写失败保留 assessment 报告并打开 owner-scoped recovery，workflow 不跨 owner 写表；AC-A.2、AC-A.4、AC-A.5、AC-I.2–AC-I.5；normalizedCells: J04.3 将结果交给计划编排；系统衔接；首个耐久 placement result/report、target/content/rule/manifest pins；learning 从 completion envelope 派生 source/root lineage；canonical `assessment.placement.completed.v1`；`workflow-service` 按 `VALIDATE_COMPLETION_FACT → ASSEMBLE_OR_REPLAY_PLANNING_INPUT → CREATE_OR_REPLAY_INITIAL_PLAN → PROJECT_LEARNER_REFERENCE` 协调；`assessment-service` 保留结果/报告；`learning-service` 拥有 planning input/计划；`learner-service` 只拥有首日投影；`CONTRACT-GAP-ONB-002`、`EVENT-GAP-ONB-002`、`EVENT-GAP-PLACEMENT-PLAN` 已完成 M1-012 静态 D2 闭合；仍为 `NOT_RUNTIME_VERIFIED`；可查询 `PROCESSING/READY/DEGRADED` 首日状态；首日页；Outbox/Kafka/Saga 只在 M2 运行验收；重复/乱序事件按 effect key 去重，计划写失败保留 assessment 报告并打开 owner-scoped recovery，workflow 不跨 owner 写表；AC-A.2、AC-A.4、AC-A.5、AC-I.2–AC-I.5；columns: 步骤: J04.3 将结果交给计划编排；页面／角色: 系统衔接；输入与前置: 首个耐久 placement result/report、target/content/rule/manifest pins；learning 从 completion envelope 派生 source/root lineage；API（operationId 或 GAP）: canonical `assessment.placement.completed.v1`；`workflow-service` 按 `VALIDATE_COMPLETION_FACT → ASSEMBLE_OR_REPLAY_PLANNING_INPUT → CREATE_OR_REPLAY_INITIAL_PLAN → PROJECT_LEARNER_REFERENCE` 协调；服务／事实 owner: `assessment-service` 保留结果/报告；`learning-service` 拥有 planning input/计划；`learner-service` 只拥有首日投影；状态／目标事件: `CONTRACT-GAP-ONB-002`、`EVENT-GAP-ONB-002`、`EVENT-GAP-PLACEMENT-PLAN` 已完成 M1-012 静态 D2 闭合；仍为 `NOT_RUNTIME_VERIFIED`；输出: 可查询 `PROCESSING/READY/DEGRADED` 首日状态；下一步: 首日页；失败／补偿: Outbox/Kafka/Saga 只在 M2 运行验收；重复/乱序事件按 effect key 去重，计划写失败保留 assessment 报告并打开 owner-scoped recovery，workflow 不跨 owner 写表；验收: AC-A.2、AC-A.4、AC-A.5、AC-I.2–AC-I.5；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-05 · 首日计划、首页与每日任务

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J05.1 读取首日与当前计划；J05.2 处理今日任务动作。
- 状态：无计划/推荐、加载、Gate/权限、内容下线、弱网均各自说明；`PROCESSING` 显示任务/回访方式，`DEGRADED` 提供只读 recovery；不把计划生成失败显示为空任务；重复点击/离线回放按幂等上下文去重；进度冲突保留事实并提供恢复，不能直接给积分。
- 交互：step: J05.1 读取首日与当前计划；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 81；text: | J05.1 读取首日与当前计划 | `Mobile` `learn`、`Learner Web` `learn/home`；成人学习者 | 已完成 target；若完成定级则仅带 M1-012 定义的结果引用；first-day read 必须带 `targetVersion`、`profileVersion`、`preferenceVersion`、IAM eligibility version/digest、planning-input digest、plan/version、content epoch 的可验证 pin | `getB9FirstDayProjection`、`getCurrentLearningPlan`、`getTodayLearningStream` | `learner-service`／首日 read projection；`learning-service`／planning input、计划、今日 stream | first-day closed states：`NOT_READY`/`PROCESSING`/`READY`/`DEGRADED`；读取不另发事件 | 首个目标、今日任务、继续学习入口或可解释恢复入口 | 进入一个任务或课程 | 无计划/推荐、加载、Gate/权限、内容下线、弱网均各自说明；`PROCESSING` 显示任务/回访方式，`DEGRADED` 提供只读 recovery；不把计划生成失败显示为空任务 | AC-A.4、AC-A.5、AC-F.1、AC-K.3 |；cells: J05.1 读取首日与当前计划；`Mobile` `learn`、`Learner Web` `learn/home`；成人学习者；已完成 target；若完成定级则仅带 M1-012 定义的结果引用；first-day read 必须带 `targetVersion`、`profileVersion`、`preferenceVersion`、IAM eligibility version/digest、planning-input digest、plan/version、content epoch 的可验证 pin；`getB9FirstDayProjection`、`getCurrentLearningPlan`、`getTodayLearningStream`；`learner-service`／首日 read projection；`learning-service`／planning input、计划、今日 stream；first-day closed states：`NOT_READY`/`PROCESSING`/`READY`/`DEGRADED`；读取不另发事件；首个目标、今日任务、继续学习入口或可解释恢复入口；进入一个任务或课程；无计划/推荐、加载、Gate/权限、内容下线、弱网均各自说明；`PROCESSING` 显示任务/回访方式，`DEGRADED` 提供只读 recovery；不把计划生成失败显示为空任务；AC-A.4、AC-A.5、AC-F.1、AC-K.3；normalizedCells: J05.1 读取首日与当前计划；`Mobile` `learn`、`Learner Web` `learn/home`；成人学习者；已完成 target；若完成定级则仅带 M1-012 定义的结果引用；first-day read 必须带 `targetVersion`、`profileVersion`、`preferenceVersion`、IAM eligibility version/digest、planning-input digest、plan/version、content epoch 的可验证 pin；`getB9FirstDayProjection`、`getCurrentLearningPlan`、`getTodayLearningStream`；`learner-service`／首日 read projection；`learning-service`／planning input、计划、今日 stream；first-day closed states：`NOT_READY`/`PROCESSING`/`READY`/`DEGRADED`；读取不另发事件；首个目标、今日任务、继续学习入口或可解释恢复入口；进入一个任务或课程；无计划/推荐、加载、Gate/权限、内容下线、弱网均各自说明；`PROCESSING` 显示任务/回访方式，`DEGRADED` 提供只读 recovery；不把计划生成失败显示为空任务；AC-A.4、AC-A.5、AC-F.1、AC-K.3；columns: 步骤: J05.1 读取首日与当前计划；页面／角色: `Mobile` `learn`、`Learner Web` `learn/home`；成人学习者；输入与前置: 已完成 target；若完成定级则仅带 M1-012 定义的结果引用；first-day read 必须带 `targetVersion`、`profileVersion`、`preferenceVersion`、IAM eligibility version/digest、planning-input digest、plan/version、content epoch 的可验证 pin；API（operationId 或 GAP）: `getB9FirstDayProjection`、`getCurrentLearningPlan`、`getTodayLearningStream`；服务／事实 owner: `learner-service`／首日 read projection；`learning-service`／planning input、计划、今日 stream；状态／目标事件: first-day closed states：`NOT_READY`/`PROCESSING`/`READY`/`DEGRADED`；读取不另发事件；输出: 首个目标、今日任务、继续学习入口或可解释恢复入口；下一步: 进入一个任务或课程；失败／补偿: 无计划/推荐、加载、Gate/权限、内容下线、弱网均各自说明；`PROCESSING` 显示任务/回访方式，`DEGRADED` 提供只读 recovery；不把计划生成失败显示为空任务；验收: AC-A.4、AC-A.5、AC-F.1、AC-K.3；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J05.2 处理今日任务动作；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 82；text: | J05.2 处理今日任务动作 | `learn`；成人学习者 | stream action、`contentVersionId`、`clientEventId`、状态版本/幂等键 | `submitLearningStreamAction` | `learning-service`／任务进度、学习会话 | `learning.task.completed.v2` 仅在未来专用契约完成后接入；当前不作为奖励来源。`learning.task.completed.v1` 仅限历史/迁移，不是 canonical/runtime 事实 | 更新的任务状态、下一任务或复习入口 | 内容/练习/SRS/报告 | 重复点击/离线回放按幂等上下文去重；进度冲突保留事实并提供恢复，不能直接给积分 | AC-A.5、AC-B.3、AC-F.3、AC-I.4 |；cells: J05.2 处理今日任务动作；`learn`；成人学习者；stream action、`contentVersionId`、`clientEventId`、状态版本/幂等键；`submitLearningStreamAction`；`learning-service`／任务进度、学习会话；`learning.task.completed.v2` 仅在未来专用契约完成后接入；当前不作为奖励来源。`learning.task.completed.v1` 仅限历史/迁移，不是 canonical/runtime 事实；更新的任务状态、下一任务或复习入口；内容/练习/SRS/报告；重复点击/离线回放按幂等上下文去重；进度冲突保留事实并提供恢复，不能直接给积分；AC-A.5、AC-B.3、AC-F.3、AC-I.4；normalizedCells: J05.2 处理今日任务动作；`learn`；成人学习者；stream action、`contentVersionId`、`clientEventId`、状态版本/幂等键；`submitLearningStreamAction`；`learning-service`／任务进度、学习会话；`learning.task.completed.v2` 仅在未来专用契约完成后接入；当前不作为奖励来源。`learning.task.completed.v1` 仅限历史/迁移，不是 canonical/runtime 事实；更新的任务状态、下一任务或复习入口；内容/练习/SRS/报告；重复点击/离线回放按幂等上下文去重；进度冲突保留事实并提供恢复，不能直接给积分；AC-A.5、AC-B.3、AC-F.3、AC-I.4；columns: 步骤: J05.2 处理今日任务动作；页面／角色: `learn`；成人学习者；输入与前置: stream action、`contentVersionId`、`clientEventId`、状态版本/幂等键；API（operationId 或 GAP）: `submitLearningStreamAction`；服务／事实 owner: `learning-service`／任务进度、学习会话；状态／目标事件: `learning.task.completed.v2` 仅在未来专用契约完成后接入；当前不作为奖励来源。`learning.task.completed.v1` 仅限历史/迁移，不是 canonical/runtime 事实；输出: 更新的任务状态、下一任务或复习入口；下一步: 内容/练习/SRS/报告；失败／补偿: 重复点击/离线回放按幂等上下文去重；进度冲突保留事实并提供恢复，不能直接给积分；验收: AC-A.5、AC-B.3、AC-F.3、AC-I.4；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-06 · 课程内容、媒体与规则化练习

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J06.1 获取可学习内容快照；J06.2 创建练习并保存 checkpoint；J06.3 提交并取得规则反馈；J06.4 媒体/跟读分支。
- 状态：内容下线、版权/权益拒绝、媒体不可用必须给可学习替代或返回今日任务；不能以 404/空列表掩盖；同版本同摘要幂等返回；旧版本、异摘要、过期 base version 或终态写入 409；页面离开/弱网后从最后安全 checkpoint 恢复；422 保留输入；超时查同一 attempt；重复提交不得重算分数、掌握度或奖励；原始作答/答案规则不进事件；拒绝麦克风仍可静音练习；本地加密草稿与远端录音资产分态；上传失败保留本地安全副本并可查询/重试；源 rights 撤销立即拒绝源音频/官方字幕；Phase 1 不出现 ASR、AI 分数、生成式 AI、数字人或 RTC，录音不得直接写 SRS/mastery。
- 交互：step: J06.1 获取可学习内容快照；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 88；text: | J06.1 获取可学习内容快照 | `courses/*`、`practice/*`、`ReaderShell`；成人学习者 | `contentCode`/`contentVersionId`、权益与版权状态 | `listB9LearnerContentCatalog`、`getB9LearnerContentProjection`、`getB10LearnerContentSnapshot` | `content-service`／发布内容、题目、答案规则版本、版权；学习端只读 | 无（只读） | 绑定版本的课程/题目/媒体入口 | 阅读、听力、口语、写作或练习会话 | 内容下线、版权/权益拒绝、媒体不可用必须给可学习替代或返回今日任务；不能以 404/空列表掩盖 | AC-B.1、AC-B.2、AC-C.1、AC-H.8 |；cells: J06.1 获取可学习内容快照；`courses/*`、`practice/*`、`ReaderShell`；成人学习者；`contentCode`/`contentVersionId`、权益与版权状态；`listB9LearnerContentCatalog`、`getB9LearnerContentProjection`、`getB10LearnerContentSnapshot`；`content-service`／发布内容、题目、答案规则版本、版权；学习端只读；无（只读）；绑定版本的课程/题目/媒体入口；阅读、听力、口语、写作或练习会话；内容下线、版权/权益拒绝、媒体不可用必须给可学习替代或返回今日任务；不能以 404/空列表掩盖；AC-B.1、AC-B.2、AC-C.1、AC-H.8；normalizedCells: J06.1 获取可学习内容快照；`courses/*`、`practice/*`、`ReaderShell`；成人学习者；`contentCode`/`contentVersionId`、权益与版权状态；`listB9LearnerContentCatalog`、`getB9LearnerContentProjection`、`getB10LearnerContentSnapshot`；`content-service`／发布内容、题目、答案规则版本、版权；学习端只读；无（只读）；绑定版本的课程/题目/媒体入口；阅读、听力、口语、写作或练习会话；内容下线、版权/权益拒绝、媒体不可用必须给可学习替代或返回今日任务；不能以 404/空列表掩盖；AC-B.1、AC-B.2、AC-C.1、AC-H.8；columns: 步骤: J06.1 获取可学习内容快照；页面／角色: `courses/*`、`practice/*`、`ReaderShell`；成人学习者；输入与前置: `contentCode`/`contentVersionId`、权益与版权状态；API（operationId 或 GAP）: `listB9LearnerContentCatalog`、`getB9LearnerContentProjection`、`getB10LearnerContentSnapshot`；服务／事实 owner: `content-service`／发布内容、题目、答案规则版本、版权；学习端只读；状态／目标事件: 无（只读）；输出: 绑定版本的课程/题目/媒体入口；下一步: 阅读、听力、口语、写作或练习会话；失败／补偿: 内容下线、版权/权益拒绝、媒体不可用必须给可学习替代或返回今日任务；不能以 404/空列表掩盖；验收: AC-B.1、AC-B.2、AC-C.1、AC-H.8；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J06.2 创建练习并保存 checkpoint；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 89；text: | J06.2 创建练习并保存 checkpoint | `PracticeShell`；成人学习者 | 不可变 content/rule pin、session stateVersion；受保护草稿与 `checkpointVersion/clientEventId/clientSeq/checkpointDigest` | `createB10AssessmentSession`、`getB10AssessmentSession`、`putB10AssessmentSessionCheckpoint`；旧 attempt/B2 checkpoint 仅 deprecated adapter | `assessment-service`／session 和提交前 checkpoint；attempt 只在正式提交时创建 | `CREATED` / `IN_PROGRESS` / `INTERRUPTED`；checkpoint 本身不是跨域事件 | 可恢复的同一练习会话 | 提交 attempt | 同版本同摘要幂等返回；旧版本、异摘要、过期 base version 或终态写入 409；页面离开/弱网后从最后安全 checkpoint 恢复 | AC-A.2、AC-B.3、AC-F.3、AC-I.3 |；cells: J06.2 创建练习并保存 checkpoint；`PracticeShell`；成人学习者；不可变 content/rule pin、session stateVersion；受保护草稿与 `checkpointVersion/clientEventId/clientSeq/checkpointDigest`；`createB10AssessmentSession`、`getB10AssessmentSession`、`putB10AssessmentSessionCheckpoint`；旧 attempt/B2 checkpoint 仅 deprecated adapter；`assessment-service`／session 和提交前 checkpoint；attempt 只在正式提交时创建；`CREATED` / `IN_PROGRESS` / `INTERRUPTED`；checkpoint 本身不是跨域事件；可恢复的同一练习会话；提交 attempt；同版本同摘要幂等返回；旧版本、异摘要、过期 base version 或终态写入 409；页面离开/弱网后从最后安全 checkpoint 恢复；AC-A.2、AC-B.3、AC-F.3、AC-I.3；normalizedCells: J06.2 创建练习并保存 checkpoint；`PracticeShell`；成人学习者；不可变 content/rule pin、session stateVersion；受保护草稿与 `checkpointVersion/clientEventId/clientSeq/checkpointDigest`；`createB10AssessmentSession`、`getB10AssessmentSession`、`putB10AssessmentSessionCheckpoint`；旧 attempt/B2 checkpoint 仅 deprecated adapter；`assessment-service`／session 和提交前 checkpoint；attempt 只在正式提交时创建；`CREATED` / `IN_PROGRESS` / `INTERRUPTED`；checkpoint 本身不是跨域事件；可恢复的同一练习会话；提交 attempt；同版本同摘要幂等返回；旧版本、异摘要、过期 base version 或终态写入 409；页面离开/弱网后从最后安全 checkpoint 恢复；AC-A.2、AC-B.3、AC-F.3、AC-I.3；columns: 步骤: J06.2 创建练习并保存 checkpoint；页面／角色: `PracticeShell`；成人学习者；输入与前置: 不可变 content/rule pin、session stateVersion；受保护草稿与 `checkpointVersion/clientEventId/clientSeq/checkpointDigest`；API（operationId 或 GAP）: `createB10AssessmentSession`、`getB10AssessmentSession`、`putB10AssessmentSessionCheckpoint`；旧 attempt/B2 checkpoint 仅 deprecated adapter；服务／事实 owner: `assessment-service`／session 和提交前 checkpoint；attempt 只在正式提交时创建；状态／目标事件: `CREATED` / `IN_PROGRESS` / `INTERRUPTED`；checkpoint 本身不是跨域事件；输出: 可恢复的同一练习会话；下一步: 提交 attempt；失败／补偿: 同版本同摘要幂等返回；旧版本、异摘要、过期 base version 或终态写入 409；页面离开/弱网后从最后安全 checkpoint 恢复；验收: AC-A.2、AC-B.3、AC-F.3、AC-I.3；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J06.3 提交并取得规则反馈；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 90；text: | J06.3 提交并取得规则反馈 | `PracticeShell`；成人学习者 | `expectedStateVersion`、`submissionId/submissionDigest`、封闭作答分支、`clientEventId`、幂等键；attemptId 由服务端生成 | `submitB10AssessmentAttempt`、`getB10AssessmentReport` | `assessment-service`／attempt、判分、错因、报告快照 | `assessment.attempt.submitted.v1` → `assessment.attempt.assessed.v1` 仅为历史 payload 候选；本轮不声明 Kafka 发布/消费 | 规则化分数、错因、参考答案/建议、attempt 版本 | SRS、错题修复、报告或继续学习（待 M1-013 接通） | 422 保留输入；超时查同一 attempt；重复提交不得重算分数、掌握度或奖励；原始作答/答案规则不进事件 | AC-B.2–AC-B.5、AC-F.2、AC-I.3–AC-I.5 |；cells: J06.3 提交并取得规则反馈；`PracticeShell`；成人学习者；`expectedStateVersion`、`submissionId/submissionDigest`、封闭作答分支、`clientEventId`、幂等键；attemptId 由服务端生成；`submitB10AssessmentAttempt`、`getB10AssessmentReport`；`assessment-service`／attempt、判分、错因、报告快照；`assessment.attempt.submitted.v1` → `assessment.attempt.assessed.v1` 仅为历史 payload 候选；本轮不声明 Kafka 发布/消费；规则化分数、错因、参考答案/建议、attempt 版本；SRS、错题修复、报告或继续学习（待 M1-013 接通）；422 保留输入；超时查同一 attempt；重复提交不得重算分数、掌握度或奖励；原始作答/答案规则不进事件；AC-B.2–AC-B.5、AC-F.2、AC-I.3–AC-I.5；normalizedCells: J06.3 提交并取得规则反馈；`PracticeShell`；成人学习者；`expectedStateVersion`、`submissionId/submissionDigest`、封闭作答分支、`clientEventId`、幂等键；attemptId 由服务端生成；`submitB10AssessmentAttempt`、`getB10AssessmentReport`；`assessment-service`／attempt、判分、错因、报告快照；`assessment.attempt.submitted.v1` → `assessment.attempt.assessed.v1` 仅为历史 payload 候选；本轮不声明 Kafka 发布/消费；规则化分数、错因、参考答案/建议、attempt 版本；SRS、错题修复、报告或继续学习（待 M1-013 接通）；422 保留输入；超时查同一 attempt；重复提交不得重算分数、掌握度或奖励；原始作答/答案规则不进事件；AC-B.2–AC-B.5、AC-F.2、AC-I.3–AC-I.5；columns: 步骤: J06.3 提交并取得规则反馈；页面／角色: `PracticeShell`；成人学习者；输入与前置: `expectedStateVersion`、`submissionId/submissionDigest`、封闭作答分支、`clientEventId`、幂等键；attemptId 由服务端生成；API（operationId 或 GAP）: `submitB10AssessmentAttempt`、`getB10AssessmentReport`；服务／事实 owner: `assessment-service`／attempt、判分、错因、报告快照；状态／目标事件: `assessment.attempt.submitted.v1` → `assessment.attempt.assessed.v1` 仅为历史 payload 候选；本轮不声明 Kafka 发布/消费；输出: 规则化分数、错因、参考答案/建议、attempt 版本；下一步: SRS、错题修复、报告或继续学习（待 M1-013 接通）；失败／补偿: 422 保留输入；超时查同一 attempt；重复提交不得重算分数、掌握度或奖励；原始作答/答案规则不进事件；验收: AC-B.2–AC-B.5、AC-F.2、AC-I.3–AC-I.5；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J06.4 媒体/跟读分支；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 91；text: | J06.4 媒体/跟读分支 | `ReaderShell`、`courses/listening`、`courses/speaking`；成人学习者 | 已发布 contentVersion；源媒体 `READY/CLEAN`、rights 有效、官方字幕或文本替代、设备权限；音频支持 `0.5x–2.0x` 连续变速和 0.5/0.75/1/1.25/1.5/2 快捷档并保持音高；录音只在主动点击、录音专用 consent purpose/version 有效后申请 | M1-009 canonical 媒体读取/短时 grant、录音 asset intent/complete 与 shadowing attempt；B1/B3/B11 名称仅历史兼容，`CONTRACT-GAP-MEDIA-PROCESSING` 与 `CONTRACT-GAP-SPK-001` 待关闭 | content 归媒体语义关联、官方字幕文本、版权与发布资格；media 归 asset/object/integrity/task/rendition/subtitle artifact/recording/grant/delete receipt；assessment 归 shadowing session/attempt/self-rating；learning 只消费可信 assessment 结果 | 旧 `media.*`、`recording.*`、`shadowing.*` 名称不自动晋升 canonical Kafka；只有 assessment 可信结果可接入 INT-P1-006 | 播放进度、文本替代、规则化练习入口 | 同一 contentVersion 的练习或今日任务 | 拒绝麦克风仍可静音练习；本地加密草稿与远端录音资产分态；上传失败保留本地安全副本并可查询/重试；源 rights 撤销立即拒绝源音频/官方字幕；Phase 1 不出现 ASR、AI 分数、生成式 AI、数字人或 RTC，录音不得直接写 SRS/mastery | AC-B.1–AC-B.3、AC-F.3、AC-K.4 |；cells: J06.4 媒体/跟读分支；`ReaderShell`、`courses/listening`、`courses/speaking`；成人学习者；已发布 contentVersion；源媒体 `READY/CLEAN`、rights 有效、官方字幕或文本替代、设备权限；音频支持 `0.5x–2.0x` 连续变速和 0.5/0.75/1/1.25/1.5/2 快捷档并保持音高；录音只在主动点击、录音专用 consent purpose/version 有效后申请；M1-009 canonical 媒体读取/短时 grant、录音 asset intent/complete 与 shadowing attempt；B1/B3/B11 名称仅历史兼容，`CONTRACT-GAP-MEDIA-PROCESSING` 与 `CONTRACT-GAP-SPK-001` 待关闭；content 归媒体语义关联、官方字幕文本、版权与发布资格；media 归 asset/object/integrity/task/rendition/subtitle artifact/recording/grant/delete receipt；assessment 归 shadowing session/attempt/self-rating；learning 只消费可信 assessment 结果；旧 `media.*`、`recording.*`、`shadowing.*` 名称不自动晋升 canonical Kafka；只有 assessment 可信结果可接入 INT-P1-006；播放进度、文本替代、规则化练习入口；同一 contentVersion 的练习或今日任务；拒绝麦克风仍可静音练习；本地加密草稿与远端录音资产分态；上传失败保留本地安全副本并可查询/重试；源 rights 撤销立即拒绝源音频/官方字幕；Phase 1 不出现 ASR、AI 分数、生成式 AI、数字人或 RTC，录音不得直接写 SRS/mastery；AC-B.1–AC-B.3、AC-F.3、AC-K.4；normalizedCells: J06.4 媒体/跟读分支；`ReaderShell`、`courses/listening`、`courses/speaking`；成人学习者；已发布 contentVersion；源媒体 `READY/CLEAN`、rights 有效、官方字幕或文本替代、设备权限；音频支持 `0.5x–2.0x` 连续变速和 0.5/0.75/1/1.25/1.5/2 快捷档并保持音高；录音只在主动点击、录音专用 consent purpose/version 有效后申请；M1-009 canonical 媒体读取/短时 grant、录音 asset intent/complete 与 shadowing attempt；B1/B3/B11 名称仅历史兼容，`CONTRACT-GAP-MEDIA-PROCESSING` 与 `CONTRACT-GAP-SPK-001` 待关闭；content 归媒体语义关联、官方字幕文本、版权与发布资格；media 归 asset/object/integrity/task/rendition/subtitle artifact/recording/grant/delete receipt；assessment 归 shadowing session/attempt/self-rating；learning 只消费可信 assessment 结果；旧 `media.*`、`recording.*`、`shadowing.*` 名称不自动晋升 canonical Kafka；只有 assessment 可信结果可接入 INT-P1-006；播放进度、文本替代、规则化练习入口；同一 contentVersion 的练习或今日任务；拒绝麦克风仍可静音练习；本地加密草稿与远端录音资产分态；上传失败保留本地安全副本并可查询/重试；源 rights 撤销立即拒绝源音频/官方字幕；Phase 1 不出现 ASR、AI 分数、生成式 AI、数字人或 RTC，录音不得直接写 SRS/mastery；AC-B.1–AC-B.3、AC-F.3、AC-K.4；columns: 步骤: J06.4 媒体/跟读分支；页面／角色: `ReaderShell`、`courses/listening`、`courses/speaking`；成人学习者；输入与前置: 已发布 contentVersion；源媒体 `READY/CLEAN`、rights 有效、官方字幕或文本替代、设备权限；音频支持 `0.5x–2.0x` 连续变速和 0.5/0.75/1/1.25/1.5/2 快捷档并保持音高；录音只在主动点击、录音专用 consent purpose/version 有效后申请；API（operationId 或 GAP）: M1-009 canonical 媒体读取/短时 grant、录音 asset intent/complete 与 shadowing attempt；B1/B3/B11 名称仅历史兼容，`CONTRACT-GAP-MEDIA-PROCESSING` 与 `CONTRACT-GAP-SPK-001` 待关闭；服务／事实 owner: content 归媒体语义关联、官方字幕文本、版权与发布资格；media 归 asset/object/integrity/task/rendition/subtitle artifact/recording/grant/delete receipt；assessment 归 shadowing session/attempt/self-rating；learning 只消费可信 assessment 结果；状态／目标事件: 旧 `media.*`、`recording.*`、`shadowing.*` 名称不自动晋升 canonical Kafka；只有 assessment 可信结果可接入 INT-P1-006；输出: 播放进度、文本替代、规则化练习入口；下一步: 同一 contentVersion 的练习或今日任务；失败／补偿: 拒绝麦克风仍可静音练习；本地加密草稿与远端录音资产分态；上传失败保留本地安全副本并可查询/重试；源 rights 撤销立即拒绝源音频/官方字幕；Phase 1 不出现 ASR、AI 分数、生成式 AI、数字人或 RTC，录音不得直接写 SRS/mastery；验收: AC-B.1–AC-B.3、AC-F.3、AC-K.4；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-07 · 掌握度、SRS 与到期复习

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J07.1 从可信判分生成掌握与队列；J07.2 完成到期复习；J07.3 处理双写入口遗留。
- 状态：consumer 按来源 assessment event、item、projection version 去重；失败走 Saga 补偿/DLQ，assessment 不直接写 SRS；迟到/重复/乱序不能覆盖较新状态；dueAt 由服务端时区与算法版本计算；客户端不能直接改 SRS；在迁移决议前禁止两个入口对同一 item 独立计算/写入；回放按 `clientEventId`、item、版本去重。
- 交互：step: J07.1 从可信判分生成掌握与队列；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 97；text: | J07.1 从可信判分生成掌握与队列 | 系统衔接；无客户端直写 | `assessment.attempt.assessed` 的脱敏结果摘要、`contentVersionId`、规则/算法版本 | 无公共写 API；由 `workflow-service` 协调的异步事实链，见 `INT-P1-006` | `learning-service`／`mastery_projection`、`lrn_srs_state`、review queue；workflow 只协调 | `workflow.assessment_learning.saga_started.v1` → `learning.mastery.projected.v1` → `learning.review.scheduled.v1` | 掌握度投影与服务端计算的 dueAt | 复习队列/今日任务 | consumer 按来源 assessment event、item、projection version 去重；失败走 Saga 补偿/DLQ，assessment 不直接写 SRS | AC-A.5、AC-B.4、AC-I.2–AC-I.5 |；cells: J07.1 从可信判分生成掌握与队列；系统衔接；无客户端直写；`assessment.attempt.assessed` 的脱敏结果摘要、`contentVersionId`、规则/算法版本；无公共写 API；由 `workflow-service` 协调的异步事实链，见 `INT-P1-006`；`learning-service`／`mastery_projection`、`lrn_srs_state`、review queue；workflow 只协调；`workflow.assessment_learning.saga_started.v1` → `learning.mastery.projected.v1` → `learning.review.scheduled.v1`；掌握度投影与服务端计算的 dueAt；复习队列/今日任务；consumer 按来源 assessment event、item、projection version 去重；失败走 Saga 补偿/DLQ，assessment 不直接写 SRS；AC-A.5、AC-B.4、AC-I.2–AC-I.5；normalizedCells: J07.1 从可信判分生成掌握与队列；系统衔接；无客户端直写；`assessment.attempt.assessed` 的脱敏结果摘要、`contentVersionId`、规则/算法版本；无公共写 API；由 `workflow-service` 协调的异步事实链，见 `INT-P1-006`；`learning-service`／`mastery_projection`、`lrn_srs_state`、review queue；workflow 只协调；`workflow.assessment_learning.saga_started.v1` → `learning.mastery.projected.v1` → `learning.review.scheduled.v1`；掌握度投影与服务端计算的 dueAt；复习队列/今日任务；consumer 按来源 assessment event、item、projection version 去重；失败走 Saga 补偿/DLQ，assessment 不直接写 SRS；AC-A.5、AC-B.4、AC-I.2–AC-I.5；columns: 步骤: J07.1 从可信判分生成掌握与队列；页面／角色: 系统衔接；无客户端直写；输入与前置: `assessment.attempt.assessed` 的脱敏结果摘要、`contentVersionId`、规则/算法版本；API（operationId 或 GAP）: 无公共写 API；由 `workflow-service` 协调的异步事实链，见 `INT-P1-006`；服务／事实 owner: `learning-service`／`mastery_projection`、`lrn_srs_state`、review queue；workflow 只协调；状态／目标事件: `workflow.assessment_learning.saga_started.v1` → `learning.mastery.projected.v1` → `learning.review.scheduled.v1`；输出: 掌握度投影与服务端计算的 dueAt；下一步: 复习队列/今日任务；失败／补偿: consumer 按来源 assessment event、item、projection version 去重；失败走 Saga 补偿/DLQ，assessment 不直接写 SRS；验收: AC-A.5、AC-B.4、AC-I.2–AC-I.5；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J07.2 完成到期复习；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 98；text: | J07.2 完成到期复习 | `practice/srs`、`practice/quick`；成人学习者 | queue item、作答/信心度、`baseStateVersion`、`clientEventId`、幂等键 | `listB10LearningReviewQueue`、`completeB10LearningReview` | `learning-service`／唯一 `lrn_srs_state`、复习事件、排程 | `learning.review.scheduled.v1`；必要时 `mastery.verification_state_changed.v1` | 下次复习时间、更新的掌握状态 | 今日任务、D+1/D+7 或报告 | 迟到/重复/乱序不能覆盖较新状态；dueAt 由服务端时区与算法版本计算；客户端不能直接改 SRS | AC-A.5、AC-B.3、AC-B.4、AC-I.3–AC-I.5 |；cells: J07.2 完成到期复习；`practice/srs`、`practice/quick`；成人学习者；queue item、作答/信心度、`baseStateVersion`、`clientEventId`、幂等键；`listB10LearningReviewQueue`、`completeB10LearningReview`；`learning-service`／唯一 `lrn_srs_state`、复习事件、排程；`learning.review.scheduled.v1`；必要时 `mastery.verification_state_changed.v1`；下次复习时间、更新的掌握状态；今日任务、D+1/D+7 或报告；迟到/重复/乱序不能覆盖较新状态；dueAt 由服务端时区与算法版本计算；客户端不能直接改 SRS；AC-A.5、AC-B.3、AC-B.4、AC-I.3–AC-I.5；normalizedCells: J07.2 完成到期复习；`practice/srs`、`practice/quick`；成人学习者；queue item、作答/信心度、`baseStateVersion`、`clientEventId`、幂等键；`listB10LearningReviewQueue`、`completeB10LearningReview`；`learning-service`／唯一 `lrn_srs_state`、复习事件、排程；`learning.review.scheduled.v1`；必要时 `mastery.verification_state_changed.v1`；下次复习时间、更新的掌握状态；今日任务、D+1/D+7 或报告；迟到/重复/乱序不能覆盖较新状态；dueAt 由服务端时区与算法版本计算；客户端不能直接改 SRS；AC-A.5、AC-B.3、AC-B.4、AC-I.3–AC-I.5；columns: 步骤: J07.2 完成到期复习；页面／角色: `practice/srs`、`practice/quick`；成人学习者；输入与前置: queue item、作答/信心度、`baseStateVersion`、`clientEventId`、幂等键；API（operationId 或 GAP）: `listB10LearningReviewQueue`、`completeB10LearningReview`；服务／事实 owner: `learning-service`／唯一 `lrn_srs_state`、复习事件、排程；状态／目标事件: `learning.review.scheduled.v1`；必要时 `mastery.verification_state_changed.v1`；输出: 下次复习时间、更新的掌握状态；下一步: 今日任务、D+1/D+7 或报告；失败／补偿: 迟到/重复/乱序不能覆盖较新状态；dueAt 由服务端时区与算法版本计算；客户端不能直接改 SRS；验收: AC-A.5、AC-B.3、AC-B.4、AC-I.3–AC-I.5；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J07.3 处理双写入口遗留；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 99；text: | J07.3 处理双写入口遗留 | `practice/srs`；成人学习者 | 现有 SRS review 请求 | `submitReviewEvent`、`syncReviewEvents` 与 `completeB10LearningReview` 并存：`CONTRACT-GAP-LRN-001` 需指定唯一公开写入口和兼容迁移 | 最终仍只能由 `learning-service` 写 `lrn_srs_state` | 目录存在 `vocabulary.review.accepted.v1`、`vocabulary.srs.state_changed.v1` 等历史名称，不能与 B10 事件并行记账 | 单一、可回放的 review 事实 | 队列或同步恢复 | 在迁移决议前禁止两个入口对同一 item 独立计算/写入；回放按 `clientEventId`、item、版本去重 | AC-B.3、AC-I.3–AC-I.5、AC-J.1 |；cells: J07.3 处理双写入口遗留；`practice/srs`；成人学习者；现有 SRS review 请求；`submitReviewEvent`、`syncReviewEvents` 与 `completeB10LearningReview` 并存：`CONTRACT-GAP-LRN-001` 需指定唯一公开写入口和兼容迁移；最终仍只能由 `learning-service` 写 `lrn_srs_state`；目录存在 `vocabulary.review.accepted.v1`、`vocabulary.srs.state_changed.v1` 等历史名称，不能与 B10 事件并行记账；单一、可回放的 review 事实；队列或同步恢复；在迁移决议前禁止两个入口对同一 item 独立计算/写入；回放按 `clientEventId`、item、版本去重；AC-B.3、AC-I.3–AC-I.5、AC-J.1；normalizedCells: J07.3 处理双写入口遗留；`practice/srs`；成人学习者；现有 SRS review 请求；`submitReviewEvent`、`syncReviewEvents` 与 `completeB10LearningReview` 并存：`CONTRACT-GAP-LRN-001` 需指定唯一公开写入口和兼容迁移；最终仍只能由 `learning-service` 写 `lrn_srs_state`；目录存在 `vocabulary.review.accepted.v1`、`vocabulary.srs.state_changed.v1` 等历史名称，不能与 B10 事件并行记账；单一、可回放的 review 事实；队列或同步恢复；在迁移决议前禁止两个入口对同一 item 独立计算/写入；回放按 `clientEventId`、item、版本去重；AC-B.3、AC-I.3–AC-I.5、AC-J.1；columns: 步骤: J07.3 处理双写入口遗留；页面／角色: `practice/srs`；成人学习者；输入与前置: 现有 SRS review 请求；API（operationId 或 GAP）: `submitReviewEvent`、`syncReviewEvents` 与 `completeB10LearningReview` 并存：`CONTRACT-GAP-LRN-001` 需指定唯一公开写入口和兼容迁移；服务／事实 owner: 最终仍只能由 `learning-service` 写 `lrn_srs_state`；状态／目标事件: 目录存在 `vocabulary.review.accepted.v1`、`vocabulary.srs.state_changed.v1` 等历史名称，不能与 B10 事件并行记账；输出: 单一、可回放的 review 事实；下一步: 队列或同步恢复；失败／补偿: 在迁移决议前禁止两个入口对同一 item 独立计算/写入；回放按 `clientEventId`、item、版本去重；验收: AC-B.3、AC-I.3–AC-I.5、AC-J.1；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-08 · 错题修复与 D+1/D+7 验证

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J08.1 查看错题与进入修复；J08.2 验证 D+1/D+7 与最终掌握。
- 状态：题目下线/权限失效显示原因和等价任务；不得将别人的错题或答案规则暴露给当前用户；未到期不可被客户端伪造为完成；重复验证不重复升级；失败保留上一次可信状态并排入恢复。
- 交互：step: J08.1 查看错题与进入修复；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 105；text: | J08.1 查看错题与进入修复 | `practice/mistakes`、报告深链；成人学习者 | 本人 attempt 来源、题目版本、队列优先级 | `getLearningMistakeQueue` | `learning-service`／错题修复队列、掌握投影；原始错因仍归 `assessment-service` | 无（读取投影） | 带来源、优先级和版本的修复任务 | 规则练习或延迟验证 | 题目下线/权限失效显示原因和等价任务；不得将别人的错题或答案规则暴露给当前用户 | AC-B.4、AC-B.5、AC-H.9 |；cells: J08.1 查看错题与进入修复；`practice/mistakes`、报告深链；成人学习者；本人 attempt 来源、题目版本、队列优先级；`getLearningMistakeQueue`；`learning-service`／错题修复队列、掌握投影；原始错因仍归 `assessment-service`；无（读取投影）；带来源、优先级和版本的修复任务；规则练习或延迟验证；题目下线/权限失效显示原因和等价任务；不得将别人的错题或答案规则暴露给当前用户；AC-B.4、AC-B.5、AC-H.9；normalizedCells: J08.1 查看错题与进入修复；`practice/mistakes`、报告深链；成人学习者；本人 attempt 来源、题目版本、队列优先级；`getLearningMistakeQueue`；`learning-service`／错题修复队列、掌握投影；原始错因仍归 `assessment-service`；无（读取投影）；带来源、优先级和版本的修复任务；规则练习或延迟验证；题目下线/权限失效显示原因和等价任务；不得将别人的错题或答案规则暴露给当前用户；AC-B.4、AC-B.5、AC-H.9；columns: 步骤: J08.1 查看错题与进入修复；页面／角色: `practice/mistakes`、报告深链；成人学习者；输入与前置: 本人 attempt 来源、题目版本、队列优先级；API（operationId 或 GAP）: `getLearningMistakeQueue`；服务／事实 owner: `learning-service`／错题修复队列、掌握投影；原始错因仍归 `assessment-service`；状态／目标事件: 无（读取投影）；输出: 带来源、优先级和版本的修复任务；下一步: 规则练习或延迟验证；失败／补偿: 题目下线/权限失效显示原因和等价任务；不得将别人的错题或答案规则暴露给当前用户；验收: AC-B.4、AC-B.5、AC-H.9；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J08.2 验证 D+1/D+7 与最终掌握；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 106；text: | J08.2 验证 D+1/D+7 与最终掌握 | `practice/mastery`、今日任务；成人学习者 | `mistakeId`/queue item、修复结果、版本/幂等键；D+1=`DELAY_VERIFY_D1`、D+7=`DELAY_VERIFY_D7` | `verifyLearningMistake` | `learning-service`／验证状态、`lrn_srs_state`、掌握投影 | `mastery.verification_state_changed.v1`；后续 `learning.review.scheduled.v1` | 可解释的延迟验证结果；最终 `MASTERED` 仅由服务端给出 | 报告或下一复习 | 未到期不可被客户端伪造为完成；重复验证不重复升级；失败保留上一次可信状态并排入恢复 | AC-A.5、AC-B.4、AC-I.3–AC-I.5 |；cells: J08.2 验证 D+1/D+7 与最终掌握；`practice/mastery`、今日任务；成人学习者；`mistakeId`/queue item、修复结果、版本/幂等键；D+1=`DELAY_VERIFY_D1`、D+7=`DELAY_VERIFY_D7`；`verifyLearningMistake`；`learning-service`／验证状态、`lrn_srs_state`、掌握投影；`mastery.verification_state_changed.v1`；后续 `learning.review.scheduled.v1`；可解释的延迟验证结果；最终 `MASTERED` 仅由服务端给出；报告或下一复习；未到期不可被客户端伪造为完成；重复验证不重复升级；失败保留上一次可信状态并排入恢复；AC-A.5、AC-B.4、AC-I.3–AC-I.5；normalizedCells: J08.2 验证 D+1/D+7 与最终掌握；`practice/mastery`、今日任务；成人学习者；`mistakeId`/queue item、修复结果、版本/幂等键；D+1=`DELAY_VERIFY_D1`、D+7=`DELAY_VERIFY_D7`；`verifyLearningMistake`；`learning-service`／验证状态、`lrn_srs_state`、掌握投影；`mastery.verification_state_changed.v1`；后续 `learning.review.scheduled.v1`；可解释的延迟验证结果；最终 `MASTERED` 仅由服务端给出；报告或下一复习；未到期不可被客户端伪造为完成；重复验证不重复升级；失败保留上一次可信状态并排入恢复；AC-A.5、AC-B.4、AC-I.3–AC-I.5；columns: 步骤: J08.2 验证 D+1/D+7 与最终掌握；页面／角色: `practice/mastery`、今日任务；成人学习者；输入与前置: `mistakeId`/queue item、修复结果、版本/幂等键；D+1=`DELAY_VERIFY_D1`、D+7=`DELAY_VERIFY_D7`；API（operationId 或 GAP）: `verifyLearningMistake`；服务／事实 owner: `learning-service`／验证状态、`lrn_srs_state`、掌握投影；状态／目标事件: `mastery.verification_state_changed.v1`；后续 `learning.review.scheduled.v1`；输出: 可解释的延迟验证结果；最终 `MASTERED` 仅由服务端给出；下一步: 报告或下一复习；失败／补偿: 未到期不可被客户端伪造为完成；重复验证不重复升级；失败保留上一次可信状态并排入恢复；验收: AC-A.5、AC-B.4、AC-I.3–AC-I.5；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-09 · 日报、周报与练习报告复盘

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J09.1 读取练习报告；J09.2 读取学习日/周复盘。
- 状态：403 与报告不存在/过期分开；报告生成失败可查询/重试，不得显示伪完成结果；当前 report operationId 仍有 B2 历史命名：`CONTRACT-GAP-REP-001` 需给出统一报告读模型/兼容窗口；统计延迟必须显示数据时间。
- 交互：step: J09.1 读取练习报告；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 112；text: | J09.1 读取练习报告 | `reports/*`、练习结果页；成人学习者 | 本人 `reportId`/session、内容版本、权益（如受限） | `getB10AssessmentReport`、`getB1PlacementReport`（当前 operationId 历史命名） | `assessment-service`／报告快照、判分依据、错因 | `report.generated.v1`（若报告生成是异步事实）；读取不另发事件 | 可回到题目、错因和规则依据的报告 | 修复、SRS 或今日任务 | 403 与报告不存在/过期分开；报告生成失败可查询/重试，不得显示伪完成结果 | AC-A.3、AC-B.5、AC-F.2、AC-H.9 |；cells: J09.1 读取练习报告；`reports/*`、练习结果页；成人学习者；本人 `reportId`/session、内容版本、权益（如受限）；`getB10AssessmentReport`、`getB1PlacementReport`（当前 operationId 历史命名）；`assessment-service`／报告快照、判分依据、错因；`report.generated.v1`（若报告生成是异步事实）；读取不另发事件；可回到题目、错因和规则依据的报告；修复、SRS 或今日任务；403 与报告不存在/过期分开；报告生成失败可查询/重试，不得显示伪完成结果；AC-A.3、AC-B.5、AC-F.2、AC-H.9；normalizedCells: J09.1 读取练习报告；`reports/*`、练习结果页；成人学习者；本人 `reportId`/session、内容版本、权益（如受限）；`getB10AssessmentReport`、`getB1PlacementReport`（当前 operationId 历史命名）；`assessment-service`／报告快照、判分依据、错因；`report.generated.v1`（若报告生成是异步事实）；读取不另发事件；可回到题目、错因和规则依据的报告；修复、SRS 或今日任务；403 与报告不存在/过期分开；报告生成失败可查询/重试，不得显示伪完成结果；AC-A.3、AC-B.5、AC-F.2、AC-H.9；columns: 步骤: J09.1 读取练习报告；页面／角色: `reports/*`、练习结果页；成人学习者；输入与前置: 本人 `reportId`/session、内容版本、权益（如受限）；API（operationId 或 GAP）: `getB10AssessmentReport`、`getB1PlacementReport`（当前 operationId 历史命名）；服务／事实 owner: `assessment-service`／报告快照、判分依据、错因；状态／目标事件: `report.generated.v1`（若报告生成是异步事实）；读取不另发事件；输出: 可回到题目、错因和规则依据的报告；下一步: 修复、SRS 或今日任务；失败／补偿: 403 与报告不存在/过期分开；报告生成失败可查询/重试，不得显示伪完成结果；验收: AC-A.3、AC-B.5、AC-F.2、AC-H.9；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J09.2 读取学习日/周复盘；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 113；text: | J09.2 读取学习日/周复盘 | `learn` 摘要、`reports/*`；成人学习者 | 仅本人、指定统计窗口/时区 | `getB2DailyReport`、`getB2WeeklyReport`、`getDailyLearningSummary` | `learning-service` 应拥有学习汇总；`assessment-service` 不覆盖学习掌握事实 | 读取投影；`analytics.metric.projected.v1` 不能替代领域事实 | 完成、复习、薄弱项与下一步建议 | 今日任务/错题/SRS | 当前 report operationId 仍有 B2 历史命名：`CONTRACT-GAP-REP-001` 需给出统一报告读模型/兼容窗口；统计延迟必须显示数据时间 | AC-A.5、AC-B.4、AC-F.2、AC-I.2 |；cells: J09.2 读取学习日/周复盘；`learn` 摘要、`reports/*`；成人学习者；仅本人、指定统计窗口/时区；`getB2DailyReport`、`getB2WeeklyReport`、`getDailyLearningSummary`；`learning-service` 应拥有学习汇总；`assessment-service` 不覆盖学习掌握事实；读取投影；`analytics.metric.projected.v1` 不能替代领域事实；完成、复习、薄弱项与下一步建议；今日任务/错题/SRS；当前 report operationId 仍有 B2 历史命名：`CONTRACT-GAP-REP-001` 需给出统一报告读模型/兼容窗口；统计延迟必须显示数据时间；AC-A.5、AC-B.4、AC-F.2、AC-I.2；normalizedCells: J09.2 读取学习日/周复盘；`learn` 摘要、`reports/*`；成人学习者；仅本人、指定统计窗口/时区；`getB2DailyReport`、`getB2WeeklyReport`、`getDailyLearningSummary`；`learning-service` 应拥有学习汇总；`assessment-service` 不覆盖学习掌握事实；读取投影；`analytics.metric.projected.v1` 不能替代领域事实；完成、复习、薄弱项与下一步建议；今日任务/错题/SRS；当前 report operationId 仍有 B2 历史命名：`CONTRACT-GAP-REP-001` 需给出统一报告读模型/兼容窗口；统计延迟必须显示数据时间；AC-A.5、AC-B.4、AC-F.2、AC-I.2；columns: 步骤: J09.2 读取学习日/周复盘；页面／角色: `learn` 摘要、`reports/*`；成人学习者；输入与前置: 仅本人、指定统计窗口/时区；API（operationId 或 GAP）: `getB2DailyReport`、`getB2WeeklyReport`、`getDailyLearningSummary`；服务／事实 owner: `learning-service` 应拥有学习汇总；`assessment-service` 不覆盖学习掌握事实；状态／目标事件: 读取投影；`analytics.metric.projected.v1` 不能替代领域事实；输出: 完成、复习、薄弱项与下一步建议；下一步: 今日任务/错题/SRS；失败／补偿: 当前 report operationId 仍有 B2 历史命名：`CONTRACT-GAP-REP-001` 需给出统一报告读模型/兼容窗口；统计延迟必须显示数据时间；验收: AC-A.5、AC-B.4、AC-F.2、AC-I.2；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-10 · 游戏化：可信完成 → 账本/奖励 → 学习出口

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J10.1 进入可发布的学习游戏；J10.2 消费可信学习完成。
- 状态：P0/P1 Gate 不通过须解释；离线不发伪奖励；重复完成按 session/ledger dedupe，不能由客户端提交积分；消费者按 root eventId、aggregateId、dedupeKey 去重；失败重放不重入账；无现金随机抽奖和学习无关变现。
- 交互：step: J10.1 进入可发布的学习游戏；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 121；text: | J10.1 进入可发布的学习游戏 | `world`、`games/*`；成人学习者 | 已通过 Gate；game catalog 的 `releasePhase`/`enabled`；P0 仅 Sentence Train | `listB4Games`、`createB4GameSession`、`finishB4GameSession`（当前 operationId 历史命名） | `gamification-service`／game session、XP/星币账本、奖励、连续学习 | `gamification.session_started.v1`、`gamification.xp.ledger_posted.v1`、`gamification.reward.granted.v1` | 已结算或待确认的服务端账本结果 | 返回今日任务、复习或下一课程 | P0/P1 Gate 不通过须解释；离线不发伪奖励；重复完成按 session/ledger dedupe，不能由客户端提交积分 | AC-F.3、AC-I.4、AC-K.3 |；cells: J10.1 进入可发布的学习游戏；`world`、`games/*`；成人学习者；已通过 Gate；game catalog 的 `releasePhase`/`enabled`；P0 仅 Sentence Train；`listB4Games`、`createB4GameSession`、`finishB4GameSession`（当前 operationId 历史命名）；`gamification-service`／game session、XP/星币账本、奖励、连续学习；`gamification.session_started.v1`、`gamification.xp.ledger_posted.v1`、`gamification.reward.granted.v1`；已结算或待确认的服务端账本结果；返回今日任务、复习或下一课程；P0/P1 Gate 不通过须解释；离线不发伪奖励；重复完成按 session/ledger dedupe，不能由客户端提交积分；AC-F.3、AC-I.4、AC-K.3；normalizedCells: J10.1 进入可发布的学习游戏；`world`、`games/*`；成人学习者；已通过 Gate；game catalog 的 `releasePhase`/`enabled`；P0 仅 Sentence Train；`listB4Games`、`createB4GameSession`、`finishB4GameSession`（当前 operationId 历史命名）；`gamification-service`／game session、XP/星币账本、奖励、连续学习；`gamification.session_started.v1`、`gamification.xp.ledger_posted.v1`、`gamification.reward.granted.v1`；已结算或待确认的服务端账本结果；返回今日任务、复习或下一课程；P0/P1 Gate 不通过须解释；离线不发伪奖励；重复完成按 session/ledger dedupe，不能由客户端提交积分；AC-F.3、AC-I.4、AC-K.3；columns: 步骤: J10.1 进入可发布的学习游戏；页面／角色: `world`、`games/*`；成人学习者；输入与前置: 已通过 Gate；game catalog 的 `releasePhase`/`enabled`；P0 仅 Sentence Train；API（operationId 或 GAP）: `listB4Games`、`createB4GameSession`、`finishB4GameSession`（当前 operationId 历史命名）；服务／事实 owner: `gamification-service`／game session、XP/星币账本、奖励、连续学习；状态／目标事件: `gamification.session_started.v1`、`gamification.xp.ledger_posted.v1`、`gamification.reward.granted.v1`；输出: 已结算或待确认的服务端账本结果；下一步: 返回今日任务、复习或下一课程；失败／补偿: P0/P1 Gate 不通过须解释；离线不发伪奖励；重复完成按 session/ledger dedupe，不能由客户端提交积分；验收: AC-F.3、AC-I.4、AC-K.3；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J10.2 消费可信学习完成；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 122；text: | J10.2 消费可信学习完成 | 系统衔接；客户端不可直连记账 | 已确认的学习/assessment 完成摘要、来源 eventId、主体和规则版本 | `consumeB12TrustedCompletion` 是内部消费口；正式 Kafka 订阅绑定见 `CONTRACT-GAP-GAM-001` | `gamification-service`／唯一账本/奖励事实 | `learning.task.completed.v1` 或可信 assessment/learning 事实 → `gamification.xp.ledger_posted.v1` | 可审计 XP/奖励，而非前端计算值 | 世界/奖励页或学习闭环 | 消费者按 root eventId、aggregateId、dedupeKey 去重；失败重放不重入账；无现金随机抽奖和学习无关变现 | AC-F.2、AC-I.4、AC-I.5 |；cells: J10.2 消费可信学习完成；系统衔接；客户端不可直连记账；已确认的学习/assessment 完成摘要、来源 eventId、主体和规则版本；`consumeB12TrustedCompletion` 是内部消费口；正式 Kafka 订阅绑定见 `CONTRACT-GAP-GAM-001`；`gamification-service`／唯一账本/奖励事实；`learning.task.completed.v1` 或可信 assessment/learning 事实 → `gamification.xp.ledger_posted.v1`；可审计 XP/奖励，而非前端计算值；世界/奖励页或学习闭环；消费者按 root eventId、aggregateId、dedupeKey 去重；失败重放不重入账；无现金随机抽奖和学习无关变现；AC-F.2、AC-I.4、AC-I.5；normalizedCells: J10.2 消费可信学习完成；系统衔接；客户端不可直连记账；已确认的学习/assessment 完成摘要、来源 eventId、主体和规则版本；`consumeB12TrustedCompletion` 是内部消费口；正式 Kafka 订阅绑定见 `CONTRACT-GAP-GAM-001`；`gamification-service`／唯一账本/奖励事实；`learning.task.completed.v1` 或可信 assessment/learning 事实 → `gamification.xp.ledger_posted.v1`；可审计 XP/奖励，而非前端计算值；世界/奖励页或学习闭环；消费者按 root eventId、aggregateId、dedupeKey 去重；失败重放不重入账；无现金随机抽奖和学习无关变现；AC-F.2、AC-I.4、AC-I.5；columns: 步骤: J10.2 消费可信学习完成；页面／角色: 系统衔接；客户端不可直连记账；输入与前置: 已确认的学习/assessment 完成摘要、来源 eventId、主体和规则版本；API（operationId 或 GAP）: `consumeB12TrustedCompletion` 是内部消费口；正式 Kafka 订阅绑定见 `CONTRACT-GAP-GAM-001`；服务／事实 owner: `gamification-service`／唯一账本/奖励事实；状态／目标事件: `learning.task.completed.v1` 或可信 assessment/learning 事实 → `gamification.xp.ledger_posted.v1`；输出: 可审计 XP/奖励，而非前端计算值；下一步: 世界/奖励页或学习闭环；失败／补偿: 消费者按 root eventId、aggregateId、dedupeKey 去重；失败重放不重入账；无现金随机抽奖和学习无关变现；验收: AC-F.2、AC-I.4、AC-I.5；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-11 · 受控自习室、专注与排行榜

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J11.1 加入、占座并专注；J11.2 退出、受控互动与榜单。
- 状态：座位满、隐私限制、断连各自可解释；租约到期后 recover/rejoin，不能凭客户端补写时长；WS 断连通过服务端租约和恢复口处理；自由文本/私聊不作为 Phase 1 路径或 Kafka payload。
- 交互：step: J11.1 加入、占座并专注；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 128；text: | J11.1 加入、占座并专注 | `world/study-room`；成人学习者 | roomId、隐私设置、可用 seat；不携带伪造时长 | `listB4SocialRooms`、`joinB4SocialRoom`、`startB12RoomFocus`、`renewB12StudyRoomLease` | `social-service`／room、seat lease、focus、presence | `study_room.joined.v1`、`study_room.focus_started.v1` | 带租约的座位和专注状态 | 完成专注或返回学习任务 | 座位满、隐私限制、断连各自可解释；租约到期后 recover/rejoin，不能凭客户端补写时长 | AC-F.3、AC-H.8、AC-I.4 |；cells: J11.1 加入、占座并专注；`world/study-room`；成人学习者；roomId、隐私设置、可用 seat；不携带伪造时长；`listB4SocialRooms`、`joinB4SocialRoom`、`startB12RoomFocus`、`renewB12StudyRoomLease`；`social-service`／room、seat lease、focus、presence；`study_room.joined.v1`、`study_room.focus_started.v1`；带租约的座位和专注状态；完成专注或返回学习任务；座位满、隐私限制、断连各自可解释；租约到期后 recover/rejoin，不能凭客户端补写时长；AC-F.3、AC-H.8、AC-I.4；normalizedCells: J11.1 加入、占座并专注；`world/study-room`；成人学习者；roomId、隐私设置、可用 seat；不携带伪造时长；`listB4SocialRooms`、`joinB4SocialRoom`、`startB12RoomFocus`、`renewB12StudyRoomLease`；`social-service`／room、seat lease、focus、presence；`study_room.joined.v1`、`study_room.focus_started.v1`；带租约的座位和专注状态；完成专注或返回学习任务；座位满、隐私限制、断连各自可解释；租约到期后 recover/rejoin，不能凭客户端补写时长；AC-F.3、AC-H.8、AC-I.4；columns: 步骤: J11.1 加入、占座并专注；页面／角色: `world/study-room`；成人学习者；输入与前置: roomId、隐私设置、可用 seat；不携带伪造时长；API（operationId 或 GAP）: `listB4SocialRooms`、`joinB4SocialRoom`、`startB12RoomFocus`、`renewB12StudyRoomLease`；服务／事实 owner: `social-service`／room、seat lease、focus、presence；状态／目标事件: `study_room.joined.v1`、`study_room.focus_started.v1`；输出: 带租约的座位和专注状态；下一步: 完成专注或返回学习任务；失败／补偿: 座位满、隐私限制、断连各自可解释；租约到期后 recover/rejoin，不能凭客户端补写时长；验收: AC-F.3、AC-H.8、AC-I.4；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J11.2 退出、受控互动与榜单；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 129；text: | J11.2 退出、受控互动与榜单 | `SocialShell`；成人学习者 | 预设互动、举报/屏蔽请求、本人 visibility | `leaveB4SocialRoom`、`recordB12RoomInteraction`、`updateB12SocialVisibility`、`createB12SocialReport`、`getB12Leaderboard` | `social-service`／互动、举报、榜单快照；无陌生人私聊/开放发帖 | `study_room.left.v1`、`leaderboard.refreshed.v1`、`social.report.created.v1` | 脱敏榜单、审计化举报、学习时长结算 | 今日任务/复习 | WS 断连通过服务端租约和恢复口处理；自由文本/私聊不作为 Phase 1 路径或 Kafka payload | AC-F.3、AC-H.8、AC-I.4 |；cells: J11.2 退出、受控互动与榜单；`SocialShell`；成人学习者；预设互动、举报/屏蔽请求、本人 visibility；`leaveB4SocialRoom`、`recordB12RoomInteraction`、`updateB12SocialVisibility`、`createB12SocialReport`、`getB12Leaderboard`；`social-service`／互动、举报、榜单快照；无陌生人私聊/开放发帖；`study_room.left.v1`、`leaderboard.refreshed.v1`、`social.report.created.v1`；脱敏榜单、审计化举报、学习时长结算；今日任务/复习；WS 断连通过服务端租约和恢复口处理；自由文本/私聊不作为 Phase 1 路径或 Kafka payload；AC-F.3、AC-H.8、AC-I.4；normalizedCells: J11.2 退出、受控互动与榜单；`SocialShell`；成人学习者；预设互动、举报/屏蔽请求、本人 visibility；`leaveB4SocialRoom`、`recordB12RoomInteraction`、`updateB12SocialVisibility`、`createB12SocialReport`、`getB12Leaderboard`；`social-service`／互动、举报、榜单快照；无陌生人私聊/开放发帖；`study_room.left.v1`、`leaderboard.refreshed.v1`、`social.report.created.v1`；脱敏榜单、审计化举报、学习时长结算；今日任务/复习；WS 断连通过服务端租约和恢复口处理；自由文本/私聊不作为 Phase 1 路径或 Kafka payload；AC-F.3、AC-H.8、AC-I.4；columns: 步骤: J11.2 退出、受控互动与榜单；页面／角色: `SocialShell`；成人学习者；输入与前置: 预设互动、举报/屏蔽请求、本人 visibility；API（operationId 或 GAP）: `leaveB4SocialRoom`、`recordB12RoomInteraction`、`updateB12SocialVisibility`、`createB12SocialReport`、`getB12Leaderboard`；服务／事实 owner: `social-service`／互动、举报、榜单快照；无陌生人私聊/开放发帖；状态／目标事件: `study_room.left.v1`、`leaderboard.refreshed.v1`、`social.report.created.v1`；输出: 脱敏榜单、审计化举报、学习时长结算；下一步: 今日任务/复习；失败／补偿: WS 断连通过服务端租约和恢复口处理；自由文本/私聊不作为 Phase 1 路径或 Kafka payload；验收: AC-F.3、AC-H.8、AC-I.4；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-12 · 商业浏览、订单、支付确认与权益

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J12.1 浏览商品和创建订单；J12.2 发起 sandbox 支付、验签回调与权益激活；J12.3 兑换激活码和读取权益；J12.4 将权益用于内容/学习准入。
- 状态：客户端只可提出 SKU、price snapshot precondition 与 source platform；真正 price snapshot、金额、币种和 order state 均服务端派生。订单幂等；不以客户端成功页激活权益；当前只允许 `SANDBOX_HMAC`，真实渠道/生产支付/自动续费均关闭；仅 `SANDBOX_HMAC`；回调按服务端去重、绑定并 fail closed，不能记录原文、签名、真实凭据或 raw transaction id 到事件。验签、退款、对账、回滚、资质 Gate 未通过时生产支付持续关闭；只持久化 SHA-256 digest 和 opaque redemption reference；raw code/hash/hash-prefix 不得进入事件或审计。到期/退款只降级访问、不删除学习数据；展示权益前必须回读服务端确认；短 TTL、单调 entitlement/source/policy/invalidation 版本与 tombstone；cache miss/expired/unknown/version mismatch/撤销不确定一律拒绝。GRACE=0，退款/撤销/到期/安全/unknown 永不 grace；Gateway 或客户端缓存不是事实。真实 PEP、cache、event invalidation 和恢复仍由 M2/M7/M8 验证。
- 交互：step: J12.1 浏览商品和创建订单；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 135；text: | J12.1 浏览商品和创建订单 | `Official` `/pricing`、`commerce/*`、`me/membership`；成人学习者 | 公开 SKU 或已认证主体、`expectedPriceSnapshotId` precondition、`sourcePlatform` | `getB13PublicCommerceCatalog`、`getB13CommerceReadiness`、`listB13CommerceSkus`、`listB13CommerceOrders`、`createB13CommerceOrder` | `commerce-service`／SKU、订单、价格快照、审计 | `commerce.order.created.v2` | 待支付订单 | 准备仅 sandbox payment intent 或激活码兑换 | 客户端只可提出 SKU、price snapshot precondition 与 source platform；真正 price snapshot、金额、币种和 order state 均服务端派生。订单幂等；不以客户端成功页激活权益；当前只允许 `SANDBOX_HMAC`，真实渠道/生产支付/自动续费均关闭 | AC-D.2、AC-D.4、AC-D.5、AC-I.4 |；cells: J12.1 浏览商品和创建订单；`Official` `/pricing`、`commerce/*`、`me/membership`；成人学习者；公开 SKU 或已认证主体、`expectedPriceSnapshotId` precondition、`sourcePlatform`；`getB13PublicCommerceCatalog`、`getB13CommerceReadiness`、`listB13CommerceSkus`、`listB13CommerceOrders`、`createB13CommerceOrder`；`commerce-service`／SKU、订单、价格快照、审计；`commerce.order.created.v2`；待支付订单；准备仅 sandbox payment intent 或激活码兑换；客户端只可提出 SKU、price snapshot precondition 与 source platform；真正 price snapshot、金额、币种和 order state 均服务端派生。订单幂等；不以客户端成功页激活权益；当前只允许 `SANDBOX_HMAC`，真实渠道/生产支付/自动续费均关闭；AC-D.2、AC-D.4、AC-D.5、AC-I.4；normalizedCells: J12.1 浏览商品和创建订单；`Official` `/pricing`、`commerce/*`、`me/membership`；成人学习者；公开 SKU 或已认证主体、`expectedPriceSnapshotId` precondition、`sourcePlatform`；`getB13PublicCommerceCatalog`、`getB13CommerceReadiness`、`listB13CommerceSkus`、`listB13CommerceOrders`、`createB13CommerceOrder`；`commerce-service`／SKU、订单、价格快照、审计；`commerce.order.created.v2`；待支付订单；准备仅 sandbox payment intent 或激活码兑换；客户端只可提出 SKU、price snapshot precondition 与 source platform；真正 price snapshot、金额、币种和 order state 均服务端派生。订单幂等；不以客户端成功页激活权益；当前只允许 `SANDBOX_HMAC`，真实渠道/生产支付/自动续费均关闭；AC-D.2、AC-D.4、AC-D.5、AC-I.4；columns: 步骤: J12.1 浏览商品和创建订单；页面／角色: `Official` `/pricing`、`commerce/*`、`me/membership`；成人学习者；输入与前置: 公开 SKU 或已认证主体、`expectedPriceSnapshotId` precondition、`sourcePlatform`；API（operationId 或 GAP）: `getB13PublicCommerceCatalog`、`getB13CommerceReadiness`、`listB13CommerceSkus`、`listB13CommerceOrders`、`createB13CommerceOrder`；服务／事实 owner: `commerce-service`／SKU、订单、价格快照、审计；状态／目标事件: `commerce.order.created.v2`；输出: 待支付订单；下一步: 准备仅 sandbox payment intent 或激活码兑换；失败／补偿: 客户端只可提出 SKU、price snapshot precondition 与 source platform；真正 price snapshot、金额、币种和 order state 均服务端派生。订单幂等；不以客户端成功页激活权益；当前只允许 `SANDBOX_HMAC`，真实渠道/生产支付/自动续费均关闭；验收: AC-D.2、AC-D.4、AC-D.5、AC-I.4；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J12.2 发起 sandbox 支付、验签回调与权益激活；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 136；text: | J12.2 发起 sandbox 支付、验签回调与权益激活 | 收银页/等待页；provider 仅向服务端 workload 回调 | orderId、paymentAttemptId、provider；回调原文/签名只能在 provider → commerce 的受控内部边界短暂处理 | `prepareB13PaymentIntent`、`consumeB13PaymentProviderCallback`（internal） | `commerce-service`／payment attempt、callback receipt、验签、权益、退款/对账 | `commerce.payment.requested.v2` → `commerce.payment.callback_received.v2` → `commerce.payment.verified.v2` → `commerce.entitlement.activated.v2` | 已验证的权益或明确失败原因 | 查询权益/返回学习 | 仅 `SANDBOX_HMAC`；回调按服务端去重、绑定并 fail closed，不能记录原文、签名、真实凭据或 raw transaction id 到事件。验签、退款、对账、回滚、资质 Gate 未通过时生产支付持续关闭 | AC-D.2–AC-D.5、AC-I.4、AC-L.2 |；cells: J12.2 发起 sandbox 支付、验签回调与权益激活；收银页/等待页；provider 仅向服务端 workload 回调；orderId、paymentAttemptId、provider；回调原文/签名只能在 provider → commerce 的受控内部边界短暂处理；`prepareB13PaymentIntent`、`consumeB13PaymentProviderCallback`（internal）；`commerce-service`／payment attempt、callback receipt、验签、权益、退款/对账；`commerce.payment.requested.v2` → `commerce.payment.callback_received.v2` → `commerce.payment.verified.v2` → `commerce.entitlement.activated.v2`；已验证的权益或明确失败原因；查询权益/返回学习；仅 `SANDBOX_HMAC`；回调按服务端去重、绑定并 fail closed，不能记录原文、签名、真实凭据或 raw transaction id 到事件。验签、退款、对账、回滚、资质 Gate 未通过时生产支付持续关闭；AC-D.2–AC-D.5、AC-I.4、AC-L.2；normalizedCells: J12.2 发起 sandbox 支付、验签回调与权益激活；收银页/等待页；provider 仅向服务端 workload 回调；orderId、paymentAttemptId、provider；回调原文/签名只能在 provider → commerce 的受控内部边界短暂处理；`prepareB13PaymentIntent`、`consumeB13PaymentProviderCallback`（internal）；`commerce-service`／payment attempt、callback receipt、验签、权益、退款/对账；`commerce.payment.requested.v2` → `commerce.payment.callback_received.v2` → `commerce.payment.verified.v2` → `commerce.entitlement.activated.v2`；已验证的权益或明确失败原因；查询权益/返回学习；仅 `SANDBOX_HMAC`；回调按服务端去重、绑定并 fail closed，不能记录原文、签名、真实凭据或 raw transaction id 到事件。验签、退款、对账、回滚、资质 Gate 未通过时生产支付持续关闭；AC-D.2–AC-D.5、AC-I.4、AC-L.2；columns: 步骤: J12.2 发起 sandbox 支付、验签回调与权益激活；页面／角色: 收银页/等待页；provider 仅向服务端 workload 回调；输入与前置: orderId、paymentAttemptId、provider；回调原文/签名只能在 provider → commerce 的受控内部边界短暂处理；API（operationId 或 GAP）: `prepareB13PaymentIntent`、`consumeB13PaymentProviderCallback`（internal）；服务／事实 owner: `commerce-service`／payment attempt、callback receipt、验签、权益、退款/对账；状态／目标事件: `commerce.payment.requested.v2` → `commerce.payment.callback_received.v2` → `commerce.payment.verified.v2` → `commerce.entitlement.activated.v2`；输出: 已验证的权益或明确失败原因；下一步: 查询权益/返回学习；失败／补偿: 仅 `SANDBOX_HMAC`；回调按服务端去重、绑定并 fail closed，不能记录原文、签名、真实凭据或 raw transaction id 到事件。验签、退款、对账、回滚、资质 Gate 未通过时生产支付持续关闭；验收: AC-D.2–AC-D.5、AC-I.4、AC-L.2；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J12.3 兑换激活码和读取权益；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 137；text: | J12.3 兑换激活码和读取权益 | `commerce/*`、`me/membership`；成人学习者 | activation code 的短暂输入或本人主体 | `redeemB13ActivationCode`、`listB13MyEntitlements` | `commerce-service`／activation digest-only、一次 redemption、entitlement、撤销/过期流水 | `commerce.entitlement.activated.v2`、`commerce.entitlement.revoked.v2`、`commerce.refund.settled.v2` | 可审计的权益状态 | 带权益的内容读取 | 只持久化 SHA-256 digest 和 opaque redemption reference；raw code/hash/hash-prefix 不得进入事件或审计。到期/退款只降级访问、不删除学习数据；展示权益前必须回读服务端确认 | AC-D.2、AC-D.3、AC-I.4 |；cells: J12.3 兑换激活码和读取权益；`commerce/*`、`me/membership`；成人学习者；activation code 的短暂输入或本人主体；`redeemB13ActivationCode`、`listB13MyEntitlements`；`commerce-service`／activation digest-only、一次 redemption、entitlement、撤销/过期流水；`commerce.entitlement.activated.v2`、`commerce.entitlement.revoked.v2`、`commerce.refund.settled.v2`；可审计的权益状态；带权益的内容读取；只持久化 SHA-256 digest 和 opaque redemption reference；raw code/hash/hash-prefix 不得进入事件或审计。到期/退款只降级访问、不删除学习数据；展示权益前必须回读服务端确认；AC-D.2、AC-D.3、AC-I.4；normalizedCells: J12.3 兑换激活码和读取权益；`commerce/*`、`me/membership`；成人学习者；activation code 的短暂输入或本人主体；`redeemB13ActivationCode`、`listB13MyEntitlements`；`commerce-service`／activation digest-only、一次 redemption、entitlement、撤销/过期流水；`commerce.entitlement.activated.v2`、`commerce.entitlement.revoked.v2`、`commerce.refund.settled.v2`；可审计的权益状态；带权益的内容读取；只持久化 SHA-256 digest 和 opaque redemption reference；raw code/hash/hash-prefix 不得进入事件或审计。到期/退款只降级访问、不删除学习数据；展示权益前必须回读服务端确认；AC-D.2、AC-D.3、AC-I.4；columns: 步骤: J12.3 兑换激活码和读取权益；页面／角色: `commerce/*`、`me/membership`；成人学习者；输入与前置: activation code 的短暂输入或本人主体；API（operationId 或 GAP）: `redeemB13ActivationCode`、`listB13MyEntitlements`；服务／事实 owner: `commerce-service`／activation digest-only、一次 redemption、entitlement、撤销/过期流水；状态／目标事件: `commerce.entitlement.activated.v2`、`commerce.entitlement.revoked.v2`、`commerce.refund.settled.v2`；输出: 可审计的权益状态；下一步: 带权益的内容读取；失败／补偿: 只持久化 SHA-256 digest 和 opaque redemption reference；raw code/hash/hash-prefix 不得进入事件或审计。到期/退款只降级访问、不删除学习数据；展示权益前必须回读服务端确认；验收: AC-D.2、AC-D.3、AC-I.4；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J12.4 将权益用于内容/学习准入；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 138；text: | J12.4 将权益用于内容/学习准入 | 内容/练习入口；成人学习者 | resource、contentVersion、服务端主体与 entitlement snapshot 版本 | `CONTRACT-GAP-COM-001` 的 D2 定义已由 `resolveM1015CommerceEntitlementSnapshot`（internal workload）与版本化 entitlement snapshot/invalidation 冻结；`revokeM1015CommerceEntitlement` 仅受控内部撤销，不是客户端入口 | `commerce-service` 保留 ledger/snapshot；`content-service`/`learning-service` 只在各自 PEP 中读取只读安全事实并自主作出 allow/deny | `commerce.entitlement.activated.v2`/`revoked.v2`/`refund.settled.v2` 只能辅助服务端失效；绝不能直接让前端放行 | 安全的允许/拒绝结果 | 进入内容或价格/续费解释 | 短 TTL、单调 entitlement/source/policy/invalidation 版本与 tombstone；cache miss/expired/unknown/version mismatch/撤销不确定一律拒绝。GRACE=0，退款/撤销/到期/安全/unknown 永不 grace；Gateway 或客户端缓存不是事实。真实 PEP、cache、event invalidation 和恢复仍由 M2/M7/M8 验证 | AC-D.2、AC-D.4、AC-H.8、AC-I.2 |；cells: J12.4 将权益用于内容/学习准入；内容/练习入口；成人学习者；resource、contentVersion、服务端主体与 entitlement snapshot 版本；`CONTRACT-GAP-COM-001` 的 D2 定义已由 `resolveM1015CommerceEntitlementSnapshot`（internal workload）与版本化 entitlement snapshot/invalidation 冻结；`revokeM1015CommerceEntitlement` 仅受控内部撤销，不是客户端入口；`commerce-service` 保留 ledger/snapshot；`content-service`/`learning-service` 只在各自 PEP 中读取只读安全事实并自主作出 allow/deny；`commerce.entitlement.activated.v2`/`revoked.v2`/`refund.settled.v2` 只能辅助服务端失效；绝不能直接让前端放行；安全的允许/拒绝结果；进入内容或价格/续费解释；短 TTL、单调 entitlement/source/policy/invalidation 版本与 tombstone；cache miss/expired/unknown/version mismatch/撤销不确定一律拒绝。GRACE=0，退款/撤销/到期/安全/unknown 永不 grace；Gateway 或客户端缓存不是事实。真实 PEP、cache、event invalidation 和恢复仍由 M2/M7/M8 验证；AC-D.2、AC-D.4、AC-H.8、AC-I.2；normalizedCells: J12.4 将权益用于内容/学习准入；内容/练习入口；成人学习者；resource、contentVersion、服务端主体与 entitlement snapshot 版本；`CONTRACT-GAP-COM-001` 的 D2 定义已由 `resolveM1015CommerceEntitlementSnapshot`（internal workload）与版本化 entitlement snapshot/invalidation 冻结；`revokeM1015CommerceEntitlement` 仅受控内部撤销，不是客户端入口；`commerce-service` 保留 ledger/snapshot；`content-service`/`learning-service` 只在各自 PEP 中读取只读安全事实并自主作出 allow/deny；`commerce.entitlement.activated.v2`/`revoked.v2`/`refund.settled.v2` 只能辅助服务端失效；绝不能直接让前端放行；安全的允许/拒绝结果；进入内容或价格/续费解释；短 TTL、单调 entitlement/source/policy/invalidation 版本与 tombstone；cache miss/expired/unknown/version mismatch/撤销不确定一律拒绝。GRACE=0，退款/撤销/到期/安全/unknown 永不 grace；Gateway 或客户端缓存不是事实。真实 PEP、cache、event invalidation 和恢复仍由 M2/M7/M8 验证；AC-D.2、AC-D.4、AC-H.8、AC-I.2；columns: 步骤: J12.4 将权益用于内容/学习准入；页面／角色: 内容/练习入口；成人学习者；输入与前置: resource、contentVersion、服务端主体与 entitlement snapshot 版本；API（operationId 或 GAP）: `CONTRACT-GAP-COM-001` 的 D2 定义已由 `resolveM1015CommerceEntitlementSnapshot`（internal workload）与版本化 entitlement snapshot/invalidation 冻结；`revokeM1015CommerceEntitlement` 仅受控内部撤销，不是客户端入口；服务／事实 owner: `commerce-service` 保留 ledger/snapshot；`content-service`/`learning-service` 只在各自 PEP 中读取只读安全事实并自主作出 allow/deny；状态／目标事件: `commerce.entitlement.activated.v2`/`revoked.v2`/`refund.settled.v2` 只能辅助服务端失效；绝不能直接让前端放行；输出: 安全的允许/拒绝结果；下一步: 进入内容或价格/续费解释；失败／补偿: 短 TTL、单调 entitlement/source/policy/invalidation 版本与 tombstone；cache miss/expired/unknown/version mismatch/撤销不确定一律拒绝。GRACE=0，退款/撤销/到期/安全/unknown 永不 grace；Gateway 或客户端缓存不是事实。真实 PEP、cache、event invalidation 和恢复仍由 M2/M7/M8 验证；验收: AC-D.2、AC-D.4、AC-H.8、AC-I.2；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-14 · 客服、通知与同步恢复

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J14.1 查看消息和配置通知；J14.2 创建/处理客服工单；J14.3 弱网同步与冲突恢复。
- 状态：通知失败最多 5 次（含首次），再进 DLQ/人工恢复；不把后台任务伪装成已完成；不含 Token、原始音频或未脱敏自由文本；SMS 只允许验证码/安全/换绑/极重要账户支付；内容引用必须有 SHA-256、redaction/scan/object version 和 safe preview；附件必须是 media 授权引用且扫描为 CLEAN；未知法律保全 DENY；客服/运营不得跨域改学习、订单或权益事实；不静默覆盖本地作答、草稿、进度或奖励；按主体/设备/序号/聚合版本去重，恢复关闭前必须 owner reconciliation；所有结论仍为 D2/NOT_RUNTIME_VERIFIED。
- 交互：step: J14.1 查看消息和配置通知；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 157；text: | J14.1 查看消息和配置通知 | `messages`、`settings/notifications`；成人学习者 | 本人主体、设备/同意由服务端校验；偏好使用 `category/channel/enabled/locale/consentVersion/dndWindow/frequencyPolicy/version/expectedVersion` | `listB12Notifications`、`updateB12NotificationPreference`、`markB12NotificationMessageRead`（B12 canonical；B11 historical adapter） | `notification-service`／偏好、模板引用、消息、投递和读回执；`workflow-service` 只持有 retry/DLQ/recovery task | 规划的 v2 事件为 `notification.requested.v2`、`notification.retry_scheduled.v2`、`notification.recovery.completed.v2`；映射必须由政策中的 exact subscription 表签收，旧 v1 不双发 | 消息带 `messageId/templateKey/templateVersion/dedupeKey/expiry/pin/deliveryStatus`；偏好和读回执由 owner 返回 | 待补充（原文未定义后续出口） | 通知失败最多 5 次（含首次），再进 DLQ/人工恢复；不把后台任务伪装成已完成；不含 Token、原始音频或未脱敏自由文本；SMS 只允许验证码/安全/换绑/极重要账户支付 | AC-D.1、AC-F.2、AC-I.4、AC-K.3 |；cells: J14.1 查看消息和配置通知；`messages`、`settings/notifications`；成人学习者；本人主体、设备/同意由服务端校验；偏好使用 `category/channel/enabled/locale/consentVersion/dndWindow/frequencyPolicy/version/expectedVersion`；`listB12Notifications`、`updateB12NotificationPreference`、`markB12NotificationMessageRead`（B12 canonical；B11 historical adapter）；`notification-service`／偏好、模板引用、消息、投递和读回执；`workflow-service` 只持有 retry/DLQ/recovery task；规划的 v2 事件为 `notification.requested.v2`、`notification.retry_scheduled.v2`、`notification.recovery.completed.v2`；映射必须由政策中的 exact subscription 表签收，旧 v1 不双发；消息带 `messageId/templateKey/templateVersion/dedupeKey/expiry/pin/deliveryStatus`；偏好和读回执由 owner 返回；待补充（原文未定义后续出口）；通知失败最多 5 次（含首次），再进 DLQ/人工恢复；不把后台任务伪装成已完成；不含 Token、原始音频或未脱敏自由文本；SMS 只允许验证码/安全/换绑/极重要账户支付；AC-D.1、AC-F.2、AC-I.4、AC-K.3；normalizedCells: J14.1 查看消息和配置通知；`messages`、`settings/notifications`；成人学习者；本人主体、设备/同意由服务端校验；偏好使用 `category/channel/enabled/locale/consentVersion/dndWindow/frequencyPolicy/version/expectedVersion`；`listB12Notifications`、`updateB12NotificationPreference`、`markB12NotificationMessageRead`（B12 canonical；B11 historical adapter）；`notification-service`／偏好、模板引用、消息、投递和读回执；`workflow-service` 只持有 retry/DLQ/recovery task；规划的 v2 事件为 `notification.requested.v2`、`notification.retry_scheduled.v2`、`notification.recovery.completed.v2`；映射必须由政策中的 exact subscription 表签收，旧 v1 不双发；消息带 `messageId/templateKey/templateVersion/dedupeKey/expiry/pin/deliveryStatus`；偏好和读回执由 owner 返回；待补充（原文未定义后续出口）；通知失败最多 5 次（含首次），再进 DLQ/人工恢复；不把后台任务伪装成已完成；不含 Token、原始音频或未脱敏自由文本；SMS 只允许验证码/安全/换绑/极重要账户支付；AC-D.1、AC-F.2、AC-I.4、AC-K.3；columns: 步骤: J14.1 查看消息和配置通知；页面／角色: `messages`、`settings/notifications`；成人学习者；输入与前置: 本人主体、设备/同意由服务端校验；偏好使用 `category/channel/enabled/locale/consentVersion/dndWindow/frequencyPolicy/version/expectedVersion`；API（operationId 或 GAP）: `listB12Notifications`、`updateB12NotificationPreference`、`markB12NotificationMessageRead`（B12 canonical；B11 historical adapter）；服务／事实 owner: `notification-service`／偏好、模板引用、消息、投递和读回执；`workflow-service` 只持有 retry/DLQ/recovery task；状态／目标事件: 规划的 v2 事件为 `notification.requested.v2`、`notification.retry_scheduled.v2`、`notification.recovery.completed.v2`；映射必须由政策中的 exact subscription 表签收，旧 v1 不双发；输出: 消息带 `messageId/templateKey/templateVersion/dedupeKey/expiry/pin/deliveryStatus`；偏好和读回执由 owner 返回；下一步: 待补充（原文未定义后续出口）；失败／补偿: 通知失败最多 5 次（含首次），再进 DLQ/人工恢复；不把后台任务伪装成已完成；不含 Token、原始音频或未脱敏自由文本；SMS 只允许验证码/安全/换绑/极重要账户支付；验收: AC-D.1、AC-F.2、AC-I.4、AC-K.3；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: SOURCE_NEXT_UNSPECIFIED；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J14.2 创建/处理客服工单；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 158；text: | J14.2 创建/处理客服工单 | `support`；学习者与 `Admin` 客服角色 | 本人主体由服务端派生；只能提交分类、资源引用、受扫描的内容引用和媒体授权附件引用；不可提交 tenant/subject/role/owner/assignment/SLA/priority | `createSupportTicket`、`getSupportTicket`、`addSupportTicketMessage`；Admin 侧操作必须映射到同一 `admin-ops-service.support` schema、状态机和幂等域；B5/B13 仅历史适配 | `admin-ops-service.support`／ticket、message、assignment、SLA、resolution、retention 唯一 owner；`notification-service` 只发送，`workflow-service` 只升级/恢复；`CONTRACT-GAP-SUPPORT-ROUTING` 在 M1-016 独立 Evidence 签收前保持 OPEN，签收只关闭 D2 路由契约缺口 | v2 D2 投影为 `support.ticket.created.v2`、`support.ticket.resolved.v2`，payload 只含脱敏引用、版本和审计字段；producer/consumer 绑定未签收前不可晋升，真实生产/消费仍待运行 Evidence | 状态严格使用 `OPEN/ASSIGNED/WAITING_USER/WAITING_INTERNAL/RESOLVED/CLOSED/REOPENED`；消息、分配、SLA、留存均有独立版本/历史 | 待补充（原文未定义后续出口） | 内容引用必须有 SHA-256、redaction/scan/object version 和 safe preview；附件必须是 media 授权引用且扫描为 CLEAN；未知法律保全 DENY；客服/运营不得跨域改学习、订单或权益事实 | AC-C.3、AC-D.1、AC-H.9、AC-I.2 |；cells: J14.2 创建/处理客服工单；`support`；学习者与 `Admin` 客服角色；本人主体由服务端派生；只能提交分类、资源引用、受扫描的内容引用和媒体授权附件引用；不可提交 tenant/subject/role/owner/assignment/SLA/priority；`createSupportTicket`、`getSupportTicket`、`addSupportTicketMessage`；Admin 侧操作必须映射到同一 `admin-ops-service.support` schema、状态机和幂等域；B5/B13 仅历史适配；`admin-ops-service.support`／ticket、message、assignment、SLA、resolution、retention 唯一 owner；`notification-service` 只发送，`workflow-service` 只升级/恢复；`CONTRACT-GAP-SUPPORT-ROUTING` 在 M1-016 独立 Evidence 签收前保持 OPEN，签收只关闭 D2 路由契约缺口；v2 D2 投影为 `support.ticket.created.v2`、`support.ticket.resolved.v2`，payload 只含脱敏引用、版本和审计字段；producer/consumer 绑定未签收前不可晋升，真实生产/消费仍待运行 Evidence；状态严格使用 `OPEN/ASSIGNED/WAITING_USER/WAITING_INTERNAL/RESOLVED/CLOSED/REOPENED`；消息、分配、SLA、留存均有独立版本/历史；待补充（原文未定义后续出口）；内容引用必须有 SHA-256、redaction/scan/object version 和 safe preview；附件必须是 media 授权引用且扫描为 CLEAN；未知法律保全 DENY；客服/运营不得跨域改学习、订单或权益事实；AC-C.3、AC-D.1、AC-H.9、AC-I.2；normalizedCells: J14.2 创建/处理客服工单；`support`；学习者与 `Admin` 客服角色；本人主体由服务端派生；只能提交分类、资源引用、受扫描的内容引用和媒体授权附件引用；不可提交 tenant/subject/role/owner/assignment/SLA/priority；`createSupportTicket`、`getSupportTicket`、`addSupportTicketMessage`；Admin 侧操作必须映射到同一 `admin-ops-service.support` schema、状态机和幂等域；B5/B13 仅历史适配；`admin-ops-service.support`／ticket、message、assignment、SLA、resolution、retention 唯一 owner；`notification-service` 只发送，`workflow-service` 只升级/恢复；`CONTRACT-GAP-SUPPORT-ROUTING` 在 M1-016 独立 Evidence 签收前保持 OPEN，签收只关闭 D2 路由契约缺口；v2 D2 投影为 `support.ticket.created.v2`、`support.ticket.resolved.v2`，payload 只含脱敏引用、版本和审计字段；producer/consumer 绑定未签收前不可晋升，真实生产/消费仍待运行 Evidence；状态严格使用 `OPEN/ASSIGNED/WAITING_USER/WAITING_INTERNAL/RESOLVED/CLOSED/REOPENED`；消息、分配、SLA、留存均有独立版本/历史；待补充（原文未定义后续出口）；内容引用必须有 SHA-256、redaction/scan/object version 和 safe preview；附件必须是 media 授权引用且扫描为 CLEAN；未知法律保全 DENY；客服/运营不得跨域改学习、订单或权益事实；AC-C.3、AC-D.1、AC-H.9、AC-I.2；columns: 步骤: J14.2 创建/处理客服工单；页面／角色: `support`；学习者与 `Admin` 客服角色；输入与前置: 本人主体由服务端派生；只能提交分类、资源引用、受扫描的内容引用和媒体授权附件引用；不可提交 tenant/subject/role/owner/assignment/SLA/priority；API（operationId 或 GAP）: `createSupportTicket`、`getSupportTicket`、`addSupportTicketMessage`；Admin 侧操作必须映射到同一 `admin-ops-service.support` schema、状态机和幂等域；B5/B13 仅历史适配；服务／事实 owner: `admin-ops-service.support`／ticket、message、assignment、SLA、resolution、retention 唯一 owner；`notification-service` 只发送，`workflow-service` 只升级/恢复；`CONTRACT-GAP-SUPPORT-ROUTING` 在 M1-016 独立 Evidence 签收前保持 OPEN，签收只关闭 D2 路由契约缺口；状态／目标事件: v2 D2 投影为 `support.ticket.created.v2`、`support.ticket.resolved.v2`，payload 只含脱敏引用、版本和审计字段；producer/consumer 绑定未签收前不可晋升，真实生产/消费仍待运行 Evidence；输出: 状态严格使用 `OPEN/ASSIGNED/WAITING_USER/WAITING_INTERNAL/RESOLVED/CLOSED/REOPENED`；消息、分配、SLA、留存均有独立版本/历史；下一步: 待补充（原文未定义后续出口）；失败／补偿: 内容引用必须有 SHA-256、redaction/scan/object version 和 safe preview；附件必须是 media 授权引用且扫描为 CLEAN；未知法律保全 DENY；客服/运营不得跨域改学习、订单或权益事实；验收: AC-C.3、AC-D.1、AC-H.9、AC-I.2；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: SOURCE_NEXT_UNSPECIFIED；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J14.3 弱网同步与冲突恢复；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 159；text: | J14.3 弱网同步与冲突恢复 | `sync`、`PracticeShell`；成人学习者 | 有序本地队列必须带 `clientEventId/clientSeq/baseVersion/contentVersionId/payloadHash`；tenant/principal/device/owner 由服务端派生；只能同步 owner 允许的实体 | `syncReviewEvents`（SRS 特定）；通用同步为 `CONTRACT-GAP-INF-002`，不得新增中央领域写入者 | 对应领域服务各自唯一 owner；`workflow-service` 只持有恢复任务；客户端不是 Kafka producer | 规划的 v2 事件为 `sync.command_receipted.v2`、`sync.conflict_detected.v2`、`sync.recovered.v2`；事件投影需 owner、consumer、topic、partition 和幂等绑定 | 同 hash 重复请求返回原结果；异 hash、乱序、gap、stale、future 和 content pin 不一致均显式 `CONFLICT`；attempt/mastery/XP/entitlement 禁客户端 merge | 待补充（原文未定义后续出口） | 不静默覆盖本地作答、草稿、进度或奖励；按主体/设备/序号/聚合版本去重，恢复关闭前必须 owner reconciliation；所有结论仍为 D2/NOT_RUNTIME_VERIFIED | AC-A.2、AC-B.3、AC-F.3、AC-I.3–AC-I.5 |；cells: J14.3 弱网同步与冲突恢复；`sync`、`PracticeShell`；成人学习者；有序本地队列必须带 `clientEventId/clientSeq/baseVersion/contentVersionId/payloadHash`；tenant/principal/device/owner 由服务端派生；只能同步 owner 允许的实体；`syncReviewEvents`（SRS 特定）；通用同步为 `CONTRACT-GAP-INF-002`，不得新增中央领域写入者；对应领域服务各自唯一 owner；`workflow-service` 只持有恢复任务；客户端不是 Kafka producer；规划的 v2 事件为 `sync.command_receipted.v2`、`sync.conflict_detected.v2`、`sync.recovered.v2`；事件投影需 owner、consumer、topic、partition 和幂等绑定；同 hash 重复请求返回原结果；异 hash、乱序、gap、stale、future 和 content pin 不一致均显式 `CONFLICT`；attempt/mastery/XP/entitlement 禁客户端 merge；待补充（原文未定义后续出口）；不静默覆盖本地作答、草稿、进度或奖励；按主体/设备/序号/聚合版本去重，恢复关闭前必须 owner reconciliation；所有结论仍为 D2/NOT_RUNTIME_VERIFIED；AC-A.2、AC-B.3、AC-F.3、AC-I.3–AC-I.5；normalizedCells: J14.3 弱网同步与冲突恢复；`sync`、`PracticeShell`；成人学习者；有序本地队列必须带 `clientEventId/clientSeq/baseVersion/contentVersionId/payloadHash`；tenant/principal/device/owner 由服务端派生；只能同步 owner 允许的实体；`syncReviewEvents`（SRS 特定）；通用同步为 `CONTRACT-GAP-INF-002`，不得新增中央领域写入者；对应领域服务各自唯一 owner；`workflow-service` 只持有恢复任务；客户端不是 Kafka producer；规划的 v2 事件为 `sync.command_receipted.v2`、`sync.conflict_detected.v2`、`sync.recovered.v2`；事件投影需 owner、consumer、topic、partition 和幂等绑定；同 hash 重复请求返回原结果；异 hash、乱序、gap、stale、future 和 content pin 不一致均显式 `CONFLICT`；attempt/mastery/XP/entitlement 禁客户端 merge；待补充（原文未定义后续出口）；不静默覆盖本地作答、草稿、进度或奖励；按主体/设备/序号/聚合版本去重，恢复关闭前必须 owner reconciliation；所有结论仍为 D2/NOT_RUNTIME_VERIFIED；AC-A.2、AC-B.3、AC-F.3、AC-I.3–AC-I.5；columns: 步骤: J14.3 弱网同步与冲突恢复；页面／角色: `sync`、`PracticeShell`；成人学习者；输入与前置: 有序本地队列必须带 `clientEventId/clientSeq/baseVersion/contentVersionId/payloadHash`；tenant/principal/device/owner 由服务端派生；只能同步 owner 允许的实体；API（operationId 或 GAP）: `syncReviewEvents`（SRS 特定）；通用同步为 `CONTRACT-GAP-INF-002`，不得新增中央领域写入者；服务／事实 owner: 对应领域服务各自唯一 owner；`workflow-service` 只持有恢复任务；客户端不是 Kafka producer；状态／目标事件: 规划的 v2 事件为 `sync.command_receipted.v2`、`sync.conflict_detected.v2`、`sync.recovered.v2`；事件投影需 owner、consumer、topic、partition 和幂等绑定；输出: 同 hash 重复请求返回原结果；异 hash、乱序、gap、stale、future 和 content pin 不一致均显式 `CONFLICT`；attempt/mastery/XP/entitlement 禁客户端 merge；下一步: 待补充（原文未定义后续出口）；失败／补偿: 不静默覆盖本地作答、草稿、进度或奖励；按主体/设备/序号/聚合版本去重，恢复关闭前必须 owner reconciliation；所有结论仍为 D2/NOT_RUNTIME_VERIFIED；验收: AC-A.2、AC-B.3、AC-F.3、AC-I.3–AC-I.5；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: SOURCE_NEXT_UNSPECIFIED；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/JNY-P1-15 · 隐私导出、账号注销与最终匿名化

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：J15.1 请求与领取隐私导出；J15.2 注销、冷静期、撤回与匿名化。
- 状态：任务异步、可查询、可撤销/过期；事件只含脱敏元数据；跨服务数据汇集需有 owner 授权；冷静期内可撤回；执行失败可恢复且不半删除；合法留存与可删除字段分离，所有子任务可回放。
- 交互：step: J15.1 请求与领取隐私导出；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 171；text: | J15.1 请求与领取隐私导出 | `me/privacy`；本人、经必要二次确认的成人主体 | 导出范围、身份验证；不把导出内容放进普通日志/事件 | `createPrivacyExport` | `learner-service.privacy`／export request、状态与 receipt；`workflow-service` 只协调各领域 owner 生成片段，`audit-service` 留痕 | `privacy.export.requested.v1`、`privacy.export.completed.v1`；下载/status 契约仍为 `CONTRACT-GAP-PRIVACY-EXPORT` | 有效期受控、审计化的导出任务/领取入口 | 设置页或客服 | 任务异步、可查询、可撤销/过期；事件只含脱敏元数据；跨服务数据汇集需有 owner 授权 | AC-D.1、AC-D.5、AC-H.9、AC-L.2 |；cells: J15.1 请求与领取隐私导出；`me/privacy`；本人、经必要二次确认的成人主体；导出范围、身份验证；不把导出内容放进普通日志/事件；`createPrivacyExport`；`learner-service.privacy`／export request、状态与 receipt；`workflow-service` 只协调各领域 owner 生成片段，`audit-service` 留痕；`privacy.export.requested.v1`、`privacy.export.completed.v1`；下载/status 契约仍为 `CONTRACT-GAP-PRIVACY-EXPORT`；有效期受控、审计化的导出任务/领取入口；设置页或客服；任务异步、可查询、可撤销/过期；事件只含脱敏元数据；跨服务数据汇集需有 owner 授权；AC-D.1、AC-D.5、AC-H.9、AC-L.2；normalizedCells: J15.1 请求与领取隐私导出；`me/privacy`；本人、经必要二次确认的成人主体；导出范围、身份验证；不把导出内容放进普通日志/事件；`createPrivacyExport`；`learner-service.privacy`／export request、状态与 receipt；`workflow-service` 只协调各领域 owner 生成片段，`audit-service` 留痕；`privacy.export.requested.v1`、`privacy.export.completed.v1`；下载/status 契约仍为 `CONTRACT-GAP-PRIVACY-EXPORT`；有效期受控、审计化的导出任务/领取入口；设置页或客服；任务异步、可查询、可撤销/过期；事件只含脱敏元数据；跨服务数据汇集需有 owner 授权；AC-D.1、AC-D.5、AC-H.9、AC-L.2；columns: 步骤: J15.1 请求与领取隐私导出；页面／角色: `me/privacy`；本人、经必要二次确认的成人主体；输入与前置: 导出范围、身份验证；不把导出内容放进普通日志/事件；API（operationId 或 GAP）: `createPrivacyExport`；服务／事实 owner: `learner-service.privacy`／export request、状态与 receipt；`workflow-service` 只协调各领域 owner 生成片段，`audit-service` 留痕；状态／目标事件: `privacy.export.requested.v1`、`privacy.export.completed.v1`；下载/status 契约仍为 `CONTRACT-GAP-PRIVACY-EXPORT`；输出: 有效期受控、审计化的导出任务/领取入口；下一步: 设置页或客服；失败／补偿: 任务异步、可查询、可撤销/过期；事件只含脱敏元数据；跨服务数据汇集需有 owner 授权；验收: AC-D.1、AC-D.5、AC-H.9、AC-L.2；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN；step: J15.2 注销、冷静期、撤回与匿名化；source: path: docs/06-design/v2-980plus/phase1-business-operation/02-端到端业务旅程台账.md；line: 172；text: | J15.2 注销、冷静期、撤回与匿名化 | `me/privacy`；本人、二次确认 | 7 天冷静期、撤回动作、合法保留/审计规则 | `CONTRACT-GAP-USR-DEL-001`：缺注销 request/cancel/execute/status OpenAPI、`account.deletion_requested.v1`/完成事件、跨服务清单和补偿/保留策略 | `iam-service`／deletion request、冷静期和主体最终状态；各领域 owner 处理自身数据，`workflow-service` 只能编排，不能跨域双写 | `EVENT-GAP-USR-DEL-001`：尚无已签收的 requested/cancelled/completed canonical 事件 | 可撤回的删除请求，期满后经审计的匿名化结果 | 登录/学习入口应明确受限；完成后不再恢复身份 | 冷静期内可撤回；执行失败可恢复且不半删除；合法留存与可删除字段分离，所有子任务可回放 | AC-D.1、AC-F.5、AC-H.9、AC-I.2–AC-I.5、AC-L.2 |；cells: J15.2 注销、冷静期、撤回与匿名化；`me/privacy`；本人、二次确认；7 天冷静期、撤回动作、合法保留/审计规则；`CONTRACT-GAP-USR-DEL-001`：缺注销 request/cancel/execute/status OpenAPI、`account.deletion_requested.v1`/完成事件、跨服务清单和补偿/保留策略；`iam-service`／deletion request、冷静期和主体最终状态；各领域 owner 处理自身数据，`workflow-service` 只能编排，不能跨域双写；`EVENT-GAP-USR-DEL-001`：尚无已签收的 requested/cancelled/completed canonical 事件；可撤回的删除请求，期满后经审计的匿名化结果；登录/学习入口应明确受限；完成后不再恢复身份；冷静期内可撤回；执行失败可恢复且不半删除；合法留存与可删除字段分离，所有子任务可回放；AC-D.1、AC-F.5、AC-H.9、AC-I.2–AC-I.5、AC-L.2；normalizedCells: J15.2 注销、冷静期、撤回与匿名化；`me/privacy`；本人、二次确认；7 天冷静期、撤回动作、合法保留/审计规则；`CONTRACT-GAP-USR-DEL-001`：缺注销 request/cancel/execute/status OpenAPI、`account.deletion_requested.v1`/完成事件、跨服务清单和补偿/保留策略；`iam-service`／deletion request、冷静期和主体最终状态；各领域 owner 处理自身数据，`workflow-service` 只能编排，不能跨域双写；`EVENT-GAP-USR-DEL-001`：尚无已签收的 requested/cancelled/completed canonical 事件；可撤回的删除请求，期满后经审计的匿名化结果；登录/学习入口应明确受限；完成后不再恢复身份；冷静期内可撤回；执行失败可恢复且不半删除；合法留存与可删除字段分离，所有子任务可回放；AC-D.1、AC-F.5、AC-H.9、AC-I.2–AC-I.5、AC-L.2；columns: 步骤: J15.2 注销、冷静期、撤回与匿名化；页面／角色: `me/privacy`；本人、二次确认；输入与前置: 7 天冷静期、撤回动作、合法保留/审计规则；API（operationId 或 GAP）: `CONTRACT-GAP-USR-DEL-001`：缺注销 request/cancel/execute/status OpenAPI、`account.deletion_requested.v1`/完成事件、跨服务清单和补偿/保留策略；服务／事实 owner: `iam-service`／deletion request、冷静期和主体最终状态；各领域 owner 处理自身数据，`workflow-service` 只能编排，不能跨域双写；状态／目标事件: `EVENT-GAP-USR-DEL-001`：尚无已签收的 requested/cancelled/completed canonical 事件；输出: 可撤回的删除请求，期满后经审计的匿名化结果；下一步: 登录/学习入口应明确受限；完成后不再恢复身份；失败／补偿: 冷静期内可撤回；执行失败可恢复且不半删除；合法留存与可删除字段分离，所有子任务可回放；验收: AC-D.1、AC-F.5、AC-H.9、AC-I.2–AC-I.5、AC-L.2；sourceTableHeader: 步骤；页面／角色；输入与前置；API（operationId 或 GAP）；服务／事实 owner；状态／目标事件；输出；下一步；失败／补偿；验收；sourceTableNormalization: EXACT_TEN_COLUMN_STEP_TABLE；uiApplicability: ACTOR_AND_VISIBLE_EFFECT_REVIEW_REQUIRED_NOT_EVERY_SYSTEM_STEP_IS_A_SCREEN。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/RULE-P1-PLACEMENT · 定级维度、权重、分段、置信度与推荐起点

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：定级维度、权重、分段、置信度与推荐起点。
- 状态：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 交互：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/RULE-P1-DAILY-PLAN · 候选池、优先级、5/15/30/45 分钟预算、积压和解释码

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：候选池、优先级、5/15/30/45 分钟预算、积压和解释码。
- 状态：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 交互：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/RULE-P1-SESSION · Session、checkpoint、提交、判分确认和任务完成

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：Session、checkpoint、提交、判分确认和任务完成。
- 状态：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 交互：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/RULE-P1-SRS · 复习质量、EF、间隔、dueAt、乱序和迁移

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：复习质量、EF、间隔、dueAt、乱序和迁移。
- 状态：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 交互：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/RULE-P1-MISTAKE-REPAIR · 错题产生、变式修复、D+1/D+7 延迟验证

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：错题产生、变式修复、D+1/D+7 延迟验证。
- 状态：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 交互：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/RULE-P1-MASTERY · 证据聚合、技能掌握投影和 MASTERED Gate

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：证据聚合、技能掌握投影和 MASTERED Gate。
- 状态：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 交互：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/RULE-P1-REPORT · 日/周/阶段报告指标、数据水位和重建

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：日/周/阶段报告指标、数据水位和重建。
- 状态：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 交互：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。

## CANONICAL/RULE-P1-TIME-SYNC · 时区、学习日、离线顺序、幂等和冲突恢复

- 需求：独立 PAGE / JNY / RULE 义务。
- 页面：时区、学习日、离线顺序、幂等和冲突恢复。
- 状态：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 交互：核对规则在具体页面的可见解释/状态/输入与恢复，不把服务端算法或事实源画成客户端权威。。
- 实际候选：尚无已核对的原生候选。
- 整项核验：UNVERIFIED；OPEN。
