const DID_BASE = 'https://api.d-id.com';

async function createStream(sourceImageUrl) {
  console.log('[D-ID] Creating stream...');
  const r = await fetch(`${DID_BASE}/talks/streams`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${process.env.DID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_url: sourceImageUrl, config: { stitch: true } }),
  });
  if (!r.ok) throw new Error(`D-ID stream failed (${r.status})`);
  const d = await r.json();
  console.log(`[D-ID] Stream: ${d.id}`);
  return d;
}

async function sendText(streamId, sessionId, text) {
  const r = await fetch(`${DID_BASE}/talks/streams/${streamId}`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${process.env.DID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ script: { type: 'text', input: text, provider: { type: 'microsoft', voice_id: 'zh-CN-XiaoxiaoNeural' } }, session_id: sessionId, config: { stitch: true } }),
  });
  if (!r.ok) throw new Error(`D-ID text (${r.status})`);
}

async function sendSDPAnswer(streamId, sessionId, answer) {
  await fetch(`${DID_BASE}/talks/streams/${streamId}/sdp`, {
    method: 'POST', headers: { 'Authorization': `Basic ${process.env.DID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer, session_id: sessionId }),
  });
}

async function sendICECandidate(streamId, sessionId, candidate) {
  await fetch(`${DID_BASE}/talks/streams/${streamId}/ice`, {
    method: 'POST', headers: { 'Authorization': `Basic ${process.env.DID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate, session_id: sessionId }),
  });
}

async function closeStream(streamId, sessionId) {
  try { await fetch(`${DID_BASE}/talks/streams/${streamId}`, { method: 'DELETE', headers: { 'Authorization': `Basic ${process.env.DID_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }) }); } catch {}
}

module.exports = { createStream, sendText, sendSDPAnswer, sendICECandidate, closeStream };
