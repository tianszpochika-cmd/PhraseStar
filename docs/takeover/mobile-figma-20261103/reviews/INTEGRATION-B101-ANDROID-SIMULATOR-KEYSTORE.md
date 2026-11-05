# B101 Android 模拟器 Keystore

Grok 的独立测试宿主使用 B92 安全存储的原始 Kotlin 实现。Root 使用本地 Android SDK 构建并验签测试 APK，在独立 Android API 36 模拟器开启飞行模式，使用三次冷启动测试系统 Keystore 和应用私有存储。 [Android Keystore](https://developer.android.com/privacy-and-security/keystore)

- 写入阶段拒绝错误键、空值和超长值。密文替换后内容变化，容器头正确，文件无合成明文或残留临时文件。JCA 读不到密钥编码或格式。
- 新进程读回替换后的值并删除私有文件。再次启动后读回空值。收据只保存状态和断言。
- 首次 ADB 显式主机名绑定失败，临时 AVD 清理后改用经核对的默认环回绑定，三阶段均通过。两个临时 AVD、测试调试进程和签名私钥已清理，原有 AVD 保留。DCloud 正式安装宿主、硬件密钥能力、实机与部署继续验收。 [审核回执](../evidence/ROOT-B101-ANDROID-SIMULATOR-KEYSTORE-20261106.json)
