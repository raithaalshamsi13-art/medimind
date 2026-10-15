import { speakable } from '@/services/voice/speakable';

describe('speakable', () => {
  it('expands units so the voice says the words', () => {
    expect(speakable('Dosage: 500 mg.', 'en')).toBe('Dosage: 500 milligrams.');
    expect(speakable('1 mg', 'en')).toBe('1 milligram');
    expect(speakable('2.5ml twice daily', 'en')).toBe('2.5 millilitres twice daily');
    expect(speakable('Vitamin D 1000 IU', 'en')).toBe('Vitamin D 1000 international units');
    expect(speakable('10 mg/5 ml', 'en')).toBe('10 milligrams per 5 millilitres');
    expect(speakable('الجرعة: 500 ملغ', 'ar')).toBe('الجرعة: 500 ملليغرام');
  });

  it('turns all-capital names into pronounceable words', () => {
    expect(speakable('Medicine name: PANADOL EXTRA.', 'en')).toBe('Medicine name: Panadol Extra.');
    expect(speakable('FERROUS SULPHATE 200 mg', 'en')).toBe('Ferrous Sulphate 200 milligrams');
  });

  it('leaves ordinary text, numbers and short abbreviations alone', () => {
    expect(speakable('Every 6 hours. Do not take more than 8 tablets in 24 hours.', 'en')).toBe(
      'Every 6 hours. Do not take more than 8 tablets in 24 hours.',
    );
    expect(speakable('Expiry date: 30 April 2027.', 'en')).toBe('Expiry date: 30 April 2027.');
    expect(speakable('Take 1 at 8:00 AM', 'en')).toBe('Take 1 at 8:00 AM');
  });
});
