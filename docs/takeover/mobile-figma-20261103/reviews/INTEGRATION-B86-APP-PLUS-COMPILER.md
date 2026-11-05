# App-Plus 平台资源构建 B86

2026-11-06。复跑旧命令后确认，三文件产物是 H5 形态。uni-app 编译器按项目依赖识别目标平台。移动端现固定同一 DCloud 版本的 `@dcloudio/uni-app-plus`，锁文件只新增该依赖及其解析条目。[官方 Vue 3 模板](https://raw.githubusercontent.com/dcloudio/uni-preset-vue/vite/package.json)

- `pnpm --filter @englishflow/mobile build:app` 输出 744 个 App-Plus 资源。逐文件摘要、原生 manifest、脚本语法和 33 条路由的页面脚本及样式通过核对。两次同工作树构建的资源摘要一致。
- 默认冻结锁文件安装、H5 构建与 TypeScript 检查通过。Root 复验 662 项源码测试及冻结 H5 的 43 个离线浏览器场景，留存 23 图。当前 H5 首页文件 SHA-256 为 `983d33d4c7bb6ae8a9586970790d906f795ebc4cfe640c0c18166cac3837de73`。
- APK、IPA、模拟器安装宿主、iOS／Android／iPad 运行、Keychain／Keystore、读屏和部署待验。App 资源供原生宿主打包，安装验收分别记录。[构建说明](https://uniapp.dcloud.net.cn/worktile/CLI.html) · [审核回执](../evidence/ROOT-B86-APP-PLUS-COMPILER-20261106.json)
