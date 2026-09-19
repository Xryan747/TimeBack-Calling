import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * Records audio as WAV via Web Audio API → sends to Zhipu ASR via backend.
 * No VPN needed — Zhipu is directly accessible in China.
 */

// WAV encoder
function encodeWav(samples, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = samples.length * (bitsPerSample / 8);
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buf], { type: 'audio/wav' });
}

export default function useAudioRecorder({ onResult, enabled }) {
  const [isListening, setIsListening] = useState(false);
  const [audioDetected, setAudioDetected] = useState(false);
  const [error, setError] = useState(null);
  const enabledRef = useRef(enabled);
  const onResultRef = useRef(onResult);
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const chunksRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const sendingRef = useRef(false);

  onResultRef.current = onResult;
  enabledRef.current = enabled;

  const stop = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null; }
    chunksRef.current = [];
    setIsListening(false);
    setAudioDetected(false);
  }, []);

  useEffect(() => {
    if (!enabled) { stop(); return; }

    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);

        // Use ScriptProcessorNode to capture raw PCM
        const bufferSize = 4096;
        const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
        processorRef.current = processor;

        source.connect(processor);
        processor.connect(audioCtx.destination);

        let silenceFrames = 0;
        const SILENCE_THRESHOLD = 0.02; // RMS threshold
        const SILENCE_FRAMES_MAX = 24;  // ~1.5s at 4096/16000

        processor.onaudioprocess = (event) => {
          if (cancelled || sendingRef.current) return;

          const input = event.inputBuffer.getChannelData(0);
          const rms = Math.sqrt(input.reduce((sum, v) => sum + v * v, 0) / input.length);

          if (rms > SILENCE_THRESHOLD) {
            // Speech detected
            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true;
              setAudioDetected(true);
              chunksRef.current = [];
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
            // Collect samples
            chunksRef.current.push(new Float32Array(input));
            silenceFrames = 0;
          } else if (isSpeakingRef.current) {
            // Possible end of speech
            silenceFrames++;
            chunksRef.current.push(new Float32Array(input));

            if (silenceFrames >= SILENCE_FRAMES_MAX) {
              // Speech ended — send for transcription
              isSpeakingRef.current = false;
              setAudioDetected(false);
              silenceFrames = 0;
              const allSamples = flattenChunks(chunksRef.current);
              chunksRef.current = [];
              if (allSamples.length > 8000) { // At least 0.5s
                sendForTranscription(allSamples);
              }
            }
          }
        };

        setIsListening(true);
        setError(null);
      } catch (err) {
        if (err.name === 'NotAllowedError') setError('麦克风权限被拒绝');
        else setError(`录音失败: ${err.message}`);
      }
    }

    function flattenChunks(chunks) {
      const total = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Float32Array(total);
      let offset = 0;
      for (const c of chunks) { result.set(c, offset); offset += c.length; }
      return result;
    }

    async function sendForTranscription(samples) {
      sendingRef.current = true;
      try {
        const wavBlob = encodeWav(samples, 16000);
        const form = new FormData();
        form.append('audio', wavBlob, 'speech.wav');

        const res = await fetch('/api/asr', { method: 'POST', body: form });
        const data = await res.json();

        if (data.success && data.data.text) {
          console.log('[ASR] Text:', data.data.text);
          onResultRef.current(data.data.text);
        } else {
          console.log('[ASR] No text recognized');
        }
        setError(null);
      } catch (err) {
        console.error('[ASR] Error:', err.message);
        setError(`识别失败: ${err.message}`);
      } finally {
        sendingRef.current = false;
      }
    }

    start();
    return () => { cancelled = true; stop(); };
  }, [enabled, stop]);

  return { isListening, audioDetected, error, isSupported: true, stop };
}
