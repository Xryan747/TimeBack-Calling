import { useRef, useEffect, useState } from 'react';

export default function useSpeechRecognition({ onResult, enabled }) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [lastError, setLastError] = useState(null);
  const [audioDetected, setAudioDetected] = useState(false); // mic picking up sound?
  const onResultRef = useRef(onResult);
  const enabledRef = useRef(enabled);
  const restartTimerRef = useRef(null);

  onResultRef.current = onResult;
  enabledRef.current = enabled;

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setLastError('浏览器不支持语音识别');
      return;
    }

    if (!enabled) {
      setIsListening(false);
      setAudioDetected(false);
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      return;
    }

    let rec = null;
    let stopped = false;

    function createAndStart() {
      if (stopped || !enabledRef.current) return;

      try {
        rec = new SpeechRecognition();
        rec.lang = 'zh-CN';
        rec.continuous = false;
        rec.interimResults = true; // Enable interim to detect ANY audio activity
        rec.maxAlternatives = 1;

        rec.onresult = (event) => {
          if (stopped) return;
          // Get final result if available, otherwise interim
          for (let i = event.results.length - 1; i >= 0; i--) {
            if (event.results[i].isFinal) {
              const text = event.results[i][0].transcript;
              if (text && text.trim()) {
                console.log('[Speech] ✓ Final:', text.trim());
                setLastError(null);
                setAudioDetected(true);
                onResultRef.current(text.trim());
              }
              return;
            }
          }
          // Interim result — at least something was heard
          const interim = event.results[event.results.length - 1][0].transcript;
          if (interim) {
            console.log('[Speech] Interim:', interim);
            setAudioDetected(true);
          }
        };

        rec.onerror = (event) => {
          if (stopped) return;
          console.warn('[Speech] Error:', event.error);

          if (event.error === 'not-allowed') {
            setIsSupported(false);
            setLastError('麦克风权限被拒绝');
            return;
          }
          if (event.error === 'no-speech') {
            setLastError(null); // Normal, will restart
            return;
          }
          if (event.error === 'aborted') return;
          if (event.error === 'network') {
            setLastError('语音识别网络错误 — 可能需要翻墙');
            return;
          }
          if (event.error === 'audio-capture') {
            setLastError('无法捕获音频 — 麦克风可能被其他应用占用');
            return;
          }
          setLastError(`语音错误: ${event.error}`);
        };

        rec.onstart = () => {
          if (stopped) return;
          console.log('[Speech] 🎤 Started');
          setIsListening(true);
          setAudioDetected(false);
          setLastError(null);
        };

        rec.onend = () => {
          if (stopped) return;
          console.log('[Speech] Ended, restarting...');
          setIsListening(false);

          restartTimerRef.current = setTimeout(() => {
            if (!stopped && enabledRef.current) {
              createAndStart();
            }
          }, 200);
        };

        rec.onaudiostart = () => {
          console.log('[Speech] 🔊 Audio detected!');
          setAudioDetected(true);
        };

        rec.onspeechstart = () => {
          console.log('[Speech] 🗣 Speech started!');
          setAudioDetected(true);
        };

        rec.onsoundstart = () => {
          console.log('[Speech] 🔉 Sound start');
          setAudioDetected(true);
        };

        rec.onsoundend = () => {
          console.log('[Speech] 🔇 Sound end');
        };

        rec.onspeechend = () => {
          console.log('[Speech] 🗣 Speech end');
        };

        rec.start();
      } catch (err) {
        console.error('[Speech] Start error:', err.message);
        setIsSupported(false);
        setLastError(`启动失败: ${err.message}`);
      }
    }

    createAndStart();

    return () => {
      stopped = true;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (rec) {
        try { rec.abort(); } catch {}
      }
    };
  }, [enabled]);

  return { isListening, isSupported, lastError, audioDetected };
}
