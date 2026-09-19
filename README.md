# TimeBack Calling — AI 数字人陪伴系统

> 一款让"家人"以数字人形式继续陪伴在身边的应用:克隆她的声音、复现她的样子、模拟她的语气,支持 24 小时文字聊天与实时视频通话,并且**她会记住你说过的每一件小事**。
>
> *An AI digital-human companion app: clone her voice, recreate her face, mimic her way of speaking — 24/7 text chat, real-time video calls, and a memory that grows with every conversation.*

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-blue.svg)](#)
[![Status](https://img.shields.io/badge/Status-Production%20Delivered-brightgreen.svg)](#)

**已交付真实用户使用**(Android APK + 手机网页版),生产环境稳定运行中。项目源于一个真实的故事 ↓

---

## 项目起源

2026 年 8 月,一位用户在抖音联系到我:他的母亲确诊卵巢癌,医生判断可能撑不过当年。他希望给妈妈做一个"智能体",留一个念想——以后还能跟妈妈说说话。

我用三周时间完成了这个系统,并部署上线。它的名字叫 **TimeBack Calling**(时光回拨):时间会一直往前走,但有些声音不该消失。

## 核心功能

- 💬 **文字聊天(24 小时)** — 像发微信一样和"她"聊天,她记得你的近况、喜好和你说过的每一件事
- 📹 **视频通话(实时)** — 按住说话 → 语音识别 → AI 思考 → 克隆音色合成 → **数字人唇形同步** → 实时视频流,像真的打视频电话
- 🧠 **记忆系统** — 你说过的事实只保存在**你自己的手机本地**(IndexedDB),聊得越多,她越像"她"
- 📱 **多平台客户端** — Android App(Capacitor 8 打包)/ iOS / 浏览器网页版

## 效果(生产环境实测)

| 指标 | 数值 |
|---|---|
| 视频推流 | 720×1280,25 fps,800 kbps |
| 语音识别(ASR) | ~440 ms |
| AI 回复(LLM) | ~900 ms |
| 唇形同步 | Wav2Lip modelres 256,GPU 实时生成 |
| 网络架构 | 手机仅通过**一个端口**完成信令 + 视频流(HTTP-FLV) |
| 部署形态 | 云端 GPU 弹性调度:文字聊天仅需轻量 CPU 实例(约 40 元/月),视频按需开机 |

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
7. **成本控制** — 按真实用量实测(如 TTS 5 小时测试仅 0.28 元),设计了 GPU 按需开关机 + CPU 常驻的弹性部署方案,单客户月度服务器成本约 75 元

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

## 使用教程

### 1. 环境要求

| 场景 | 环境 |
|---|---|
| 文字聊天(最低要求) | Node.js ≥ 18(建议 20 LTS)、1~2 GiB 内存的云服务器,**无需 GPU**(约 40 元/月) |
| 视频通话(必需) | GPU 服务器:Python 3.10+、CUDA、ffmpeg。生产环境为 RTX 3090 24 GB(Wav2Lip modelres 256);小显存可降为 modelres 128 |
| 流媒体分发 | nginx-rtmp(NMS) |
| Android 打包 | JDK 21、Android Studio / Gradle |

### 2. 接入了哪些 API、用了什么模型

| 环节 | 供应商 / 接口 | 模型 | 说明 |
|---|---|---|---|
| 对话生成 | 智谱 `open.bigmodel.cn/api/paas/v4/chat/completions` | **charGLM-4 → GLM-4-Plus → GLM-4-Flash** | 三级自动降级;charGLM-4 拟人语气最像真人 |
| 人设生成 | 智谱 | GLM-4-Plus | 从历史聊天记录分析出数字人性格与口癖 |
| 语音识别(ASR) | 智谱 `/audio/transcriptions` | **GLM-ASR-2512** | 支持中文与方言,~440 ms |
| 记忆提取 | 智谱 | GLM-4-Flash | 每轮对话后提取事实,低成本 |
| 语音合成(TTS) | MiniMax `api.minimax.chat/v1/t2a_v2` | **speech-01-turbo + 克隆音色 voice_id** | 用亲人语音样本克隆出"她的声音" |
| TTS 降级 | 本地 CosyVoice / edge-tts(免费) | — | MiniMax 失败时自动切换 |
| TTS 兜底 | 设备端 `@capacitor-community/text-to-speech` | — | iOS 原生语音,离线可用 |
| 唇形同步 | [LiveTalking](https://github.com/lipku/LiveTalking)(本机 :8010) | Wav2Lip + `/humanaudio` | 合成语音喂给数字人,实时生成口型视频 |
| 视频推流 | nginx-rtmp(NMS) | RTMP → HTTP-FLV | 单端口低延迟分发 |

### 3. 申请 API Key

1. **智谱开放平台** [open.bigmodel.cn](https://open.bigmodel.cn) 注册 → 创建 API Key(LLM 与 ASR 共用一个 Key)
2. **MiniMax** [platform.minimaxi.com](https://platform.minimaxi.com) → 声音克隆(上传亲人语音样本)→ 拿到 `voice_id`
3. 配置环境变量:

```bash
cp .env.example .env
```

```ini
PORT=3000              # 服务端口,默认 3000
ZHIPU_API_KEY=...      # 必需:LLM + ASR
MINIMAX_API_KEY=...    # 可选:TTS 克隆音色
MINIMAX_VOICE_ID=...   # 可选:克隆音色 ID(填了才会走 MiniMax)
```

4. 登录账号为前端本地校验,修改 `src/pages/LoginPage.jsx` 顶部的 `VALID_USER` / `VALID_PASS` 常量即可

### 4. 部署步骤

#### A. 文字聊天(CPU 服务器即可)

```bash
npm install
cp .env.example .env     # 填入 ZHIPU_API_KEY
node server.js           # 或 pm2 start server.js --name timeback
```

浏览器打开 `http://服务器IP:3000` → 登录 → 开始聊天。此模式不依赖 GPU,成本约 40 元/月。

#### B. 视频通话(需 GPU)

1. 在 GPU 机上部署 [LiveTalking](https://github.com/lipku/LiveTalking)(Python),配置数字人形象与 Wav2Lip,启动后监听 `8010`
2. 部署 nginx-rtmp:`1935` 接收 RTMP 推流,输出 HTTP-FLV
3. Node 服务默认从 `localhost:8010` 调用 LiveTalking —— 生产建议 Node 与 LiveTalking **同机部署**;若分开部署,需修改 `websocket/callHandler.js` 与 `services/ltAvatarService.js` 中的 `LT_URL`
4. App 内发起视频通话 → 按住说话,即可看到数字人实时唇形同步的画面

#### C. Android APK 打包

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug   # 需 JDK 21
```

APK 输出于 `android/app/build/outputs/apk/`。前端开发模式:`npm run dev`。

## Roadmap

- [x] 文字聊天 + 记忆系统(v1)
- [x] 实时视频通话 + 唇形同步(v2)
- [x] Android APK 打包交付(v3)
- [ ] 视频通话画面截图与演示视频
- [ ] 语音通话(无画面)降级模式
- [ ] 多数字人管理后台

## 隐私与合规

- 本仓库**不包含任何真实用户数据**:人设、头像素材、声音克隆样本、聊天记录均已从仓库移除(人设配置请使用 `personas/mom.example.json` 模板)
- 所有 AI 服务密钥通过 `.env` 注入,严禁提交
- 用户记忆事实只保存在用户自己的设备端(IndexedDB);服务器每轮对话仅做增量事实提取 + 确定性代码合并,合并结果只用于下一轮对话上下文。聊天记录在服务端有备份(用于重新登录后恢复),不含声音克隆样本等敏感素材

## License

MIT
