/**
 * Memory Service (P5)
 * Extracts, stores, and retrieves conversation memories
 * Key facts persist across calls — grandma remembers you.
 */

const { addMemory, getMemories, getFacts, saveFacts } = require('../db/sqlite');

const FACT_LLM_API = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

const FACT_PROMPT = `你是记忆整理助手。数字人正在和它的家人聊天，你要从【最新对话】里提取"对方"新说出的、值得长期记住的事实。

规则：
- 只提取"对方说"里对方亲口说出的、关于他自己的事实：近况（最近发生的事）、工作、健康、喜好（爱吃的、爱喝的）、年龄、生日、家人、计划、约定、他提到的人和事、过去的回忆
- 家人信息是重中之重：对方提到家人时（爷爷、奶奶、爸爸、妈妈、兄弟姐妹等），把每个家人的情况单独记成一条，重点抓：是否健在/去世、住在哪里、身体怎么样、最近怎么样。比如"我爷爷去年走了"记成"对方爷爷去年去世了"；"我奶奶在老家住"记成"对方奶奶住在老家"；"我爸腰不好"记成"对方爸爸腰不好"。对方没提过的家人不要写
- 每条事实都必须能在"对方说"里找到原话依据；"数字人说"里的话是数字人自己的情况，哪怕提到对方也绝不能写成对方的事实（比如数字人说"我刚种完地回来"，不能写成"对方刚种完地"）
- 打招呼、寒暄、反问、感叹（比如"晚上好""你在干啥呢""嗯嗯""好"）不是事实，一律忽略
- 【已有记忆】里已经记过的条目不要重复输出，只输出这次新出现的事实
- 没有任何新事实就输出空数组 []
- 最多10条，每条一句话，不超过20个字
- 只输出 JSON 数组（例如 ["对方最近在找工作","对方喜欢吃锅包肉"]），不要任何其他文字`;

/**
 * Extract key facts from user speech
 * Simple keyword-based extraction — future: LLM-based
 */
function extractFacts(text, personaId) {
  const facts = [];

  // Pattern-based extraction
  const patterns = [
    { regex: /我(?:今天|最近|刚|现在).*?(?:了|过|完)/g, type: 'event' },
    { regex: /我(?:喜欢|想|讨厌|怕|担心).*?(?:[。，,;]|$)/g, type: 'feeling' },
    { regex: /我(?:在|去|到|从).*?(?:[。，,;]|$)/g, type: 'location' },
  ];

  for (const { regex, type } of patterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const m of matches) {
        facts.push({ type, content: m.trim() });
      }
    }
  }

  return facts;
}

/**
 * Save memories after each conversation turn
 */
async function remember(personaId, userText, aiText) {
  const facts = extractFacts(userText, personaId);

  for (const fact of facts) {
    await addMemory(personaId, fact.type, fact.content, 0.6);
  }

  // Also save AI's response if it contains "remember-worthy" info
  if (aiText && aiText.length > 20) {
    const keyPhrases = aiText.match(/(?:记得|以前|小时候|那时候).*?(?:[。，,;]|$)/g);
    if (keyPhrases) {
      for (const phrase of keyPhrases) {
        await addMemory(personaId, 'reminisce', phrase.trim(), 0.8);
      }
    }
  }
}

/**
 * Recall relevant memories — inject into LLM context
 */
async function recall(personaId, userText, limit = 5) {
  const allMemories = await getMemories(personaId, 20);
  if (!allMemories.length) return '';

  // Simple relevance: match keywords between user text and memories
  const userWords = new Set(userText.split('').filter(c => /[一-鿿]/.test(c)));
  const scored = allMemories.map(m => {
    const memChars = new Set(m.content.split('').filter(c => /[一-鿿]/.test(c)));
    const overlap = [...userWords].filter(w => memChars.has(w)).length;
    return { ...m, score: overlap * (m.importance || 0.5) };
  });

  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.slice(0, limit).filter(m => m.score > 0);

  if (!relevant.length) return '';

  return '【对方以前跟你说过的事】\n' +
    relevant.map(m => `- ${m.content}`).join('\n');
}

/**
 * Get durable facts as prompt-ready lines ("- 事实1\n- 事实2")
 */
async function getFactsText(personaId) {
  const raw = await getFacts(personaId);
  if (!raw) return '';
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.map(f => `- ${f}`).join('\n');
  } catch {}
  return raw;
}

/**
 * Deterministic merge: old facts + newly extracted ones, deduped, capped at 15
 * (drop the oldest when full). Merging in code instead of the LLM means a bad
 * extraction can never silently DELETE a real memory — it can only add junk
 * (filterable) or miss something. Forgetting is the unforgivable failure mode.
 */
function mergeFacts(existing, incoming) {
  const seen = new Set();
  const out = [];
  for (const f of [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]) {
    const s = String(f).trim();
    const norm = s.replace(/\s+/g, '');
    if (!norm || norm.length > 40 || seen.has(norm)) continue;
    seen.add(norm);
    out.push(s);
  }
  return out.slice(-15);
}

/**
 * LLM extraction: ONLY new facts from the latest user message (delta, not a
 * merge — see mergeFacts for why). Takes the facts already known so it can
 * skip duplicates. Returns an array (possibly empty) or null on error/skip.
 * Does NOT persist — the caller decides where the list lives (the customer's
 * phone-local DB for chats/calls, or the server DB as a legacy fallback).
 */
async function extractNewFacts(existingFacts, userText, aiText) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) return null;

  // Skip trivial one-liners (greetings, "你在干啥呢") — they produce junk facts
  if (!userText || userText.trim().length < 6) return null;

  const base = Array.isArray(existingFacts) ? existingFacts : [];
  const existingText = base.length ? base.map(f => `- ${f}`).join('\n') : '(无)';

  const response = await fetch(FACT_LLM_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: FACT_PROMPT },
        {
          role: 'user',
          content: `【已有记忆】\n${existingText}\n\n【最新对话】\n对方说：${userText}\n数字人说：${aiText}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    throw new Error(`Facts LLM error (${response.status})`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;

  const match = content.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Facts LLM returned non-JSON');

  let arr;
  try { arr = JSON.parse(match[0]); } catch { throw new Error('Facts JSON parse failed'); }
  if (!Array.isArray(arr) || !arr.length) return [];

  const clean = [...new Set(arr.map(f => String(f).trim()).filter(f => f && f.length <= 40))].slice(0, 10);
  return clean;
}

/**
 * Server-side fact persistence (legacy path — clients that don't carry their
 * own local fact DB yet): merge new facts into the durable fact list in app.db.
 * Fire-and-forget after each reply — facts take effect from the NEXT message onward.
 * `existing` may be an array to merge from; omit to read the server DB list.
 */
async function rememberFacts(personaId, userText, aiText, existing) {
  let base = existing;
  if (base === undefined) {
    // Fall back to the server DB list ("- f" lines → re-parse)
    const txt = await getFactsText(personaId);
    base = txt ? txt.split('\n').map(l => l.replace(/^- /, '').trim()).filter(Boolean) : [];
  }
  const incoming = await extractNewFacts(base, userText, aiText);
  const merged = mergeFacts(base, incoming || []);
  if (!merged.length || JSON.stringify(merged) === JSON.stringify(base)) return null;
  await saveFacts(personaId, JSON.stringify(merged));
  console.log('[Facts] Updated:', merged.length, 'facts');
  return merged;
}

module.exports = { remember, recall, getFactsText, rememberFacts, extractNewFacts, mergeFacts };
