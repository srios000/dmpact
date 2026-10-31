/**
 * Cheap, deterministic detector for instruction-like text inside a DM. The
 * model is told to flag these (SECURITY section of the prompt); this is the
 * backstop so a missed flag still reaches the creator.
 */
const PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|any\s+)?(your\s+|the\s+|previous\s+|prior\s+|above\s+)*(instructions?|rules?|prompts?)/i,
  /disregard\s+(all\s+|your\s+|the\s+|previous\s+)*(instructions?|rules?|prompts?)/i,
  /(system|developer)\s+(prompt|message|note|override)/i,
  /(reveal|show|print|repeat)\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions)/i,
  /\b(set|change|make)\s+(the\s+)?(price|total|deposit|currency)\s+(to|as)\b/i,
  /mark\s+(everything|all|this)\s+as\s+(agreed|accepted|confirmed)/i,
  /(abaikan|lupakan)\s+(semua\s+)?(instruksi|perintah|aturan)/i,
  /you\s+are\s+now\s+(a|an|in)\b/i,
  /<\/?(dm_text|schema|paste_date|current_context)\b/i,
];

export function findInjectionText(dmText: string): string | null {
  for (const pattern of PATTERNS) {
    const match = pattern.exec(dmText);
    if (match) {
      // Return the full line so the creator sees it in context.
      const start = dmText.lastIndexOf("\n", match.index) + 1;
      const endIndex = dmText.indexOf("\n", match.index);
      const end = endIndex === -1 ? dmText.length : endIndex;
      return dmText.slice(start, end).trim();
    }
  }
  return null;
}
