/**
 * Call Handler — Digital Memory Pipeline
 * Flow: ASR → LLM → Humanize → Voice → Frontend
 *                                └→ D-ID (independent render layer)
 */

const { v4: uuidv4 } = require('uuid');
const { getPersona, insertCallHistory, updateCallEnd, getMessages, appendMessage } = require('../db/database');
const LT_URL = 'http://localhost:8010';
const { chat } = require('../services/llmService');
const { humanize } = require('../services/humanizeService');
const { generateVoice } = require('../voice/voiceService');
const { getClonedVoiceId } = require('../services/voiceCloneService');
const { remember, recall, getFactsText, rememberFacts, extractNewFacts, mergeFacts } = require('../services/memoryService');
// Node 18+ ships global fetch/FormData/Blob — used for LiveTalking delivery

const sessions = new Map();

// ── Speech delivery helpers ─────────────────────────────────────────────
// Chain: MiniMax TTS → LiveTalking /humanaudio (lip sync) → edge-tts → device TTS

async function postLt(path, body) {
  const resp = await fetch(`${LT_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${path} HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`${path}: ${data.msg}`);
}

async function postHumanaudio(sessionid, audioBuffer) {
  const form = new FormData();
  form.append('sessionid', sessionid);
  form.append('file', new Blob([audioBuffer], { type: 'audio/wav' }), 'reply.wav');
  const resp = await fetch(`${LT_URL}/humanaudio`, { method: 'POST', body: form });
  if (!resp.ok) throw new Error(`humanaudio HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`humanaudio: ${data.msg}`);
}

async function speakViaLiveTalking(session, ws, text) {
  // 1. MiniMax TTS with the user's cloned voice (MINIMAX_VOICE_ID)
  let audioBuffer = null;
  const tTts = Date.now();
  try {
    const result = await generateVoice(text, { voice_id: process.env.MINIMAX_VOICE_ID });
    audioBuffer = result.audioBuffer;
    console.log('[Perf] TTS', Date.now() - tTts, 'ms');
  } catch (e) {
    console.warn('[Speak] MiniMax generation failed:', e.message);
  }

  // 2. Queue if LiveTalking session not linked yet (iframe still connecting)
  if (!session.ltSessionId) {
    session.pendingSpeaks = session.pendingSpeaks || [];
    session.pendingSpeaks.push({ text, audioBuffer });
    if (session.pendingSpeaks.length > 20) session.pendingSpeaks.shift();
    console.log('[Speak] No LiveTalking session yet — queued');
    return;
  }

  try {
    if (audioBuffer) {
      const tLt = Date.now();
      await postHumanaudio(session.ltSessionId, audioBuffer);
      console.log('[Perf] LT upload', Date.now() - tLt, 'ms');
      console.log('[Speak] MiniMax audio delivered to LiveTalking');
    } else {
      await postLt('/human', { sessionid: session.ltSessionId, text, type: 'echo' });
      console.log('[Speak] Fallback: LiveTalking edge-tts');
    }
    return;
  } catch (e) {
    console.warn('[Speak] LiveTalking delivery failed:', e.message);
    // 会话已失效(用户重拨/iframe 重连)——先把回复押回队列,等新会话号来了再补发
    if (/session not found/i.test(e.message)) {
      session.ltSessionId = null;
      session.pendingSpeaks = session.pendingSpeaks || [];
      session.pendingSpeaks.push({ text, audioBuffer });
      if (session.pendingSpeaks.length > 20) session.pendingSpeaks.shift();
      console.log('[Speak] Stale session — re-queued for fresh LiveTalking session');
      // 8 秒后还没等到新会话号,退回手机本地朗读,保证用户至少能听到
      setTimeout(() => {
        if (!session.ltSessionId && session.isActive) safeSend(ws, { type: 'fallback_tts', data: { text } });
      }, 8000);
      return;
    }
  }

  // 3. Last resort: device-native TTS on the frontend
  safeSend(ws, { type: 'fallback_tts', data: { text } });
}

// ── Real-world time awareness (Beijing time) ──────────────────────────────
// The persona must know the actual date/time so greetings never contradict
// reality (e.g. never says "good morning" at night). Explicit timeZone in
// case the server ever runs outside China.
function timeContext() {
  try {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', hour12: false,
      year: 'numeric', month: 'numeric', day: 'numeric',
      weekday: 'long', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date());
    const get = (t) => parts.find(p => p.type === t)?.value || '';
    const num = (t) => get(t).replace(/\D/g, '');
    const hour = parseInt(num('hour'), 10);
    const seg = hour < 6 ? '凌晨' : hour < 9 ? '早上' : hour < 12 ? '上午'
      : hour < 14 ? '中午' : hour < 18 ? '下午' : hour < 23 ? '晚上' : '深夜';
    const hour12 = ((hour + 11) % 12) + 1;
    return `\n\n【现在的真实时间】现在是${num('year')}年${num('month')}月${num('day')}日（${get('weekday')}），${seg}${hour12}点${num('minute')}分。你问候、提时间、说日期都必须和这个真实时间一致：现在是晚上就绝不能说"早上好"。`;
  } catch {
    return '';
  }
}

function setupCallHandler(wss) {
  wss.on('connection', (ws) => {
    const session = {
      persona: null, callId: null, didStream: null, isActive: false, history: [],
      ltSessionId: null, pendingSpeaks: [], replyChain: Promise.resolve(),
      mode: null, // 'call' | 'chat' — guards which pipeline runs
      clientFacts: null, // facts sent by the app from the phone's local DB; null = legacy (server DB)
      factChain: Promise.resolve(), // serializes fact extraction so merges never race
    };
    sessions.set(ws, session);

    ws.on('message', async (d) => {
      let msg; try { msg = JSON.parse(d.toString()); } catch { return; }
      try {
        // ── Start Call ──
        if (msg.type === 'start_call') {
          session.persona = getPersona(msg.personaId);
          if (!session.persona) return safeSend(ws, { type: 'error', message: '数字人不存在' });
          session.mode = 'call'; session.callId = uuidv4(); session.isActive = true;
          // 新通话绝不沿用上一次的 LiveTalking 会话——残留会话已断开,回复会无声丢失
          session.ltSessionId = null; session.pendingSpeaks = [];
          // The app carries the phone-local memory (facts) — mom remembers chat-learned things on calls too
          session.clientFacts = Array.isArray(msg.facts) ? msg.facts : null;
          insertCallHistory({ id: session.callId, persona_id: msg.personaId, transcript: [] });

          // Derive avatar_id from name if not stored
          const ltId = session.persona.lt_avatar_id
            || session.persona.name.replace(/[^a-zA-Z0-9一-鿿_-]/g, '_');

          safeSend(ws, { type: 'call_connected', data: { persona: { id: session.persona.id, name: session.persona.name, photoUrl: session.persona.photo_url, ltAvatarId: ltId }, liveTalkingUrl: 'http://localhost:8010' } });
        }

        // ── User Speech → LLM → Humanize → Output ──
        else if (msg.type === 'user_speech') {
          if (session.mode !== 'call' || !session.isActive) return;
          const spoken = msg.text?.trim() || '';
          const isSilent = !spoken && !!msg.silent;
          if (!spoken && !isSilent) return;

          // 按住说话但没出声 → 什么都不做。规则:只有用户真的说出话(识别出文字),数字人才回复
          if (isSilent) {
            console.log('[Call] Silence — ignored (only reply when user actually speaks)');
            return;
          }

          safeSend(ws, { type: 'transcript_final', data: { text: spoken } });

          // 1. Facts + memories → inject into LLM context
          // Phone-local mode: the app sent its fact list with start_call — use it (privacy: customer
          // memories live on their phone). Legacy mode (no facts): recall from the server DB as before.
          const clientFacts = session.clientFacts;
          let contextPrompt = session.persona.system_prompt; contextPrompt += timeContext();
          if (clientFacts) {
            const factsText = clientFacts.map(f => `- ${f}`).join('\n');
            if (factsText) contextPrompt += `\n\n【对方跟你说过的事，你一直记着】\n${factsText}`;
          } else {
            const [memories, factsText] = await Promise.all([
              recall(session.persona.id, spoken),
              getFactsText(session.persona.id),
            ]);
            if (factsText) contextPrompt += `\n\n【对方跟你说过的事，你一直记着】\n${factsText}`;
            if (memories) contextPrompt += `\n\n${memories}`;
          }

          // 2. LLM response
          session.history.push({ role: 'user', content: spoken });
          const tLlm = Date.now();
          const rawReply = await chat(session.history, contextPrompt, 'call');
          session.history.push({ role: 'assistant', content: rawReply });
          console.log('[Perf] LLM', Date.now() - tLlm, 'ms');
          console.log('[LLM] Raw:', rawReply.slice(0, 60));

          // 3. Save memories for future
          if (clientFacts) {
            // Phone-local memory: extract new facts, merge in code, hand the list back to the phone
            session.factChain = session.factChain.then(async () => {
              const base = session.clientFacts || [];
              const incoming = await extractNewFacts(base, spoken, rawReply);
              const merged = mergeFacts(base, incoming || []);
              if (merged.length && JSON.stringify(merged) !== JSON.stringify(base)) {
                session.clientFacts = merged;
                safeSend(ws, { type: 'call_new_facts', data: { facts: merged } });
              }
            }).catch((e) => console.warn('[Facts]', e.message));
          } else {
            remember(session.persona.id, spoken, rawReply).catch((e) => console.warn('[Mem]', e.message));
            rememberFacts(session.persona.id, spoken, rawReply).catch((e) => console.warn('[Facts]', e.message));
          }

          // 4. Humanize — light post-processing (sentence cap only)
          const humanized = humanize(rawReply);
          console.log('[Humanize]', humanized.slice(0, 60));

          // 5. Send text to frontend for display (audio is delivered server-side)
          safeSend(ws, { type: 'ai_text', data: { text: humanized } });

          // 6. Stop the avatar's current sentence right away
          if (session.ltSessionId) {
            postLt('/interrupt_talk', { sessionid: session.ltSessionId }).catch(() => {});
          }

          // 7. Generate speech (MiniMax) and deliver to LiveTalking — serialized to keep reply order
          session.replyChain = session.replyChain
            .then(() => speakViaLiveTalking(session, ws, humanized))
            .catch((e) => console.error('[Speak]', e.message));
        }

        // ── LiveTalking session ID from frontend ──
        else if (msg.type === 'lt_session') {
          session.ltSessionId = msg.sessionId;
          console.log('[LiveTalking] Session linked:', msg.sessionId);
          // Flush replies queued while the iframe was still connecting
          const pending = session.pendingSpeaks || [];
          session.pendingSpeaks = [];
          pending.forEach((p) => {
            const deliver = p.audioBuffer
              ? postHumanaudio(session.ltSessionId, p.audioBuffer)
              : postLt('/human', { sessionid: session.ltSessionId, text: p.text, type: 'echo' });
            deliver.catch((e) => console.warn('[Speak] queued delivery failed:', e.message));
          });
        }
        // ── Start Text Chat ──
        else if (msg.type === 'start_chat') {
          const persona = getPersona(msg.personaId);
          if (!persona) return safeSend(ws, { type: 'error', message: '数字人不存在' });
          session.mode = 'chat'; session.persona = persona; session.isActive = true;
          // Seed LLM context from persisted history (display is loaded via REST on the client)
          session.history = getMessages(persona.id, 30).map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
          }));
          safeSend(ws, { type: 'chat_ready', data: { persona: { id: persona.id, name: persona.name, photoUrl: persona.photo_url } } });
        }

        // ── Text Message → LLM → Humanize (no TTS) ──
        else if (msg.type === 'text_chat') {
          if (session.mode !== 'chat' || !msg.text?.trim()) return;
          const userText = msg.text.trim();

          // Phone-local memory: the app sends its fact list with every message (null = legacy client)
          const clientFacts = Array.isArray(msg.facts) ? msg.facts : null;
          if (clientFacts) session.clientFacts = clientFacts;

          // Persist user message immediately (server-authoritative)
          const userMsg = appendMessage({ personaId: session.persona.id, role: 'user', text: userText });
          safeSend(ws, { type: 'user_ack', data: { id: userMsg.id, createdAt: userMsg.created_at, text: userText } });

          // Serialize replies so rapid sends never interleave (same pattern as call path)
          session.replyChain = session.replyChain.then(async () => {
            try {
              // 1. Facts + memories → inject into LLM context.
              // Phone-local mode: the memory DB lives on the customer's phone — the facts arrive
              // with each message and are never written to the server DB.
              let contextPrompt = session.persona.system_prompt; contextPrompt += timeContext();
              if (clientFacts) {
                const factsText = clientFacts.map(f => `- ${f}`).join('\n');
                if (factsText) contextPrompt += `\n\n【对方跟你说过的事，你一直记着】\n${factsText}`;
              } else {
                const [memories, factsText] = await Promise.all([
                  recall(session.persona.id, userText),
                  getFactsText(session.persona.id),
                ]);
                if (factsText) contextPrompt += `\n\n【对方跟你说过的事，你一直记着】\n${factsText}`;
                if (memories) contextPrompt += `\n\n${memories}`;
              }

              // 2. LLM response
              session.history.push({ role: 'user', content: userText });
              const rawReply = await chat(session.history, contextPrompt, 'chat');
              session.history.push({ role: 'assistant', content: rawReply });
              console.log('[Chat LLM] Raw:', rawReply.slice(0, 60));

              // 3. Humanize — light post-processing (sentence cap only)
              const humanized = humanize(rawReply);

              // 4. Persist AI message before sending, so a WS drop never loses the reply
              const aiMsg = appendMessage({ personaId: session.persona.id, role: 'ai', text: humanized });
              safeSend(ws, { type: 'text_reply', data: { id: aiMsg.id, text: humanized, createdAt: aiMsg.created_at } });

              // 5. Extract + merge memories AFTER the reply is out (never delays it).
              // Phone-local mode: the merged list goes back to the phone to replace its local DB.
              if (clientFacts) {
                session.factChain = session.factChain.then(async () => {
                  const base = session.clientFacts || [];
                  const incoming = await extractNewFacts(base, userText, humanized);
                  const merged = mergeFacts(base, incoming || []);
                  if (merged.length && JSON.stringify(merged) !== JSON.stringify(base)) {
                    session.clientFacts = merged;
                    safeSend(ws, { type: 'chat_new_facts', data: { facts: merged } });
                  }
                }).catch((e) => console.warn('[Facts]', e.message));
              } else {
                remember(session.persona.id, userText, humanized).catch((e) => console.warn('[Mem]', e.message));
                rememberFacts(session.persona.id, userText, humanized).catch((e) => console.warn('[Facts]', e.message));
              }
            } catch (e) {
              console.error('[Chat]', e.message);
              safeSend(ws, { type: 'text_reply_error', data: { message: '对方暂时没回应，请稍后再试' } });
            }
          }).catch((e) => console.error('[Chat chain]', e.message));
        }

        // ── Stop Chat ──
        else if (msg.type === 'stop_chat') {
          safeSend(ws, { type: 'chat_ended' }); session.isActive = false;
        }

        // ── Stop ──
        else if (msg.type === 'stop_call') {
          session.pendingSpeaks = []; session.ltSessionId = null;
          safeSend(ws, { type: 'call_ended' }); session.isActive = false;
        }
      } catch (e) { console.error('[WS]', e.message); safeSend(ws, { type: 'error', message: e.message }); }
    });

    ws.on('close', async () => {
      session.isActive = false;
      if (session.callId) try { updateCallEnd(session.callId); } catch {}
    });
  });
}

function safeSend(ws, d) { try { if (ws.readyState === 1) ws.send(JSON.stringify(d)); } catch {} }
module.exports = setupCallHandler;
