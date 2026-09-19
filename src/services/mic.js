// 麦克风单例:通话页一进来就申请好,按住说话只创建 MediaRecorder(不再现场申请麦克风)。
// 原因:安卓 WebView 上 getUserMedia 会重新协商媒体管线,把视频画面卡住 1-3 秒(用户反馈"一按键说话就卡死")
let micPromise = null;
let micStream = null;

export function getMicStream() {
  if (!micPromise) {
    micPromise = navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => { micStream = s; return s; })
      // 失败不缓存:进通话页时的首次申请可能赶在权限弹窗确认前/被误关,
      // 一旦缓存了 rejection,之后每次按住说话都会永久失败 —— 重置后下次按住会重新触发授权
      .catch((e) => { micPromise = null; throw e; });
  }
  return micPromise;
}

export function stopMicStream() {
  micPromise = null;
  if (micStream) {
    try { micStream.getTracks().forEach((t) => t.stop()); } catch {}
    micStream = null;
  }
}
