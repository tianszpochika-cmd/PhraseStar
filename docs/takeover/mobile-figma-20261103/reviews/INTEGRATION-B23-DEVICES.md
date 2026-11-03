# 设备与会话组合审核 B23

设备页已按 Figma 原素材与布局加入本轮隔离集成树。保留 IAM 真实列表、当前设备保护、退出确认、受理后读回、部分退出及恢复；不将 POST 受理写成已退出。Root 只复制作者冻结字节。

最终 32 文件：页面、专属测试、双语资源、29 个原素材。最终页面 SHA `7344e9fc373147a63d8942f789949a4850f492e8bb944a8d1849c54d9fec2b8d`。来源为 DSH B12 原布局与 B15 两处错误文案修复；共享 Token128、Header、当前中央文案和其他已整合页面保持原字节，API/domain/session/navigation 与设备原基线一致。完整来源见 [源码清单](../evidence/B23-DEVICES-SOURCE-MANIFEST.json)。

已审行为包括：取消确认零 POST、初始焦点 Cancel、焦点圈/Tab/ESC 恢复、busy 锁、单个退出后仍 ACTIVE 不冒成功、missing/REVOKED 才确认、批量部分完成、读回失败后仅 GET 刷新、401/403 明确安全分流，以及身份/epoch/onHide 丢弃迟到响应。

Root 当前最终源验证为 **41/41 源码测试、mobile/i18n 类型、H5 build exit0**。独立英文500错误浏览器 1场景26检查通过并实际看图，英文标题、错误说明和 Try again 一致。原失败截图保留：早先页面直接显示 API 的中文 Error.message，DSH 已将加载/退出失败转本页 locale；另一个 retryVisible=false 是观察器只认中文，已单独修正。

在上述两处文案修改之前，同一集成组合完成18场景247核心检查，以及5场景131共享影响检查（320、暗色确认、HC、英文、200%）。它们绑定前一页面 SHA `15abbb…`；没有把旧源检查改写成最终源的新全量结果。最终语义测试新增4个错误语言/未知拒绝/POST不重放案例，样式与请求顺序未变。作者 B16 的额外英文交互浏览器仍执行中，未预填结果。

Root 已看320列表、HC部分退出及最终英文错误图。作者历史设计覆盖为21个可复现、2个部分、1个契约不能表达；EXPIRED 独立设备枚举不存在，不捏造它。真实 IAM/Gateway、原生和真机 iPad、系统键盘、读屏、部署和完整需求追溯仍未签收。本次状态为 `REVIEWED_LOCAL_UI_CANDIDATE_TRACE_PENDING`，未推送远端；整体项目仍 IN_PROGRESS。
