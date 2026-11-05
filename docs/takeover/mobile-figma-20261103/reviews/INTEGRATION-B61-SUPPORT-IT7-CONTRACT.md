# B61 设置页客服兼容读取

将设置页现有的 `GET /api/v1/support/tickets?projection=it7` 登记为描述性兼容读取。客户端单独解析客服工作台对象。正式工单列表沿用游标响应和自身工单权限，工作台的职员字段按原有权限返回。服务缺少工作台时走既有 503。 [B59 源码调用追溯](INTEGRATION-B59-OPERATION-TRACE.md)

差异核对确认源片段和合并契约只新增同一扩展，生成客户端字节一致。契约合并、生成、校验和 M1-016 定向门禁通过。移动客服 11 项与 Admin Ops 17 项测试通过。通用契约审计的 52 项既有失败与改动前逐字一致，实际 Gateway 到客服服务的部署联调待验。 [证据](../evidence/ROOT-B61-SUPPORT-IT7-CONTRACT-20261105.json)
