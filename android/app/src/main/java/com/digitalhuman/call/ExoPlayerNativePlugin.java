package com.digitalhuman.call;

import android.graphics.Color;
import android.view.TextureView;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.ProgressiveMediaSource;
import androidx.media3.ui.AspectRatioFrameLayout;

// 云端视频通话的原生播放器:ExoPlayer 直接拉 HTTP-FLV(/live/livestream.flv),
// 解码走安卓系统媒体管线 —— 手机 WebView 里 flv.js(MSE)和网页内录音不能共存
// (2026-09-06 用户实测视频永久冻死),原生播放器和录音各走各的管线,没有冲突。
// FLV 是流式容器(编码完即发),稳态延迟 ~0.5-1 秒;LT 推流每 1 秒一个关键帧。
@CapacitorPlugin(name = "ExoPlayerNative")
public class ExoPlayerNativePlugin extends Plugin {
    private ExoPlayer player = null;
    private AspectRatioFrameLayout videoView = null;

    @PluginMethod
    public void start(PluginCall call) {
        stopInternal();
        String url = call.getString("url", "");
        if (url.isEmpty()) { call.reject("url required"); return; }
        try {
            // 直播小缓冲:min 300ms / max 1.5s,压低稳态延迟
            DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                    .setBufferDurationsMs(300, 1500, 500, 800)
                    .build();
            player = new ExoPlayer.Builder(getActivity())
                    .setLoadControl(loadControl)
                    .build();
            // 不申请音频焦点:通话中录音与播放并行,焦点切换会互相打断
            player.setAudioAttributes(
                    new AudioAttributes.Builder()
                            .setUsage(C.USAGE_MEDIA)
                            .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                            .build(),
                    false);
            DefaultHttpDataSource.Factory dsFactory = new DefaultHttpDataSource.Factory()
                    .setConnectTimeoutMs(5000)
                    .setReadTimeoutMs(15000)
                    .setAllowCrossProtocolRedirects(true);
            MediaItem item = new MediaItem.Builder()
                    .setUri(url)
                    .setLiveConfiguration(new MediaItem.LiveConfiguration.Builder()
                            .setTargetOffsetMs(800)
                            .setMinPlaybackSpeed(1.0f)
                            .setMaxPlaybackSpeed(1.0f) // 锁 1x:变速追赶会打乱数字人口型节奏
                            .build())
                    .build();
            ProgressiveMediaSource source = new ProgressiveMediaSource.Factory(dsFactory).createMediaSource(item);
            player.setMediaSource(source);
            player.setVolume(1f);
            player.addListener(new Player.Listener() {
                @Override
                public void onPlaybackStateChanged(int state) {
                    if (state == Player.STATE_READY) notifyListeners("playing", new JSObject());
                }
                @Override
                public void onPlayerError(PlaybackException error) {
                    JSObject d = new JSObject();
                    d.put("message", String.valueOf(error.getErrorCodeName()));
                    notifyListeners("error", d);
                }
            });
            player.prepare();
            player.play();

            // 视图垫在 WebView 之下(addView index 0)+ WebView 背景设透明:
            // 视频铺满全屏,WebView 里的挂断/说话按钮、前置小窗照常浮在视频上面(微信通话式布局)。
            // 必须 TextureView —— SurfaceView 是独立窗口层,叠放顺序在各家 ROM 上不一致
            TextureView textureView = new TextureView(getContext());
            videoView = new AspectRatioFrameLayout(getContext());
            videoView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FILL);
            videoView.setBackgroundColor(Color.BLACK);
            videoView.addView(textureView, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            player.setVideoTextureView(textureView);
            getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
            ViewGroup parent = (ViewGroup) getBridge().getWebView().getParent();
            parent.addView(videoView, 0, new ViewGroup.MarginLayoutParams(0, 0));
            call.resolve();
        } catch (Exception e) {
            call.reject("start failed: " + e.getMessage(), e);
            JSObject d = new JSObject();
            d.put("message", String.valueOf(e.getMessage()));
            notifyListeners("error", d);
        }
    }

    // JS 按物理像素传视频槽位的位置大小(避开挂断/说话按钮,按钮留在 WebView 里可点)
    @PluginMethod
    public void setRect(PluginCall call) {
        int x = call.getInt("x", 0);
        int y = call.getInt("y", 0);
        int w = call.getInt("w", 0);
        int h = call.getInt("h", 0);
        if (videoView != null) {
            ViewGroup.MarginLayoutParams lp = new ViewGroup.MarginLayoutParams(w, h);
            lp.setMargins(x, y, 0, 0);
            videoView.setLayoutParams(lp);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopInternal();
        call.resolve();
    }

    private void stopInternal() {
        try {
            if (videoView != null) {
                ViewGroup parent = (ViewGroup) videoView.getParent();
                if (parent != null) parent.removeView(videoView);
                videoView = null;
            }
        } catch (Exception ignored) {}
        try {
            if (player != null) { player.release(); }
        } catch (Exception ignored) {}
        player = null;
        // WebView 恢复不透明,否则离开通话页后整页透出 Activity 底色
        try { getBridge().getWebView().setBackgroundColor(Color.WHITE); } catch (Exception ignored) {}
    }

    @Override
    protected void handleOnDestroy() {
        stopInternal();
        super.handleOnDestroy();
    }
}
