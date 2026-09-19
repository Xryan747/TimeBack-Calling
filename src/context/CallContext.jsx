import { createContext, useContext, useRef, useState, useCallback } from 'react';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const wsRef = useRef(null);
  const statusRef = useRef('idle');
  const [callState, setCallState] = useState({
    status: 'idle',
    persona: null,
    streamData: null,
    callId: null,
    lastUserText: '',
    lastAiText: '',
    lastAudioBase64: null,
    error: null,
  });

  const setStatus = useCallback((status) => {
    statusRef.current = status;
    setCallState(s => ({ ...s, status }));
  }, []);

  const resetCall = useCallback(() => {
    setCallState({
      status: 'idle',
      persona: null,
      streamData: null,
      callId: null,
      lastUserText: '',
      lastAiText: '',
      lastAudioBase64: null,
      error: null,
    });
    statusRef.current = 'idle';
  }, []);

  const startCall = useCallback((personaId, onMessage) => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.hostname}:3000`;

    setCallState(s => ({ ...s, status: 'connecting', error: null }));
    statusRef.current = 'connecting';

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Call] WebSocket connected, starting call for persona:', personaId);
      ws.send(JSON.stringify({ type: 'start_call', personaId }));
    };

    ws.onmessage = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      console.log('[Call] Message:', msg.type);

      switch (msg.type) {
        case 'call_connected':
          setCallState(s => ({
            ...s,
            status: 'connected',
            persona: msg.data.persona,
            streamData: msg.data.streamData,
            callId: msg.data.callId,
          }));
          statusRef.current = 'connected';
          break;

        case 'transcript_final':
          setCallState(s => ({ ...s, lastUserText: msg.data.text }));
          break;

        case 'ai_text':
          setCallState(s => ({ ...s, lastAiText: msg.data.text }));
          break;

        case 'ai_audio':
          setCallState(s => ({ ...s, lastAudioBase64: msg.data.audioBase64 }));
          break;

        case 'did_speaking':
          break;

        case 'fallback_tts':
          setCallState(s => ({ ...s, lastAiText: msg.data.text }));
          break;

        case 'call_ended':
          setCallState(s => ({ ...s, status: 'ended' }));
          statusRef.current = 'ended';
          break;

        case 'error':
          console.error('[Call] Server error:', msg.message);
          setCallState(s => ({ ...s, error: msg.message }));
          break;

        default:
          console.log('[Call] Unknown msg type:', msg.type);
      }

      if (onMessage) onMessage(msg);
    };

    ws.onerror = (e) => {
      console.error('[Call] WebSocket error');
      setCallState(s => ({ ...s, error: '连接失败，请检查服务器是否启动' }));
    };

    ws.onclose = (e) => {
      console.log('[Call] WebSocket closed, code:', e.code);
      if (statusRef.current === 'connected') {
        setCallState(s => ({ ...s, status: 'ended' }));
        statusRef.current = 'ended';
      }
    };
  }, []);

  const endCall = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_call' }));
      wsRef.current.close();
    }
    wsRef.current = null;
    resetCall();
  }, [resetCall]);

  const sendUserSpeech = useCallback((text) => {
    console.log('[Call] Sending user speech:', text);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'user_speech', text }));
    } else {
      console.warn('[Call] Cannot send — WS not open. State:', wsRef.current?.readyState);
    }
  }, []);

  const sendSDPAnswer = useCallback((answer) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'did_sdp_answer', answer }));
    }
  }, []);

  const sendICECandidate = useCallback((candidate) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'did_ice_candidate', candidate }));
    }
  }, []);

  return (
    <CallContext.Provider value={{
      callState,
      startCall,
      endCall,
      sendUserSpeech,
      sendSDPAnswer,
      sendICECandidate,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
