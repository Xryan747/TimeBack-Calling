/**
 * Zhipu AI (智谱) LLM Service
 * OpenAI-compatible API at https://open.bigmodel.cn/api/paas/v4
 */

const LLM_CONFIG = {
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: process.env.ZHIPU_API_KEY,
};

const PERSONA_ANALYSIS_PROMPT = `你是一位专业的对话分析师。请分析以下聊天记录或人物描述，提取出一个完整的数字人角色设定。

要求输出 JSON 格式（不要加 markdown 代码块标记）：
{
  "name": "角色名字（2-4个字的中文名）",
  "traits": ["性格特点1", "性格特点2", "性格特点3"],
  "speechPatterns": ["说话习惯1", "说话习惯2", "说话习惯3"],
  "background": "人物背景简述（100字以内）",
  "systemPrompt": "一段完整的 system prompt，必须包含以下内容：1）你是谁（年龄、身份、性格）；2）你怎么说话（语速、语气、常用词、称呼）；3）对话规则（认真听对方说什么再回复、不要敷衍、回复要具体有温度、像真人视频通话一样的自然对话、不要重复自己说过的话）。用中文写，300字左右。"
}

核心要求：
- systemPrompt 必须让 AI 真正做到"听对方说话然后自然回应"，而不是套话
- 必须包含"认真听对方说的话，根据对方说的内容来回应，不要给泛泛的安慰"
- 称呼要自然（如奶奶叫孙辈"乖乖/宝贝"，朋友之间用"你"）
- 如果聊天记录中有口头禅、方言词，必须体现在 systemPrompt 中`;

async function analyzePersona(chatLogs) {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY not configured');
  }

  const truncated = chatLogs.length > 8000 ? chatLogs.slice(0, 8000) + '\n...(内容已截断)' : chatLogs;

  const response = await fetch(`${LLM_CONFIG.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4-plus',
      messages: [
        { role: 'system', content: PERSONA_ANALYSIS_PROMPT },
        { role: 'user', content: `请分析以下内容：\n\n${truncated}` },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Zhipu API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Zhipu returned empty response');
  }

  // Parse JSON from response (handle possible markdown wrapping)
  let cleaned = content.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  let persona;
  try {
    persona = JSON.parse(cleaned);
  } catch (e) {
    // Fallback: try to extract JSON object from text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      persona = JSON.parse(match[0]);
    } else {
      throw new Error(`Failed to parse persona JSON from LLM response: ${content.slice(0, 200)}`);
    }
  }

  // Validate required fields
  if (!persona.name) persona.name = '未命名';
  if (!persona.systemPrompt) {
    persona.systemPrompt = `你是${persona.name}。${persona.background || ''}。请用自然的口语化中文回复，保持温暖亲切的语气。`;
  }
  if (!persona.traits) persona.traits = [];
  if (!persona.speechPatterns) persona.speechPatterns = [];
  if (!persona.background) persona.background = '';

  return persona;
}

async function chat(messages, systemPrompt, mode = 'call') {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) throw new Error('ZHIPU_API_KEY not configured');

  const conversationRules = `【核心规则——这是家人聊天，不是AI助手】平时不带称呼，用"你"就行；只有叮嘱、关心他的时候才叫一次"宏生啊"，一轮对话顶多一两次，句句都带名字特别假；方言词和口头禅每句最多一个，放了别扭就干脆说普通话；不要用"是吧""对吧""嗯嗯"开头凑话；像真人闲聊，不像答题。
【家人信息规则——绝不编造】关于对方的家人（他爷爷、他奶奶、他爸爸等他家里的人），只有对方先提到这个人，你才能顺着往下说；对方没提过的家人，你不能主动提起，更不能自己编造他们的情况（比如"你爷爷身体还好吧""你爸最近忙啥呢"这种不许说）。对方提到某个家人时，只接着对方亲口说过的事实往下聊，不要补充对方没说过的事。对方没提任何家人时，就聊对方自己或家常，别把家人扯进来。`;

  // 文字聊天和视频通话必须分清——说反了会出"你打视频过来了"这种穿帮话
  const modeRule = mode === 'chat'
    ? `【当前对话方式——文字聊天】对方现在是在打字发消息给你，不是打电话、不是打视频。你回的就是一条文字消息：不要提"打电话""打视频""视频通话""听见"，也别问对方刚才是不是打过电话；就当平常发微信消息。`
    : `【当前对话方式——视频通话】对方现在正在跟你视频通话，你看得见他、听得见他说话。`;

  const fullSystem = `${systemPrompt}\n\n${conversationRules}\n\n${modeRule}`;

  // Keep context lean for speed — last 6 messages
  const recentMsgs = messages.slice(-6);

  const fullMessages = [
    { role: 'system', content: fullSystem },
    ...recentMsgs,
  ];

  // CharGLM-4 是智谱的拟人角色模型（口语最像真人妈）；glm-4-plus 快但平，flash 免费兜底
  const modelChain = ['charglm-4', 'glm-4-plus', 'glm-4-flash'];
  let response = null;
  let usedModel = '';
  for (const model of modelChain) {
    response = await fetch(`${LLM_CONFIG.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        max_tokens: 80,
        temperature: 0.95,
        top_p: 0.95,
      }),
    });
    if (response.ok) { usedModel = model; break; }
    console.warn(`[LLM] ${model} failed (${response.status}) — trying next`);
  }
  if (!response || !response.ok) {
    const errText = response ? await response.text() : 'no response';
    throw new Error(`Zhipu chat error: ${errText.slice(0, 150)}`);
  }
  if (usedModel !== 'charglm-4') console.warn(`[LLM] fell back to ${usedModel}`);

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) throw new Error('Zhipu chat returned empty response');

  return reply;
}

module.exports = { analyzePersona, chat };
