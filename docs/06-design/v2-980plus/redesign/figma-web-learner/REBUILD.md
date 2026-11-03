# v3重建方式

默认生成HOLD快照（不调用Figma/浏览器、不写repo/D根文件）：

`python3 build-publication-candidate-v3.py --output-dir /Users/Admin/.codex/visualizations/2026/11/03/web-learner-business-coverage/publication-candidate-v3`

实际恢复与完整fresh读回齐全并由root逐项审查接受后，建议另建目录保留HOLD原件：

`python3 build-publication-candidate-v3.py --output-dir /Users/Admin/.codex/visualizations/2026/11/03/web-learner-business-coverage/publication-candidate-v3-recovered --auth-recovery-receipt <D内实际恢复结果.json> --auth-recovery-readback <D内实际fresh读回.json> --auth-recovery-accepted`

可重复传--auth-recovery-readback。未给齐、任何actualerrors/partialrollback，或没有root明确accepted参数，均保留HOLD。该参数不是按模型/文件名自动验收，也不升级291语义状态。

只吸收Source19正式plan中有匹配实际成功回执/依赖的批，不能吸收READY。若后续另增主体，用新候选脚本明确加actualreceipt后调整--expected-root-count，不能仅改数字。--repo-root默认当前隔离worktree，源16SHA漂移即停止。
