/**
 * Split text into sentences for speech.
 *
 * Speech engines sound best — and never cut off — when given one sentence at
 * a time: iOS and Android pause naturally between utterances, the browser's
 * engine stops mid-way through utterances longer than roughly fifteen
 * seconds, and a "Stop" can take effect between sentences instead of only at
 * the end. Arabic punctuation (؟ ، ۔) is handled too.
 */

const SENTENCE_END = /(?<=[.!?؟۔])\s+|\n+/u;

/** Keep each utterance under this many characters (Android's hard limit is ~4000). */
const MAX_CHUNK = 220;

export function splitIntoSentences(text: string): string[] {
  const sentences = text
    .split(SENTENCE_END)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const chunks: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= MAX_CHUNK) {
      chunks.push(sentence);
      continue;
    }
    // A very long sentence: break at commas or semicolons, then at spaces.
    let rest = sentence;
    while (rest.length > MAX_CHUNK) {
      const window = rest.slice(0, MAX_CHUNK);
      const cut = Math.max(window.lastIndexOf('، '), window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(' '));
      const at = cut > 40 ? cut + 1 : MAX_CHUNK;
      chunks.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest.length > 0) chunks.push(rest);
  }
  return chunks;
}
