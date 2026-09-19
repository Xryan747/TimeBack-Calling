/**
 * Humanize Service
 *
 * 模型回复的轻量后处理。只做安全的收尾（防超长），
 * 不再机械地插入称呼、语气词和停顿——
 * 称呼与口头禅由模型在人设指导下自然产出，硬塞反而显得僵硬。
 */

// 自然句长——不强制截断，只防止过长（>3句）
function shortenSentence(text) {
  if (!text) return text;
  const sentences = text.split(/(?<=[。！？])/g).filter(s => s.trim());
  if (sentences.length > 3) return sentences.slice(0, 3).join('');
  return sentences.join('');
}

// 顺序：trim → shorten
function humanize(text) {
  if (!text || !text.trim()) return text;
  return shortenSentence(text.trim());
}

module.exports = { humanize, shortenSentence };
