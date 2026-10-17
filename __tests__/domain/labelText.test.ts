/**
 * On-device reading: from Vision's recognised lines to the fields. Every
 * value must be copied from the printed words; nothing may be guessed.
 */

import { extractFromLines, findExpiry, orderLines, parsePrintedDate } from '@/domain/labelText';
import { needsNameConfirmation, scanResultSchema, scanToMedicationInput } from '@/domain/scan';
import type { OcrLine } from '../../modules/label-ocr';

/** A line at a row, with a text height (fraction of the image). */
function line(text: string, y: number, height = 0.03, confidence = 0.95, x = 0.1): OcrLine {
  return { text, confidence, x, y, width: 0.6, height };
}

const IRON: OcrLine[] = [
  line('Ferrous Sulphate', 0.1, 0.07),
  line('200 mg', 0.2, 0.04),
  line('Iron supplement', 0.27),
  line('28 film-coated tablets', 0.34),
  line('Each tablet contains: ferrous sulphate 200 mg', 0.42),
  line('Take one tablet daily with food', 0.5),
  line('Do not exceed the stated dose', 0.56),
  line('EXP 03/2027', 0.8),
  line('LOT 4471A', 0.84),
  line('Demo Pharma Ltd', 0.9),
];

describe('parsePrintedDate / findExpiry', () => {
  it('reads the common printed formats and uses the last day for month-only dates', () => {
    expect(parsePrintedDate('03/2027')).toBe('2027-03-31');
    expect(parsePrintedDate('2027-04')).toBe('2027-04-30');
    expect(parsePrintedDate('2027-04-30')).toBe('2027-04-30');
    expect(parsePrintedDate('30/04/2027')).toBe('2027-04-30');
    expect(parsePrintedDate('04/30/2027')).toBe('2027-04-30'); // swapped when the "month" cannot be one
    expect(parsePrintedDate('APR 2027')).toBe('2027-04-30');
    expect(parsePrintedDate('30 Apr 27')).toBe('2027-04-30');
    expect(parsePrintedDate('13/2027')).toBeNull();
    expect(parsePrintedDate('31/02/2027')).toBeNull();
    expect(parsePrintedDate('hello')).toBeNull();
  });

  it('takes a date only after an expiry marker, on the same or the next line', () => {
    expect(findExpiry(['MFD 01/2025', 'EXP 03/2027'])).toEqual({ value: '2027-03-31', lineIndex: 1 });
    expect(findExpiry(['Expiry date:', '2027-04-30'])).toEqual({ value: '2027-04-30', lineIndex: 0 });
    expect(findExpiry(['Use by 12/2026'])?.value).toBe('2026-12-31');
    expect(findExpiry(['تاريخ الانتهاء 05/2028'])?.value).toBe('2028-05-31');
    // A lone date with no marker is never treated as the expiry.
    expect(findExpiry(['MFD 01/2025', '03/2027'])).toBeNull();
  });
});

describe('extractFromLines', () => {
  it('copies name, strength, form, ingredient, frequency, instructions, expiry and manufacturer from the words', () => {
    const result = extractFromLines(IRON);
    expect(scanResultSchema.safeParse(result).success).toBe(true);
    expect(result.fields.name).toBe('Ferrous Sulphate');
    expect(result.fields.dosage).toBe('200 mg');
    expect(result.fields.form).toBe('film-coated tablets');
    expect(result.fields.activeIngredients).toBe('ferrous sulphate 200 mg');
    expect(result.fields.frequency?.toLowerCase()).toBe('daily');
    expect(result.fields.instructions).toBe('Take one tablet daily with food');
    expect(result.fields.expirationDate).toBe('2027-03-31');
    expect(result.fields.manufacturer).toBe('Demo Pharma Ltd');
    expect(result.rawText.split('\n')[0]).toBe('Ferrous Sulphate');
    expect(result.translation).toBeNull();
  });

  it('trusts the name only when it is clearly the most prominent text', () => {
    const prominent = extractFromLines(IRON);
    expect(needsNameConfirmation(prominent)).toBe(false);
    expect(prominent.confidence.name).toBeGreaterThanOrEqual(0.7);

    const flat = extractFromLines(IRON.map((l) => ({ ...l, height: 0.03 })));
    expect(flat.fields.name).toBe('Ferrous Sulphate');
    expect(needsNameConfirmation(flat)).toBe(true);
  });

  it('never invents: an unreadable or empty photo yields nulls and a warning, not a medicine', () => {
    const empty = extractFromLines([]);
    expect(empty.fields.name).toBeNull();
    expect(empty.fields.dosage).toBeNull();
    expect(empty.warnings).toEqual(['NO_TEXT']);

    const blurry = extractFromLines([line('...ol 2..mg', 0.1, 0.05, 0.2), line('(scratched)', 0.3, 0.03, 0.25)]);
    expect(blurry.fields.name).toBeNull();
    expect(blurry.fields.dosage).toBeNull();
    expect(blurry.warnings).toContain('LOW_QUALITY');
    expect(needsNameConfirmation(blurry)).toBe(true);
  });

  it('does not take a manufacturer, a lot number or a number line as the name', () => {
    const result = extractFromLines([
      line('LOT 2209', 0.1, 0.06),
      line('Demo Pharma Ltd', 0.2, 0.06),
      line('500', 0.3, 0.06),
      line('Panadol', 0.5, 0.05),
    ]);
    expect(result.fields.name).toBe('Panadol');
  });

  it('splits "PANADOL 500mg" into name and strength', () => {
    const result = extractFromLines([line('PANADOL 500mg', 0.1, 0.07), line('20 tablets', 0.3)]);
    expect(result.fields.name).toBe('PANADOL');
    expect(result.fields.dosage).toBe('500 mg');
    expect(result.fields.form).toBe('tablets');
  });

  it('feeds the medicine form from the words into the saved medicine', () => {
    const input = scanToMedicationInput(extractFromLines(IRON), { memberId: 'self', imageUri: null });
    expect(input?.name).toBe('Ferrous Sulphate');
    expect(input?.form).toBe('TABLET');
    expect(input?.kind).toBe('SUPPLEMENT');
    expect(input?.labelText).toContain('EXP 03/2027');
  });

  it('orders lines top to bottom, then left to right', () => {
    const ordered = orderLines([line('right', 0.2, 0.03, 0.9, 0.6), line('left', 0.2, 0.03, 0.9, 0.1), line('top', 0.05)]);
    expect(ordered.map((l) => l.text)).toEqual(['top', 'left', 'right']);
  });
});

describe('several photos stacked into one reading', () => {
  it('combines the name from one photo with the ingredients and expiry from another', () => {
    const front: OcrLine[] = [line('Ferrous Sulphate', 0.1, 0.07), line('200 mg', 0.2, 0.04), line('28 tablets', 0.3)];
    const back: OcrLine[] = [
      line('Each tablet contains: ferrous sulphate 200 mg', 0.1),
      line('Store below 25°C in a dry place', 0.2),
      line('EXP 03/2027  LOT 4471A', 0.3),
      line('Keep out of the sight and reach of children', 0.4),
    ];
    // What OnDeviceScanner does: photo 2's lines are offset by +1 in y.
    const stacked = [...front, ...back.map((l) => ({ ...l, y: l.y + 1 }))];
    const result = extractFromLines(stacked);
    expect(result.fields.name).toBe('Ferrous Sulphate');
    expect(result.fields.dosage).toBe('200 mg');
    expect(result.fields.activeIngredients).toBe('ferrous sulphate 200 mg');
    expect(result.fields.expirationDate).toBe('2027-03-31');
    expect(result.fields.quantity).toBe('28 tablets');
    expect(result.fields.batchNumber).toBe('4471A');
    expect(result.fields.storage).toBe('Store below 25°C in a dry place');
    expect(result.rawText.split('\n')[0]).toBe('Ferrous Sulphate');
    expect(result.rawText).toContain('EXP 03/2027');
    expect(result.differentMedicines).toBe(false);
    expect(result.conflicts).toEqual([]);
  });

  it('reads a printed warning line without taking it for an instruction', () => {
    const result = extractFromLines([line('Panadol', 0.1, 0.06), line('Caution: may cause drowsiness', 0.3)]);
    expect(result.fields.warningsText).toBe('Caution: may cause drowsiness');
    expect(result.fields.instructions).toBeNull();
  });
});
