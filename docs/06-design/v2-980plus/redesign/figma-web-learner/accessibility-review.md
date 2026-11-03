# Web学员端无障碍与响应式设计复核

不能确认全量无障碍或响应式已通过。已证实部分截图样例（写作768为提示修正前布局图、修后待验）和一个固定保存返回样例；26个静态Choice按实际语义分类并准备精确修复。其它焦点、读屏、全局偏好先读现有稿，不能靠名称或说明段落核销。

本轮仅审查当前Web源要求和已落盘实际证据，0 Figma调用、0浏览器操作、0仓库写入。所有新增图稿/补丁均为 **TIMING_HOLD，尚未执行**。

## 当前可以确认的范围

- 阅读1440/1024/768、200%字号和订单768的列明截图样例由主审确认通过；writing-768.png仅为提示修正前布局样例（BEFORE_NORMAL_HINT_CORRECTION_NOT_FINAL）。写作提示修复另有实际回执，修后截图待验；不外推到全部业务、状态或设备。
- 阅读收藏的固定样例已实际走到回执并返回同文章v1第2段；其余查询、计时、焦点和滚动保持尚未全部验证。
- 真正键盘与读屏为 **NOT_RUN**；Figma原型提示读屏支持关闭。图稿、文字说明和本地状态模型不能替代这些验证。

## 按源要求逐项审查

| 项目 | 现有设计与边界 | 最小后续动作 |
|---|---|---|
|可见焦点|当前新Choice集只有Default/Selected/Disabled，focus颜色Token已存在；正常蓝色边框或Selected状态均不能算键盘焦点。已有焦点审阅稿须先读正文。 新Choice库焦点态未证实；现有焦点稿未精读，不能判全局缺失。|Read35:382/35:302 first. If missing, add Normal/FocusVisible/Disabled specimens, non-clipped outline, initial-focus and Tab/reading-order targets.|
|键盘路径|需求明确登录→目标→作答→提交→返回。26项业务语义已逐一分类，按钮、radio、checkbox、定位字幕和结构探索不能共用一种选择模型。 已准备具体控件合同；真实Tab/方向键/空格/Enter操作未跑。|Specify actual button/checkbox/radio/tree/input/player keys and order. Exploration controls must not be blindly turned into radio groups.|
|错误定位与提示|既有失败状态有原因和恢复动作，但须核具体字段关联、保留输入、提交后错误焦点位置与纠正后反馈。 原因文案不等于错误焦点或读屏关联；旧错误与焦点说明稿优先回读。|Read73:234/73:546, then annotate real field association, submit error target, retained input, and correction/recovery actions; generic error cards do not substitute.|
|异步声明和焦点保持|可见的正在保存/查询/确认回执是视觉反馈；尚无真实读屏声明、去重和不打断输入的验收。 固定阅读收藏样例已通过保存回执及同来源返回；查询和其它计时仍待校准，焦点/滚动保持未验。|Annotate real pending/query/receipt/error messages, announcement priority/deduplication, preserved focus/scroll, and manual query. status/alert are suggested implementation semantics, not verbatim source requirements.|
|模态初始焦点和返回|真正弹层需定义初始焦点、Tab范围、关闭/Esc与原触发点返回；整页NAV确认不能冒充模态已验证。只在丢失未提交输入时确认离开。 既有关闭/离开焦点稿未精读；当前全页闭环不自动升级为模态焦点通过。|Read73:311/73:387/73:546. Actual modals need opener ID, initial focus, close/Esc behavior, and fallback if opener disappears. Preserve pending locks and operation identity.|
|颜色之外的状态|已证实表达编辑器两项静态“未选择”与实际布尔状态矛盾；其余24项按radio/探索/字幕定位分别修补。 已准备精确补丁；尚未写入或回读，不计修复完成。|Parent should precisely repair actual IDs with existing variables: state-driven selected markers for radio/checkbox; current/explore labels for exploration. Keep pending guards.|
|减少动效和静态替代|词条音素稿有静态2D和文本替代；全局画质/动效入口已连到235:2445，目标正文未读。 不能由单个静态页推定图谱、媒体、反馈共用偏好；先回读现有设置，不另造平行设置页。|Read existing235:2445 first; check selection, return/preservation, and shared preference consumption by media/graph/feedback. Missing media stays readable/static.|
|跟随系统与四主题偏好|Light/Dark/HighContrast是解析后的颜色模式；FollowSystem可解析为亮或暗，不强制新增第四颜色Mode。阅读设置只写了说明，全局外观入口已到235:2182。 需查四偏好可操作选择、当前系统解析状态、系统变化示例与返回保持；现有目标未读，不能判全局缺失。|Read235:2182 only: four preferences, current resolved system appearance, system light-to-dark example, return/preservation. Add precise missing control only if confirmed.|

源要求见 `redesign/interaction-chains.md:431–435`、`01-统一交互与页面状态设计.md:94–107`、`requirements/product-requirements.md:2553–2562,2963–2972`。共享Token要求焦点轮廓3px、偏移2px，见 `packages/design-tokens/src/index.ts:196–204`。JSON为每项保留完整绝对路径、行号与证据指针。

## 26项静态Choice的业务分类

| 实际根与控件 | 正确语义 | 精确修补 |
|---|---|---|
| 378:9122，378:9762/9767 | 两项互相独立的checkbox；随保存提交 | marker直接绑定现有wantStatus/reviewStatus STRING。布尔值、pending锁和提交身份不变。 |
| 378:10412，378:10963…10992共8项 | 互斥听辨分类filter | 由soundFocus驱动Default/Selected两视觉态；不影响示例和分类解释。 |
| 379:20624，379:20929/20933/20937 | 三选一答案radio | 由answer驱动选择态；379:20902新路径重置同时清空3项视觉选择。 |
| 354:3673共6项；379:19069共4项 | 成分说明探索按钮 | 改为“查看成分说明”，取消误导的选择/答案语义，保留每个具体解释动作。 |
| 378:10268，378:10665/10670/10675 | 字幕定位按钮 | 改为“定位到这一句”；保留cueIndex/时间/翻译同步，不假装播放器已验。 |

`a11y-choice-repair-factory-v1-tool.js` 默认HOLD，在任何原生读取前返回。恢复后先PROBE再APPLY；每项验实际ID、root、parent、组件属性、marker及完整reaction SHA。radio只扫描实际成功的10个Listening A和16个Reading B根；发现未知writer、已有业务可见性Gate或动态取值立即阻写。

补丁不改计时、共享master、未列菜单、业务输入或operation/take元组。只增加11个Selected实例和22个私有视觉镜像Boolean；同步SET插在原有受保护业务SET旁。写后移除新增镜像SET必须与每个原完整程序完全一致；清理失败逐项报告。成功后须原生回读和真实原型选择/取消/重置测试，不能把本地7项校验当通过。

## 焦点与语义的最小设计稿

现有35:382、73:546、35:302、73:234、73:311、73:387已有焦点/错误/返回候选；先读正文，名称不核销。`a11y-focus-review-manifest.json`仅冻结条件规格：复用现有review页补Normal/FocusVisible/Selected+FocusVisible/Disabled和Invalid+FocusVisible样例，最多一个独立review根，0新增业务页，不改共享master。尚未证实缺失前不创建重复页。

控件合同分别锚定12:2按钮、12:4输入、350:3179 Choice集。可见焦点必须独立于选择；输入错误须关联具体字段；异步确认去重且不抢正在编辑的焦点；真正模态写明opener、初始焦点、Tab范围、Esc与关闭返回。HTML role/live-region是实现建议，不是已有Figma语义。

阅读返回焦点具体锚定查词379:19565、结构379:19567、收藏379:19569、设置379:19598、笔记379:19600、阅读理解379:19607。现有NAV多使用resetScrollPosition:true，属于需专项验证的潜在冲突，不能推翻已通过的同文章第2段固定样例，也不能盲改全局导航。

## 续办顺序

1. 先回读并对账4根主审GUI已改计时：378:9826/9884/14435/14493，保留全部take动作，完成时间单位校准。
2. 只读现有焦点/错误返回稿；补足实际字段、触发点和焦点顺序合同。
3. 对26项Choice先PROBE再精确修补，回读完整程序并测试选择/重置/锁定；2项checkbox若先由v2完成则跳过。
4. 只读235:2182外观与235:2445动效，确认四偏好和全局减少动效；有确证缺口才修现有目标。
5. 在真实界面跑完整键盘、读屏、错误、异步和模态路径。Figma无法验证的项目保留NOT_RUN。

另已确证跨域草稿缺陷：idle/accepted不能证明clean，原备注378:9777为静态未绑定文本，原保存378:9780未冻结完整draft。Global搜索已转只读入口；skills-expression-draft-guard-v1-manifest.json冻结最多4目标及Auth3/Consent16 actual依赖，18项仅本地模型，不计原生修复。

所有确切控件/证据指针、条件规格、工厂防护与未验边界见accessibility-review.json及工厂manifest；**尚不能宣称全量页面无障碍和响应式验收完成**。

本文件的来源原文及SHA见 [逐项审查](accessibility-review.json)。正文中的本机脚本和工厂文件名仅供 [续办操作包](RESUME.md) 定位，不是随仓已验收证据。
