# B156 H5 会话退出改走 IAM TLS

真实 G444 复验确认：成人资格拒绝和退出返回登录均正确，服务端已撤销会话，但 HTTP Gateway 返回的清除头未删除从 HTTPS IAM 建立的分区刷新 Cookie。回执 cookie-not-cleared 保留，jarRemains=true、clearOverHttps=false；临时资源已独立确认释放。

Grok G450 将 H5 退出和当前会话撤销改用独立的 IAM TLS 客户端，携带内存 Bearer 与凭据。密码、登录和刷新仍使用无 Bearer 的 IAM 客户端；原生继续经 Gateway。认证实现和权限边界未变更。

Root 修正验证目录中跨工作树的共享包链接后，独立复跑全部 85 个移动测试文件：682/682 通过；使用默认 Maven 锁复跑 IAM 清除头测试：3/3 通过。Grok 原先因验证链接导致的 27 项失败保留在原报告，未替换为成功记录。

本单元仅证明源码与测试。新 H5 构建及真实浏览器 Cookie 清除另验，正式协议、逐页签收、原生实机和部署继续待验。

[独立回执](../evidence/ROOT-B156-H5-IAM-LOGOUT-20261108.json)
