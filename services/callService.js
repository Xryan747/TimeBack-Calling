const { chat } = require('./llmService');
const { createAndWaitForVideo } = require('./didService');

async function processUserSpeech(persona, userText, conversationHistory) {
  conversationHistory.push({ role: 'user', content: userText });
  console.log(`[Call] User: "${userText}"`);
  const replyText = await chat(conversationHistory, persona.system_prompt);
  console.log(`[Call] AI: "${replyText}"`);
  conversationHistory.push({ role: 'assistant', content: replyText });

  let videoUrl = null;
  if (process.env.DID_API_KEY && persona.photo_url) {
    try { videoUrl = await createAndWaitForVideo(persona.photo_url, replyText); }
    catch (err) { console.warn('[Call] D-ID:', err.message); }
  }
  return { replyText, videoUrl };
}

module.exports = { processUserSpeech };
