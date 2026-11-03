# B06 截图独立复核：需修正

来源：`batch-06-root-visual-snapshot-01/`，包含四张原 PNG、当时 results.json、SHA256；模型和页面仍在继续工作，本记录不推断后续源码结果。报告虽然标 PASS，Root 不接受为设计签收。

1. `en-US-writing.png` 与 `390-writing.png` 字节 SHA 完全相同，实际文字仍中文。查明是 fixture preferences 覆盖了 UI locale、URL 解析或产品接线问题。英文状态必须断言实际 locale 与可见英文文案，内容语言仍单独保持。不能只按请求参数给图片命名。
2. `dark-offline.png` 返回箭头近黑，主按钮是深色字配紫色底，实际可读性不足。检查 uni-button 默认样式和语义前景/背景成对使用。使用既有适当语义变量；若缺配对 token，发准确请求，不能业务 CSS 硬编码白色或修改 SVG 字节。
3. `390-writing.png` 没有稿中底部“回到可用学习”CTA。检查实际 DOM、矩形、可见性/滚动范围及旧组件隐藏 CSS，不以“元素存在”当作可见或可用；以合理自适应与真实 safe area 确保可达，并重新对照稿。
4. 离线页可见 card/CTA 已有原素材，但仍需核对稿的玻璃卡、按钮的渐变/阴影、默认48px几何与整体相对位置；不要把通用实心白卡/平涂按钮近似当精确对齐。页面需按实际 OS 安全区适配，不能补假状态栏。

修后以最终源码 SHA 再跑受影响截图，避免先截图后改 CSS 而继承旧 PASS。所有 matrix 项逐条列真正已执行的 width/theme/locale/text-scale，不能将代表样例扩成全组合。原生、真实服务和读屏仍单列 NOT_RUN。前述 locale/CTA 疑点需先定位测试与产品边界，不能提前归责为产品 bug 或无证据改认证逻辑。
