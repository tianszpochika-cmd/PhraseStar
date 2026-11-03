# 注册页组合审核 B26

注册页已按 Figma 原素材、品牌区、表单面板与主次动作改造，保留 IAM TLS、账号3–128、密码原文12–128、成人Gate与安全回跳。Root只复制Grok B17冻结15文件：页面/E2E、中央注册页9个新增词条每语言、10个原素材，以及两项QA修正（旧login租约PID元数据、B23 file-URL loader）。没有降低断言或修改保护中的Web业务。

最终页面 SHA `64603f4c9eb17c62702b2ea02c469c860ffa200de5c5c1a45b1204a95c3d5f88`；中央文案 SHA `0fcd7a4f0e49da8fdf3a07b8657678240165ed57b0ae6595b32c44d0e2486ef5`。共享experience/public-documents/uni-runtime/FigmaAsset/主题素材表/Token128与已审版本逐字节一致。当前DSH页面资源内容保留。

Root在当前组合上通过12项认证/公开文档检查、mobile/i18n类型及H5构建，独立浏览器 **51样本/14组行为/43图**。即时输入、密码长度边界、141字符不截断且无无效请求、显示密码、键盘与旧中心快速点击/拖离取消、busy、冲突中和文案、safe return、注册成功但成人门未通过时去onboarding、真实noopener协议弹窗均通过。pageerror0；17条预期HTTP失败保留（409×14、429×1、503×1、404×1），不是clean console。官网文档内容与真实IAM仍未验。

看图后修复的暗色/HC显隐图标采用已发布同语义原dark SVG，未改字节或滤色。亮色仍10唯一原文件/12实例；暗色五枚字段图标逐个验证实际绘制URL、SHA、尺寸、原颜料及合成背景对比，最小7.18:1；系统暗→亮实时切换通过。亮色eye对暗底仅1.195:1的原失败及早期资产观察器错误均保留。

**全局B23 auth-localization仍1/6通过、5失败**：旧枚举性账号冲突断言、保护中Web的三处标记/正则、resetRequest旧回执期望。loader已可真实执行，不将失败改成通过，不据局部认证检查声称全项目全绿。后续需按现行规则修复测试或实现，另有任务边界。

状态为 `REVIEWED_LOCAL_UI_CANDIDATE_TRACE_PENDING`。真实服务、原生/真机、系统键盘/读屏、部署和完整追溯未签收，未推送远端。精确来源及Root结果见 [源码清单](../evidence/B26-REGISTER-SOURCE-MANIFEST.json)、[审核回执](../evidence/B26-REGISTER-REVIEW.json)。
