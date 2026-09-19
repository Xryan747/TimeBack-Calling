# TimeBack Calling — AI 数字人陪伴系统

> 一款让"家人"以数字人形式继续陪伴在身边的应用:克隆她的声音、复现她的样子、模拟她的语气,支持 24 小时文字聊天与实时视频通话,并且**她会记住你说过的每一件小事**。

**已交付真实用户使用**(Android APK + 手机网页版)。项目源于一个真实的故事 ↓

---

## 项目起源

2026 年 8 月,一位用户在抖音联系到我:他的母亲确诊卵巢癌,医生判断可能撑不过当年。他希望给妈妈做一个"智能体",留一个念想——以后还能跟妈妈说说话。

我用三周时间完成了这个系统,并部署上线。它的名字叫 **Timeback Calling**(时光回拨):时间会一直往前走,但有些声音不该消失。

## 它是什么

- **文字聊天(24 小时)**:像发微信一样和"她"聊天,她记得你的近况、喜好和你说过的每一件事
- **视频通话(实时)**:按住说话 → 语音识别 → AI 思考 → 克隆音色合成 → **数字人唇形同步** → 实时视频流,像真的打视频电话
- **记忆系统**:你说过的事实只保存在**你自己的手机本地**,聊得越多,她越像"她"
- **多平台客户端**:Android App(Capacitor 8 打包)/ iOS / 浏览器

## 效果(生产环境实测)

| 指标 | 数值 |
|---|---|
| 视频推流 | 720×1280,25 fps,800 kbps |
| 语音识别(ASR) | ~440 ms |
| AI 回复(LLM) | ~900 ms |
| 唇形同步 | Wav2Lip modelres 256,GPU 实时生成 |
| 链路 | 手机仅通过**一个端口**完成信令 + 视频流(HTTP-FLV) |

## 系统架构

```
┌──────────────┐   WebSocket / HTTPS    ┌─────────────────────────────┐
│  手机 App     │ ──────────────────────▶ │  Node.js 服务 (:3001)          │
│  React +     │ ◀────────────────────── │  · Express + WebSocket          │
│  Capacitor   │   HTTP-FLV 视频流        │  · 聊天路由 / 通话信令           │
└──────────────┘                         │  · 静态页面 + FLV 转发           │
                                         └───────┬──────────────┬────────┘
                                                 │              │
                                    语音/任务下发 │              │ RTMP 推流
                                                 ▼              ▼
                              ┌──────────────────────┐   ┌──────────────────┐
                              │ LiveTalking + Wav2Lip │──▶│ NMS (nginx-rtmp)  │
                              │ 数字人推理 (GPU, :8010) │   │ :1935 收流 :8080  │
                              └──────────────────────┘   │ 输出 HTTP-FLV    │
                                                         └──────────────────┘

云端 AI 服务:智谱 GLM(LLM + ASR)、MiniMax(TTS + 声音克隆)
```

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + Vite、Capacitor 8(Android/iOS 打包) |
| 后端 | Node.js、Express、WebSocket |
| 数字人 | [LiveTalking](https://github.com/lipku/LiveTalking) + [Wav2Lip](https://github.com/Rudrabha/Wav2Lip) |
| 流媒体 | nginx-rtmp(NMS),RTMP 收流 → HTTP-FLV 分发 |
| AI 服务 | 智谱 GLM(charGLM-4 / GLM-4-Plus / GLM-ASR-2512)、MiniMax(TTS + 声音克隆) |

## 核心难点与设计

1. **实时唇形同步推流** — Wav2Lip 在 GPU 上以 25fps 实时生成口型视频,ffmpeg 封装 RTMP 推流;解决了推流启动顺序死锁(先写视频帧再开音频)、孤儿 ffmpeg 进程污染等流媒体工程问题
2. **单端口架构** — 公网网关只透一个端口:信令、静态资源、HTTP-FLV 视频流全部收敛到 Node 服务,绕过 WebRTC 在 NAT/网关环境下的不可用问题
3. **"只回应真实说话"** — 静音检测(rms 阈值)+ 短按误触过滤 + 空转写丢弃,保证数字人不会"自言自语",这是陪伴场景的体验底线
4. **记忆系统的隐私设计** — 用户隐私事实只存**手机本地 IndexedDB**,服务器每轮对话只做增量事实提取(轻量模型),并采用**确定性代码合并**而非 LLM 合并(实测 LLM 合并会丢记忆、把数字人自己的话误记为用户的话)。服务器零用户数据落库
5. **服务降级链** — LLM:charGLM-4 → GLM-4-Plus → GLM-4-Flash;TTS:MiniMax 克隆音色 → edge-tts → 设备端 TTS,任何环节失败都不中断对话
6. **移动端工程化** — Capacitor 8 要求 JDK 21、混合内容放行、自动播放策略、权限申请时序等 Android 踩坑全链路打通,APK 直装交付

## 目录结构

```
├── server.js              # 服务入口(Express + WebSocket + 静态托管 + FLV 转发)
├── routes/                # HTTP 路由(聊天、头像、人设等)
├── websocket/             # WebSocket 处理(文字聊天 / 视频通话信令)
├── services/              # LLM、ASR、TTS、记忆提取、数字人等服务封装
├── voice/                 # TTS 多供应商抽象(MiniMax / CosyVoice / 降级链)
├── src/                   # React 前端(聊天页、通话页、设置等)
├── public/                # 静态资源与 PWA manifest
├── android/ ios/          # Capacitor 原生工程
├── personas/              # 数字人人设配置(模板见 mom.example.json)
└── db/                    # SQLite 封装(仅运行元数据,不含用户聊天数据)
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量(参考 .env.example)
cp .env.example .env   # 填入智谱 API Key 等

# 3. 启动服务(文字聊天即可用)
node server.js

# 4. 视频通话需另外部署 LiveTalking + nginx-rtmp
#    参考 https://github.com/lipku/LiveTalking
```

前端开发:`npm run dev`;Android 打包:`npm run build && npx cap sync android`,然后使用 Gradle 构建(需 JDK 21)。

## 隐私与合规

- 本仓库**不包含任何真实用户数据**:人设、头像素材、声音克隆样本、聊天记录均已从仓库移除(人设配置请使用 `personas/mom.example.json` 模板)
- 所有 AI 服务密钥通过 `.env` 注入,严禁提交
- 项目中的用户记忆仅存在于用户自己的设备端,服务器不持久化聊天内容

## License

MIT
