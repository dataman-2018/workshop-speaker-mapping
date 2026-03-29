/**
 * Extract speaker names from Japanese self-introduction transcriptions.
 *
 * Recognizes patterns like:
 * - 「〜と申します」「〜と言います」
 * - 「〜です」(when preceded by name-like context)
 * - 「〜の〜です」(company + name)
 * - 「私は〜」
 * - Direct name mentions at the start of introductions
 */

// Patterns ordered by specificity (most specific first)
const NAME_PATTERNS: Array<{
  regex: RegExp;
  nameGroup: number;
  description: string;
}> = [
  // 「StoryHubの田中と申します」→ "田中"
  {
    regex: /(?:の|から参りました)([^\s、。]{1,10}?)と(?:申します|もうします)/,
    nameGroup: 1,
    description: "〜と申します (with company prefix)",
  },
  // 「田中と申します」→ "田中"
  {
    regex: /([^\s、。]{1,10}?)と(?:申します|もうします)/,
    nameGroup: 1,
    description: "〜と申します",
  },
  // 「田中と言います」→ "田中"
  {
    regex: /([^\s、。]{1,10}?)と(?:言います|いいます)/,
    nameGroup: 1,
    description: "〜と言います",
  },
  // 「田中と申す」→ "田中" (formal)
  {
    regex: /([^\s、。]{1,10}?)と(?:申す|もうす)/,
    nameGroup: 1,
    description: "〜と申す",
  },
  // 「私は田中です」→ "田中"
  {
    regex: /(?:私は|わたしは|わたくしは)([^\s、。です]{1,10}?)です/,
    nameGroup: 1,
    description: "私は〜です",
  },
  // 「StoryHubの田中です」→ "田中"
  {
    regex: /(?:の)([^\s、。]{1,10}?)です(?:。|$|\s)/,
    nameGroup: 1,
    description: "〜の〜です",
  },
  // English patterns: "I'm Tanaka" / "My name is Tanaka"
  {
    regex: /(?:I'm|I am|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    nameGroup: 1,
    description: "I'm / My name is",
  },
  // "This is Tanaka from StoryHub"
  {
    regex: /(?:this is|I'm)\s+([A-Z][a-z]+)/i,
    nameGroup: 1,
    description: "This is / I'm (English)",
  },
];

// Words that are NOT names (common false positives)
const NOT_NAMES = new Set([
  "よろしく",
  "お願い",
  "初めまして",
  "はじめまして",
  "皆さん",
  "みなさん",
  "本日",
  "今日",
  "担当",
  "代表",
  "社長",
  "です",
  "ます",
  "こんにちは",
  "こんばんは",
  "おはよう",
]);

export interface ExtractedSpeaker {
  /** Speaker cluster ID from diarization */
  cluster: string;
  /** Extracted display name (null if not found) */
  name: string | null;
  /** The text segment used for extraction */
  sourceText: string;
  /** Start time of the speaker's first segment */
  startTime: number;
  /** End time of the speaker's last segment */
  endTime: number;
  /** All segments belonging to this speaker */
  segments: Array<{ startTime: number; endTime: number; text: string }>;
}

/**
 * Extract speaker names from diarized + transcribed segments.
 */
export function extractSpeakerNames(
  segments: Array<{
    startTime: number;
    endTime: number;
    text: string;
    speakerCluster: string;
  }>
): ExtractedSpeaker[] {
  // Group segments by speaker
  const speakerMap = new Map<
    string,
    Array<{ startTime: number; endTime: number; text: string }>
  >();

  for (const seg of segments) {
    const existing = speakerMap.get(seg.speakerCluster) ?? [];
    existing.push({
      startTime: seg.startTime,
      endTime: seg.endTime,
      text: seg.text,
    });
    speakerMap.set(seg.speakerCluster, existing);
  }

  const results: ExtractedSpeaker[] = [];

  for (const [cluster, segs] of speakerMap) {
    // Sort by time
    segs.sort((a, b) => a.startTime - b.startTime);

    // Combine text from the first few segments (self-intro is usually at the start)
    const introText = segs
      .slice(0, 3)
      .map((s) => s.text)
      .join(" ");

    const name = extractNameFromText(introText);

    results.push({
      cluster,
      name,
      sourceText: introText,
      startTime: segs[0].startTime,
      endTime: segs[segs.length - 1].endTime,
      segments: segs,
    });
  }

  // Sort by first appearance
  results.sort((a, b) => a.startTime - b.startTime);

  return results;
}

/**
 * Try to extract a name from a text segment using pattern matching.
 */
function extractNameFromText(text: string): string | null {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match && match[pattern.nameGroup]) {
      const candidate = match[pattern.nameGroup].trim();

      // Validate: not too short, not a common non-name word
      if (candidate.length < 1) continue;
      if (NOT_NAMES.has(candidate)) continue;
      if (candidate.length > 20) continue;

      return candidate;
    }
  }

  return null;
}
