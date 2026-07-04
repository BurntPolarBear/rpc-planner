
// ─── WRITING INSIGHT ──────────────────────────────────────────────────────────
export function textStats(text) {
  const words = (text.trim().match(/\S+/g) || []).length;
  const sentences = (text.match(/[.!?]+(\s|$)/g) || []).length || (words > 0 ? 1 : 0);
  const avg = sentences > 0 ? Math.round(words / sentences) : 0;
  return { words, sentences, avg };
}
