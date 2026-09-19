package com.digitalhuman.call;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 云端通话的原生 ExoPlayer 播放器(WebView 里 flv.js/MSE 和录音不共存,见 ExoPlayerNativePlugin)
        registerPlugin(ExoPlayerNativePlugin.class);
        // 视频通话的 WebRTC 音频必须免手势自动播放
        // (安卓 WebView 默认要求用户手势,否则第一条回复在手机上无声)
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
    }
}
