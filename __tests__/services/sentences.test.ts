import { splitIntoSentences } from '@/services/voice/sentences';

describe('splitIntoSentences', () => {
  it('splits on sentence ends and newlines, trimming blanks', () => {
    expect(splitIntoSentences('Here is what the label says. Medicine name: Panadol.\n\nDosage: 500 mg!')).toEqual([
      'Here is what the label says.',
      'Medicine name: Panadol.',
      'Dosage: 500 mg!',
    ]);
  });

  it('handles Arabic punctuation', () => {
    expect(splitIntoSentences('هذا ما يقوله الملصق. اسم الدواء: بانادول؟ الجرعة 500 ملغ.')).toEqual([
      'هذا ما يقوله الملصق.',
      'اسم الدواء: بانادول؟',
      'الجرعة 500 ملغ.',
    ]);
  });

  it('keeps decimals inside a sentence and returns nothing for blank text', () => {
    expect(splitIntoSentences('Dosage: 2.5 mg. Twice daily.')).toEqual(['Dosage: 2.5 mg.', 'Twice daily.']);
    expect(splitIntoSentences('   \n ')).toEqual([]);
  });

  it('breaks a very long sentence into chunks at commas or spaces', () => {
    const long = Array.from({ length: 60 }, (_, i) => `word${i}`).join(', ');
    const chunks = splitIntoSentences(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(220);
    expect(chunks.join(' ').replace(/\s+/g, '')).toBe(long.replace(/\s+/g, ''));
  });
});
