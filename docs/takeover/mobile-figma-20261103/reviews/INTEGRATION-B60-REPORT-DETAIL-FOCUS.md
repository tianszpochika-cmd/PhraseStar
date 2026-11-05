# B60 错题详情焦点保护

Grok 核对 `/api/v1/mastery/mistakes/{mistakeId}` 和 `/api/v1/learning/repairs/{repairId}`。两条地址均缺精确网关转发及学习服务处理器。两项进程内 Gateway 测试通过，保留未获准路由的拒绝。旧错题列表的 `OPEN/REVIEW` 也不符合移动端已声明的枚举，需学习服务按实际记录处理。 [调用追溯](INTEGRATION-B59-OPERATION-TRACE.md)

本批仅修正 MB-016 弹层打开时的焦点保护。有浏览器 DOM 时，关闭按钮仍接收焦点。无 DOM 时，弹层继续进入原有请求和失败处理，避免在请求前抛错并停留在加载状态。13 项定向源码测试、移动端类型、H5 与 App 源码构建通过。实际服务、候选 H5 的 MB-016 浏览器交互、原生运行与实机待验。 [证据](../evidence/ROOT-B60-REPORT-DETAIL-FOCUS-20261105.json)
