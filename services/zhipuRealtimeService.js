/**
 * Zhipu GLM-Realtime Service
 * Two modes:
 * 1. createRealtimeSession — audio in, audio+text out (for voice calls)
 * 2. speakText — text in, audio out (TTS only, currently broken)
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const REALTIME_URL = 'wss://open.bigmodel.cn/api/paas/v4/realtime';

function generateToken(apiKey) {
  const [id, secret] = apiKey.split('.');
  return jwt.sign(
    { api_key: id, exp: Math.floor(Date.now() / 1000) + 600, timestamp: Date.now() },
    secret, { algorithm: 'HS256', header: { alg: 'HS256', sign_type: 'SIGN' } }
  );
}

/**
 * Create a long-lived Realtime session for voice conversation
 * Processes: audio in → STT → LLM → TTS → audio out
 */
async function createRealtimeSession({ systemPrompt, onText, onAudio, onError }) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_API_KEY not configured');

  const token = generateToken(apiKey);
  const ws = new WebSocket(REALTIME_URL, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  let textBuffer = '';
  let audioChunks = [];
  let ready = false;

  ws.on('open', () => {
    console.log('[Realtime] Connected');
    ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        input_audio_format: 'wav',
        output_audio_format: 'mp3',
        instructions: systemPrompt,
        voice: 'female-tianmei',
        turn_detection: { type: 'server_vad' },
        beta_fields: { chat_mode: 'audio', tts_source: 'e2e', auto_search: false },
      },
    }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case 'session.created':
          ready = true;
          console.log('[Realtime] Session ready');
          break;

        case 'response.text.delta':
          textBuffer += (msg.delta || '');
          break;

        case 'response.text.done': {
          const finalText = msg.text || textBuffer;
          if (finalText && onText) onText(finalText, true);
          textBuffer = '';
          break;
        }

        case 'response.audio.delta':
          if (msg.delta && onAudio) {
            const chunk = Buffer.from(msg.delta, 'base64');
            audioChunks.push(chunk);
          }
          break;

        case 'response.audio.done':
          if (onAudio && audioChunks.length > 0) {
            onAudio(null, Buffer.concat(audioChunks));
            audioChunks = [];
          }
          break;

        case 'error':
          console.error('[Realtime] Error:', msg.error?.message);
          if (onError) onError(new Error(msg.error?.message || 'Realtime error'));
          break;
      }
    } catch (e) {
      // Binary data — ignore
    }
  });

  ws.on('error', (err) => {
    console.error('[Realtime] WS error:', err.message);
    if (onError) onError(err);
  });

  ws.on('close', (code) => console.log('[Realtime] Closed:', code));

  return {
    sendAudio(wavBase64) {
      if (ws.readyState === WebSocket.OPEN && ready) {
        ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: wavBase64 }));
      }
    },

    commitAudio() {
      if (ws.readyState === WebSocket.OPEN && ready) {
        ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      }
    },

    createResponse() {
      if (ws.readyState === WebSocket.OPEN && ready) {
        ws.send(JSON.stringify({ type: 'response.create' }));
      }
    },

    close() {
      try { ws.close(); } catch {}
    },
  };
}

module.exports = { createRealtimeSession };
