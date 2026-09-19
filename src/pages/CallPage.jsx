import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HangupButton from '../components/HangupButton';
import HoldToTalk from '../components/HoldToTalk';
import { getWsUrl, getServerUrl, getLtUrl } from '../services/config';
import { getPersona } from '../services/api';
import { getFacts, replaceFacts } from '../services/factStore';
import { getMicStream, stopMicStream } from '../services/mic';
import Icon from '../components/Icon';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';

const ExoPlayerNative = registerPlugin('ExoPlayerNative');

function encodeWav(ab) {
  // 16kHz mono — 文件更小，智谱 ASR 处理更快（48k 无必要）
  const s=ab.getChannelData(0),step=ab.sampleRate/16000,n=Math.floor(s.length/step);
  const b=new ArrayBuffer(44+n*2),v=new DataView(b);
  v.setUint32(0,0x52494646,false);v.setUint32(4,36+n*2,true);v.setUint32(8,0x57415645,false);v.setUint32(12,0x666D7420,false);
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);
  v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(36,0x64617461,false);v.setUint32(40,n*2,true);
  for(let i=0,o=44;i<n;i++,o+=2)v.setInt16(o,Math.max(-32768,Math.min(32767,s[Math.floor(i*step)]*32767)),true);
  return new Blob([b],{type:'audio/wav'});
}

// Module-level — never recreated on React remounts
let globalWs = null;
let globalWsPersonaId = null;
let globalPc = null;
let pendingLtSession = null; // iframe 可能比 ws 先加载好,会话号先存着,ws 一连上就补发

// 云端模式(VITE_CLOUD_MODE=1 构建):视频走 FLV 直播流(player.html),不走 WebRTC;
// LT rtmp 模式只有一个硬编码会话 '0',start_call 后直接把 '0' 发给服务器
const CLOUD = (import.meta.env.VITE_CLOUD_MODE || '') === '1';
// 安卓/苹果 App 内(原生 WebView):视频流可以直接有声自动播放
// (MainActivity 已关掉 user-gesture 限制;手机浏览器才需要"点一下开声音")
const NATIVE = Capacitor.isNativePlatform();
// 云 APK 内:视频改用 ExoPlayer 原生播放器(系统媒体管线,和网页内录音共存,
// flv.js/MSE 在手机 WebView 里和录音不共存会冻死视频 —— 2026-09-06 实测)。
// 只有 CLOUD && NATIVE 走插件;桌面/手机浏览器仍走 iframe(player.html 按 UA 分流)。
const USE_NATIVE_PLAYER = CLOUD && NATIVE;
// 手机浏览器/WebView 的前置摄像头预览默认是镜像的(自拍视角)——用户要"跟普通相机一样",
// 即和对方看到的一致,所以手机端把预览反转回来(桌面 Chrome 本来就不镜像,不用动)
const SELF_MIRROR = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const sendLtSession0 = () => {
  if (CLOUD && globalWs?.readyState === 1) {
    globalWs.send(JSON.stringify({ type: 'lt_session', sessionId: '0' }));
    console.log('[LT] Cloud mode — session 0 linked');
  }
};

export default function CallPage() {
  const { id }=useParams();const navigate=useNavigate();
  const remoteVid=useRef(null);const localVid=useRef(null);
  const wsRef=useRef(null);const pcRef=useRef(null);
  const sdRef=useRef(null);
  const recRef=useRef(null);const recMimeRef=useRef('');const recHeaderRef=useRef(null);const recChunksRef=useRef([]);
  const audioCtxRef=useRef(null);

  const [persona,setPersona]=useState(null);
  const [localS,setLocalS]=useState(null);
  const [dial,setDial]=useState('connecting');const [vReady,setVReady]=useState(false);
  const [asrBusy,setAsrBusy]=useState(false);
  const [nativeFailed,setNativeFailed]=useState(false);
  const slotRef=useRef(null);

  useEffect(()=>{getPersona(id).then(p=>setPersona(p)).catch(()=>{});},[id]);
  useEffect(()=>{const t=setTimeout(()=>setDial('connected'),800);return()=>clearTimeout(t);},[]);

  // 视频通话中禁止返回(安卓返回键/手势侧滑都不退出),只能点挂断按钮
  useEffect(()=>{
    let listener;
    try { listener = CapApp.addListener('backButton', () => { console.log('[Call] back blocked'); }); } catch {}
    return () => { try { listener?.remove?.(); } catch {} };
  }, []);

  // 云 APK:ExoPlayer 原生播放器。视图盖在 WebView 之上的槽位区域,
  // 挂断/说话按钮留在 WebView 里(原生视图避让底部 210px,按钮才能点);
  // 播放器报错 → 回退 iframe(player.html 手机 UA 走 HLS,仍与录音共存)
  useEffect(()=>{
    if(!USE_NATIVE_PLAYER) return;
    let evHandle=null, ro=null;
    const syncRect=()=>{
      const el=slotRef.current;
      if(!el) return;
      const r=el.getBoundingClientRect();
      const dpr=window.devicePixelRatio||1;
      try{ExoPlayerNative.setRect({x:Math.round(r.left*dpr),y:Math.round(r.top*dpr),w:Math.round(r.width*dpr),h:Math.round(r.height*dpr)});}catch{}
    };
    const start=async()=>{
      try{
        await ExoPlayerNative.start({url:`${getServerUrl()}/live/livestream.flv`});
        syncRect();
        window.addEventListener('resize',syncRect);
        window.addEventListener('orientationchange',syncRect);
        if(window.visualViewport) window.visualViewport.addEventListener('resize',syncRect);
        if(window.ResizeObserver&&slotRef.current){ro=new ResizeObserver(syncRect);ro.observe(slotRef.current);}
      }catch(e){console.warn('[Exo] start failed:',e?.message||e);setNativeFailed(true);}
    };
    try{evHandle=ExoPlayerNative.addListener('error',()=>{console.warn('[Exo] player error — fallback to iframe');setNativeFailed(true);});}catch{}
    start();
    return()=>{
      window.removeEventListener('resize',syncRect);
      window.removeEventListener('orientationchange',syncRect);
      if(window.visualViewport) window.visualViewport.removeEventListener('resize',syncRect);
      try{ro?.disconnect();}catch{}
      try{evHandle?.remove?.();}catch{}
      try{ExoPlayerNative.stop();}catch{}
    };
  },[]);
  // 云 APK:body 背景透掉让底下的原生视频透出来(播放器回退 iframe 时恢复不透明)
  useEffect(()=>{
    if(!USE_NATIVE_PLAYER) return;
    const prev=document.body.style.background;
    if(!nativeFailed) document.body.style.background='transparent';
    return()=>{document.body.style.background=prev;};
  },[nativeFailed]);

  // Listen for LiveTalking session ID from iframe — forwarded to server so it can push audio
  useEffect(()=>{
    const sendSession = () => {
      if (pendingLtSession != null && wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: 'lt_session', sessionId: pendingLtSession }));
        console.log('[LT] Session sent to server:', pendingLtSession);
      }
    };
    const handler = (e) => {
      if (e.data?.type === 'lt_session' && e.data?.sessionId) {
        pendingLtSession = e.data.sessionId;
        console.log('[LT] Got session:', e.data.sessionId);
        sendSession();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // WebSocket — module-level, survives React remounts
  useEffect(()=>{
    if (globalWs && globalWs.readyState === 1 && globalWsPersonaId === id) {
      wsRef.current = globalWs;
      // 复用已有连接也要重新初始化服务端会话(否则回复会发到上一次通话残留的 LT 会话)
      const restart = (facts) => {
        const payload = { type: 'start_call', personaId: id };
        if (facts) payload.facts = facts;
        try { globalWs.send(JSON.stringify(payload)); } catch {}
        sendLtSession0();
      };
      getFacts(id).then(restart).catch(() => restart());
      return;
    }
    if (globalWs) { try { globalWs.close(); } catch {} }
    const ws = new WebSocket(getWsUrl()); globalWs = ws; globalWsPersonaId = id; wsRef.current = ws;
    ws.onopen = () => {
      // Carry this device's memory (facts) into the call — mom remembers chat-learned things too
      const start = (facts) => {
        const payload = { type: 'start_call', personaId: id };
        if (facts) payload.facts = facts;
        if (wsRef.current?.readyState === 1) {
          wsRef.current.send(JSON.stringify(payload));
          // iframe 先加载好的话,补发 LiveTalking 会话号(回复音频才会进视频流)
          if (pendingLtSession != null) {
            wsRef.current.send(JSON.stringify({ type: 'lt_session', sessionId: pendingLtSession }));
            console.log('[LT] Session resent on ws open:', pendingLtSession);
          }
          sendLtSession0();
        }
      };
      getFacts(id).then(start).catch(() => start());
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      console.log('[WS] msg:', m.type, m.data?.streamData ? '(has stream)' : '');
      if (m.type === 'call_connected') {
        setPersona(m.data.persona);
        sdRef.current = m.data.streamData;
      }
      if (m.type === 'ai_text') {
        console.log('[App] ai_text (audio delivered server-side):', m.data.text.slice(0, 30));
      }
      if (m.type === 'ai_audio') {
        // MiniMax audio disabled — LiveTalking handles audio+video via WebRTC
      }
      if (m.type === 'fallback_tts') TextToSpeech.speak({ text: m.data.text, lang: 'zh-CN', rate: 0.75, pitch: 0.7, volume: 1.0, voice: 'Ting-Ting' }).catch(() => {});
      if (m.type === 'call_new_facts') {
        // Call turns extract memories too — adopt the merged list into the phone-local DB
        if (Array.isArray(m.data?.facts)) replaceFacts(id, m.data.facts).catch(() => {});
      }
    };
  }, [id]);

  // WebRTC — trigger on both dial and sdRef change
  const sd = sdRef.current;
  useEffect(()=>{
    console.log('[WebRTC] dial:', dial, 'sd:', !!sd, 'offer:', !!sd?.offer);
    if(dial!=='connected'||!sd||!sd.offer) return;
    setTimeout(()=>{
      console.log('[WebRTC] Setting up with', sd.iceServers?.length||0, 'ICE servers');
      const pc=new RTCPeerConnection({iceServers:sd.iceServers||[]});
      pcRef.current=globalPc=pc;
      pc.ontrack=(e)=>{console.log('[WebRTC] Track!');if(remoteVid.current&&e.streams[0]){remoteVid.current.srcObject=e.streams[0];setVReady(true);}};
      pc.onicecandidate=(e)=>{if(e.candidate){console.log('[WebRTC] ICE');if(globalWs?.readyState===1)globalWs.send(JSON.stringify({type:'did_ice_candidate',candidate:e.candidate}));}};
      pc.onconnectionstatechange=()=>console.log('[WebRTC]',pc.connectionState);
      pc.setRemoteDescription(new RTCSessionDescription(sd.offer))
        .then(()=>pc.createAnswer()).then(a=>{pc.setLocalDescription(a);console.log('[WebRTC] Sending SDP answer');if(globalWs?.readyState===1)globalWs.send(JSON.stringify({type:'did_sdp_answer',answer:a}));})
        .catch(e=>console.warn('[WebRTC] Error:',e));
    },300);
  },[dial, sd]);

  useEffect(()=>{(async()=>{try{const s=await navigator.mediaDevices.getUserMedia({video:{width:240,height:320,facingMode:'user'}});if(localVid.current)localVid.current.srcObject=s;setLocalS(s);if(localVid.current)localVid.current.play().catch(()=>{});}catch{}})();return()=>{if(localS)localS.getTracks().forEach(t=>t.stop());};},[]);
  // 进通话页就把麦克风+录音管线全开好:安卓 WebView 上"按下才启动录音采集"会触发媒体管线重新协商,
  // 把正在播的视频冻死且不恢复 —— 所以录音从进页就常开,只在内存里滚 15 秒环形缓冲,
  // 按说话只做时间标记(不碰媒体),松开时截取标记之后的音频去识别
  useEffect(()=>{
    let disposed=false;
    (async()=>{
      try{
        const s=await getMicStream();
        if(disposed) return;
        const mimeType=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/aac']
          .find((t)=>MediaRecorder.isTypeSupported(t))||'';
        const mr=mimeType?new MediaRecorder(s,{mimeType}):new MediaRecorder(s);
        recMimeRef.current=mimeType;
        recHeaderRef.current=null;
        recChunksRef.current=[];
        mr.ondataavailable=(e)=>{
          if(!e.data||e.data.size===0) return;
          if(recHeaderRef.current===null) recHeaderRef.current=e.data; // 第一个分片带容器头,拼装时必须放在最前
          recChunksRef.current.push({t:Date.now(),c:e.data});
          if(recChunksRef.current.length>30) recChunksRef.current.shift(); // 只留最近 15 秒
        };
        mr.onerror=(e)=>console.warn('[Rec] recorder error:', e?.error||e);
        mr.start(500);
        recRef.current=mr;
        // AudioContext 也只建一次:松开时新建会抢音频管线同样冻视频;只解码不输出,建好挂着几乎不耗资源
        try{audioCtxRef.current=new AudioContext();}catch{}
      }catch(e){console.warn('[Rec] start failed:', e?.message);}
    })();
    return ()=>{
      disposed=true;
      try{recRef.current?.stop();}catch{}
      recRef.current=null;
      try{audioCtxRef.current?.close();audioCtxRef.current=null;}catch{}
    };
  },[]);
  const sendText=useCallback((t)=>{if(!t.trim())return;if(wsRef.current?.readyState===1)wsRef.current.send(JSON.stringify({type:'user_speech',text:t.trim()}));},[]);

  const processAudio=useCallback(async(blob)=>{setAsrBusy(true);try{
    console.log('[ASR] blob size:', blob.size, blob.type);
    const ctx=audioCtxRef.current||(audioCtxRef.current=new AudioContext());
    const ab=await blob.arrayBuffer();const buf=await ctx.decodeAudioData(ab);const wav=encodeWav(buf);
    // 静音检测:按住说话但没出声 → 不送 ASR(防止识别幻觉)。
    // 规则:只有识别到真的说了话,数字人才会回复 —— 静音/空识别一律不发任何消息
    const ch=buf.getChannelData(0);let sum=0;for(let i=0;i<ch.length;i++)sum+=ch[i]*ch[i];
    const rms=Math.sqrt(sum/ch.length);
    if(rms<0.02){console.log('[ASR] silence, rms='+rms.toFixed(4)+' — ignored');setAsrBusy(false);return;}
    const f=new FormData();f.append('audio',wav,'s.wav');
    const tAsr=Date.now();
    const r=await fetch(`${getServerUrl()}/api/asr`,{method:'POST',body:f});
    if(!r.ok){ alert('语音识别请求失败: HTTP '+r.status); setAsrBusy(false); return; }
    const d=await r.json();
    console.log('[Perf] ASR', Date.now()-tAsr, 'ms');
    console.log('[ASR] result:', d?.data?.text);
    if(d.success&&d.data.text)sendText(d.data.text);
    else if(!d.success) alert('语音识别失败: '+(d.error||'未知错误'));
    else { console.log('[ASR] empty text (no speech recognized) — ignored'); }
  }catch(e){ console.error('[ASR] error:', e); alert('录音处理失败: '+(e?.name||e?.message||e)); }setAsrBusy(false);},[sendText]);

  // 手机浏览器禁止带声音自动播放——第一次触摸屏幕时通知 iframe 取消静音
  const unmuteLt=()=>{try{document.getElementById('lt-iframe')?.contentWindow?.postMessage({type:'lt_unmute'},'*');}catch{}};
  // 按说话:只标记时间 + 通知 iframe 开声音;松开:截取缓冲里标记之后的音频送识别
  const pressStartRef=useRef(0);
  const onTalkPress=useCallback(()=>{pressStartRef.current=Date.now();unmuteLt();},[]);
  const onTalkRelease=useCallback(()=>{
    const held=Date.now()-pressStartRef.current;
    if(held<500){console.log('[Rec] held <500ms — dropped as accidental touch');return;}
    const mr=recRef.current;
    if(!mr||mr.state!=='recording') return;
    const since=pressStartRef.current-300;
    const parts=recChunksRef.current.filter(c=>c.t>=since).map(c=>c.c);
    const header=recHeaderRef.current;
    const blob=new Blob(header?[header,...parts]:parts,{type:recMimeRef.current||undefined});
    if(blob.size>1000) processAudio(blob);
  },[processAudio]);

  function hangup(){if(wsRef.current){try{wsRef.current.send(JSON.stringify({type:'stop_call'}));}catch{}wsRef.current.close();}if(pcRef.current)pcRef.current.close();if(localS)localS.getTracks().forEach(t=>t.stop());try{recRef.current?.stop();}catch{}try{audioCtxRef.current?.close();audioCtxRef.current=null;}catch{}stopMicStream();navigate(`/chat/${id}`, { replace: true });}

  if(dial!=='connected')return(
    <div style={S.dial}><div style={S.dw}>{persona?.photoUrl?<img src={persona.photoUrl} style={S.dp}/>:<div style={S.dph}><Icon name="user" size={48} color="#666" /></div>}<div style={S.r1}/><div style={S.r2}/></div><h2 style={S.dn}>{persona?.name||''}</h2><p style={S.ds}>正在呼叫...</p><button onClick={hangup} style={S.dc}>取消</button></div>
  );

  return(<div style={{...S.page, ...(USE_NATIVE_PLAYER&&!nativeFailed ? { background: 'transparent' } : {})}} onPointerDown={unmuteLt}>
    {USE_NATIVE_PLAYER&&!nativeFailed ? (
      // 原生播放器槽位:插件把 ExoPlayer 视图垫在 WebView 之下(全屏),
      // 页面/WebView 背景透掉后视频透出;小窗和按钮在 WebView 层照常浮在视频上
      <div id="lt-native-slot" ref={slotRef} style={{position:'absolute',left:0,right:0,top:0,bottom:0,zIndex:5}}/>
    ) : (
      <iframe id="lt-iframe" src={CLOUD ? `${getServerUrl()}/player.html?v=1${NATIVE?'&unmute=1':''}` : `${getLtUrl()}video_only.html?v=3&avatar=${encodeURIComponent(persona?.ltAvatarId || '妈')}`} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none',zIndex:5}} allow="camera;microphone;autoplay" />
    )}
    <video ref={localVid} autoPlay playsInline muted style={{...S.pip, ...(SELF_MIRROR ? { transform: 'scaleX(-1)' } : {})}}/>
    <HoldToTalk onPress={onTalkPress} onRelease={onTalkRelease} disabled={false}/>
    <HangupButton onClick={hangup}/>
  </div>);
}

const S={
  page:{height:'100%',width:'100%',background:'#000',position:'relative',overflow:'hidden'},
  pip:{position:'absolute',top:'max(calc(var(--safe-top, 0px) + 12px), 44px)',right:12,width:'32vw',minWidth:120,maxWidth:156,aspectRatio:'3 / 4',objectFit:'cover',borderRadius:12,border:'2px solid rgba(255,255,255,0.4)',background:'#333',zIndex:20,boxShadow:'0 4px 16px rgba(0,0,0,0.4)'},
  dial:{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#000',paddingBottom:80},
  dw:{position:'relative',width:120,height:120,marginBottom:28,display:'flex',alignItems:'center',justifyContent:'center'},
  dp:{width:100,height:100,borderRadius:'50%',objectFit:'cover',border:'3px solid rgba(255,255,255,0.15)',zIndex:2},
  dph:{width:100,height:100,borderRadius:'50%',background:'#1a1a1a',display:'flex',alignItems:'center',justifyContent:'center',fontSize:48,zIndex:2},
  r1:{position:'absolute',width:120,height:120,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.15)',animation:'ringPulse 2s ease-out infinite'},
  r2:{position:'absolute',width:120,height:120,borderRadius:'50%',border:'1.5px solid rgba(255,255,255,0.1)',animation:'ringPulse 2s ease-out 0.6s infinite'},
  dn:{fontSize:22,fontWeight:600,color:'#f5f5f5',marginBottom:8},ds:{fontSize:14,color:'#888'},
  dc:{position:'absolute',bottom:'calc(60px + var(--safe-bottom, 0px))',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.1)',color:'#999',padding:'10px 36px',borderRadius:24,fontSize:14,cursor:'pointer'},
};
