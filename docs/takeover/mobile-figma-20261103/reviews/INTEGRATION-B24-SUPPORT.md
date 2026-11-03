# 客服与帮助组合审核 B24

客服页由静态接口字段表改为 Figma 的标题、提示、工单行与详情徽章，加载、空、失败和权限状态各有明确动作。底部固定栏随状态提供刷新、重试、查询和返回，320px/200%下保留可滚动内容。分页保留已读列表，按真实 nextCursor 续读，去重与忙碌锁防重复；错误可重试同游标，A→B→A 循环停止并只留一个刷新入口。

Root 从 DSH B26 冻结包机械复制12文件（5个源码/测试/资源、7个原SVG）。页面 SHA `5a55baa420c1c6a39965e7a1080b7aa3bc7777b0baaa4835cc724009cadfd041`；support GET adapter SHA `8a40819f7dfed8c5fcd8c4e1e43a846ad32cd3cbdba9d7276b6de1e8099bdf9b`。共享Header、Token128与当前登录/设置/设备保持原字节。

API仅修现有 GET list/detail：正式数组与严格 cursor meta；最小旧 IT7 `{ticketId,categoryCode,state,...}` 兼容分支；原 raw/wrapped closure board 行为保留供设置页使用。没有创建、消息、上传或跨服务写入。401/403不伪空，丢弃无身份/切号/隐藏页面的迟到数据，detail ID 不符不展示其他工单。

Root 在当前组合源码上通过 **49/49支持页/API/设置页测试、mobile+i18n类型、H5构建**；真实编译产物加合成接口 **198/198浏览器检查、24图**。原B25 harness只适配Root路径；17份源码SHA前后相同，unknown/blocked/pageerror/artifactmiss均0。8条预期HTTP错误保留（500×3、404×1、403×2、401×2），不是clean console。显式CORS GET/OPTIONS检查通过，不声称观察到app自然preflight。

作者B26在同一页面字节上补13场景220检查/13图，含dark/system/en/320/200%/HC/768/1024/reduced/长ID/分页提示和真实键盘单次动作；Root看过英文详情、HC错误及1024图。dark/HC按钮和徽章对比通过作者实测。该补矩阵属于作者回执，未记成Root重跑或真实iPad验证。

保留两项范围限制：详情底栏的“返回+查询”保留现有真实能力，与参考单刷新略有差别；768/1024采用全宽，能操作且无横向溢出，独立iPad视觉签收待补。没有伪造摘要、消息、人名或队列处理时间。新工单/聊天/附件保持关闭。真实服务、原生/真机/读屏、部署及完整追溯未签收；本次为 `REVIEWED_LOCAL_UI_CANDIDATE_TRACE_PENDING`，未推送远端。

来源、源SHA与验证见 [源码清单](../evidence/B24-SUPPORT-SOURCE-MANIFEST.json) 和 [Root回执](../evidence/B24-SUPPORT-REVIEW.json)。
