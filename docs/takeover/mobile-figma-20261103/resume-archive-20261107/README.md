# 2026-11-07 额度预留恢复材料

本标签保留已结束作业的探针、真实／失败回执、依赖候选及契约审计，不提升任何未验功能。主线成果见 dev 的 RESERVE-CLOSE-20261107.md。

`pending/dependencies-432/BASE.json` 指向原基线 f69fd71f。恢复其中六个 files，核对 PATCH.diff 后，使用独立 node_modules 完成构建；37→1 是锁文件漏洞审计结果，构建尚未运行。`pending/dependencies-432-reports` 保存注册表、审计与报告。

`pending/ci-audit-436` 保存 26 个失败／10 个原因的计划。`pending/forbidden-435-prepared` 为未运行的新版页面探针。`probes` 为各冻结输入，`runtime-records` 为当时的真实结果，FAIL 原样保留。

跨电脑先重建服务与 H5，再按来源核对摘要和固定端口。CLI 会话与二进制运行目录不自动迁移；本标签不包含凭据、临时账号输入、服务日志、node_modules、运行中 scratch 或生产密钥。避免重播已执行的合成业务写入。
