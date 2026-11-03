# 设置页候选组合审核 B22

Root 逐 SHA 整合 DSH-PROFILE 冻结的 15 个文件：页面、专属测试、176 键双语资源与 12 个原 SVG。保留当前 Grok 中央注册、128 项 Token 和 DSH Header；未覆盖作者树的 127 项 Token 或其他页面。页面保留账户偏好、14 类通知、免打扰、内容语言、学习目标、隐私撤回与设备入口；保存外观和其他即时生效操作分开说明。

源码检查 24/24、类型和 H5 build 通过。Root 对 B10 组合源执行真实 production build 加本地 API fixture：134 项/28 图通过；另从设置实际导航到已整合离线页，聚焦其返回图标并返回设置，5 项通过，其他页 inline 样式不变。H5 此次导航的设置根被卸载，不据此声称原生缓存页面已验。

审核发现并退回的缺陷均已有作者修正：光晕切边、uni-button 伪元素方框、disabled 视觉、文本放大后的底部可达性，以及 document 级焦点处理影响别页的风险。后者改为本页根内订阅，隐藏/卸载清理，并恢复原 inline 值和 priority。负向单元覆盖其他页、隐藏与清理。

最终 B12 仅调整 CSS，script block 与上述功能验证源逐字节一致。底栏说明移到按钮上方，按钮在 390/320 下实测 342/288px、至少 48px 高；帮助行真实 uni-navigator 内层恢复同一行右侧箭头。Root 用最终组合 build 再跑受影响布局：34/34、8 图，含英文、390/200%、320/高对比/200%、busy/disabled 与最后业务卡不被底栏挡住。Root 查看普通页与 320 高对比放大后的底部图。此次未重复未受影响的全部功能测试。

所有浏览器结果均为 `SYNTHETIC_UI_BUILT_ARTIFACT`。当前源起止 SHA 稳定；真实 HTTP/Gateway/IAM、原生、真机 iPad、真实读屏和部署未验。作者矩阵中的跨页 devices 内容有两条未配置 fixture，保留 404，不算设备页通过；设置路径没有未知 API。Root 跨页首次缺 11 条既有 world GET fixture、随后缺两条带 query 的匹配，原失败保留，补精确既有 fixture 后 5/5；产品字节未因此改动。

本地完整证据在监督目录 `integration-batch-22-settings/`。复制回执、最终源清单和分层结果摘要归档在 evidence；最终页面 SHA `72a33a7ad792cc773839bd7abbd440e0225d072f0b44f272c3b8e33e12cefd71`。完整追溯继续 `TRACE_PENDING`，本次仅保存本地 UI 候选，不代表业务全链或正式设计签收，未推送/合并/部署。
