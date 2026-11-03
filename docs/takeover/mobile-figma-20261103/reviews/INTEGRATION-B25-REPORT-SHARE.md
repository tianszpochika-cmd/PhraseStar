# 公开报告分享组合审核 B25

分享页按 Figma 的加载、有效、撤销、过期、未找到和读取失败层次改造，保留公开只读统计和明确安全出口。Root 从 DSH B16 冻结包复制13文件（页面、测试、双语资源及10个原SVG），不复制旧设置、Token127或旧共享文件。最终页面 SHA `9d031981ffb4c891a30a679227111aa1c94ad85a09de8fcb0d37c673e135e4fc`。

公开 GET 只渲染统计/时段/建议等 allowlist，不展示 owner、私有报告ID、分数或错误明细；404、403/500与未知响应分开，invalid ref不发请求；retry single-flight/busy、A/B与onHide迟到丢弃保留。缺统计/时长显示缺失，不假填0。日期使用UTC日历值且结束日按exclusive减一天，修复洛杉矶时区前移一天；非法日期和反向范围不被自动归一。

Root 在当前组合上通过 **11/11测试、mobile+i18n类型与H5构建**，独立重跑 **73项访客/布局/时区检查、21图**，以及 **14项真实UI登录后公开分享检查、4图**。Root看过HC200及320英文200；大字首屏需要滚动，最后内容可滚过固定动作栏，无横向溢出。

已登录检查从真实登录表单建立合成会话：受保护principal/profile请求 AuthorizationPresent=true；进入公开分享后 public GET=false，分享阶段无refresh/principal/private报告请求；回个人页原会话仍在。访客与已登录公开页不呈现私有canary。只记录授权是否存在，不保存值或凭据。这是客户端合成环境证据，不证明服务端脱敏或真实鉴权已验。console中预期HTTP失败保留，不称clean。

按已有产品规则，设计中的营销“我也想试试”不新增，底栏为安全返回/重试；guest实际点击返回及Header back均进入既有login guard。公开share不计入私有错题/日报周报页面完成；后者另归MB-016。

状态为 `REVIEWED_LOCAL_UI_CANDIDATE_TRACE_PENDING`。真实IAM/Gateway、原生/真机、读屏、部署和完整追溯仍未签收；未推送远端。精确来源与Root检查见 [源码清单](../evidence/B25-REPORT-SHARE-SOURCE-MANIFEST.json)、[审核回执](../evidence/B25-REPORT-SHARE-REVIEW.json)。
