/**
 * From recognised lines of printed text to a `ScanResult` — the on-device
 * half of SCAN, used with Apple Vision (`modules/label-ocr`).
 *
 * This is text recognition, not medicine recognition. Every rule below only
 * ever copies words that are printed on the label:
 *
 *   dosage       the first strength with a unit ("500 mg", "10 mg/5 ml")
 *   form         a printed form word ("film-coated tablets")
 *   expiry       a date that follows an EXP / Expiry / Use by marker — a date
 *                without that marker is ignored, so a lot or manufacture
 *                date is never mistaken for the expiry
 *   ingredients  only after "contains" / "active ingredient(s)" / "each …"
 *   frequency    a printed timing phrase ("every 6 hours", "twice daily")
 *   instructions a printed direction ("do not take more than…", "with food")
 *   name         the most prominent line of letters that is none of the
 *                above. Vision tells us how tall each line is; the brand name
 *                is almost always the tallest text on the front of a pack.
 *                It is trusted (confidence ≥ 0.7, so the medicine is added
 *                automatically) only when it is clearly taller than the rest
 *                AND Vision read it confidently. Otherwise it is offered at
 *                0.5 and the user confirms it — the app never guesses.
 *
 * Nothing here checks what a medicine is, whether it is safe, or how much to
 * take. The screen says so.
 */

import type { OcrLine } from '../../modules/label-ocr';
import { isRealCalendarDate } from './medication';
import type { ScanResult } from './scan';

/** Lines Vision read below this are not used for any field (text is still shown). */
const MIN_LINE_CONFIDENCE = 0.3;
/** The name is trusted when its text is this much taller than the median line. */
const NAME_PROMINENCE = 1.3;
/** Confidence given to a name that was found but is not clearly prominent. */
const UNSURE_NAME_CONFIDENCE = 0.5;

const STRENGTH =
  /(\d+(?:[.,]\d+)?)\s?(mg|mcg|µg|μg|g|ml|mL|IU|iu|%|units?)\b(?:\s?\/\s?(\d+(?:[.,]\d+)?)\s?(ml|mL|g|dose|tablet|capsule|actuation))?/u;

const FORM_WORD =
  /\b(film[- ]coated tablets?|chewable tablets?|effervescent tablets?|tablets?|caplets?|capsules?|softgels?|oral (?:solution|suspension|drops)|suspension|syrup|solution|drops?|cream|ointment|gel|lotion|inhaler|nasal spray|spray|patch(?:es)?|injection|ampoules?|vials?|sachets?|powder)\b/i;

const EXPIRY_MARKER = /(?:\bEXP(?:IRY|IRES|IRATION)?\b\.?\s*(?:DATE)?|\bUSE\s+BY\b|\bBEST\s+BEFORE\b|انتهاء(?:\s*الصلاحية)?|تاريخ\s*الانتهاء)\s*[:.\-]?\s*/i;
const DATE_AFTER_MARKER =
  /(\d{4})[\/\-.](\d{1,2})(?:[\/\-.](\d{1,2}))?|(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})|(\d{1,2})[\/\-.](\d{4})|([A-Za-z]{3,9})[\s\-.]?(\d{4})|(\d{1,2})\s?([A-Za-z]{3,9})[\s\-.]?(\d{2,4})/;

const INGREDIENT_MARKER = /(?:\bcontains\b|\bactive ingredients?\b|\beach (?:tablet|capsule|5\s?ml|dose|sachet|ml)\s+contains\b|\bcomposition\b|المادة الفعالة|يحتوي)\s*[:.\-]?\s*(.+)/i;

const FREQUENCY =
  /\b(?:(?:once|twice|three times|four times|[1-4]\s?x)\s+(?:a|per)?\s*(?:day|daily)|every\s+\d+(?:\s?(?:to|-|–)\s?\d+)?\s+hours?|(?:once|twice)\s+daily|daily|at bedtime|as needed|when required)\b/i;

const INSTRUCTION =
  /\b(?:do not (?:take|exceed|use) more than[^.\n]*|do not exceed[^.\n]*|take [^.\n]*?(?:with|after|before) (?:food|meals?|water)[^.\n]*|with (?:food|meals?)\b[^.\n]*|swallow whole[^.\n]*|do not crush[^.\n]*|shake well[^.\n]*|for external use only|not to be taken[^.\n]*|keep out of (?:the )?(?:sight and )?reach of children)/i;

const MANUFACTURER = /\b(?:ltd|limited|inc|gmbh|plc|llc|s\.?a\.?|pharma(?:ceuticals?)?|laboratories|labs|manufactured by|marketed by|made in)\b/i;

/** Lines that are never a medicine name. */
const NOT_A_NAME =
  /^\s*(?:\d[\d\s.,/]*|lot|batch|b\.?n\.?|mfg|mfd|exp|expiry|store|keep|read|see|warning|caution|directions|dosage|dose|use|for|each|contains|net|contents?|www\.|http|©|®|™)\b/i;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function fullYear(text: string): number {
  const n = Number(text);
  return text.length === 2 ? 2000 + n : n;
}

/** Turn a printed expiry into yyyy-MM-dd (month-only → last day of that month); null when it is not a real date. */
export function parsePrintedDate(text: string): string | null {
  const m = DATE_AFTER_MARKER.exec(text);
  if (!m) return null;
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  if (m[1]) {
    year = Number(m[1]);
    month = Number(m[2]);
    day = m[3] ? Number(m[3]) : null;
  } else if (m[4]) {
    // dd/mm/yyyy — day-first, as printed in the UAE, UK and most of the world.
    day = Number(m[4]);
    month = Number(m[5]);
    year = fullYear(m[6]!);
    if (month > 12 && day <= 12) [day, month] = [month, day];
  } else if (m[7]) {
    month = Number(m[7]);
    year = Number(m[8]);
  } else if (m[9]) {
    month = MONTHS[m[9].toLowerCase()] ?? null;
    year = Number(m[10]);
  } else if (m[11]) {
    day = Number(m[11]);
    month = MONTHS[m[12]!.toLowerCase()] ?? null;
    year = fullYear(m[13]!);
  }

  if (!year || !month || month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  const d = day ?? lastDayOfMonth(year, month);
  const iso = `${year}-${pad(month)}-${pad(d)}`;
  return isRealCalendarDate(iso) ? iso : null;
}

/** The expiry printed after an EXP / Expiry / Use by marker, searching the next line too. */
export function findExpiry(lines: readonly string[]): { value: string; lineIndex: number } | null {
  for (let i = 0; i < lines.length; i += 1) {
    const marker = EXPIRY_MARKER.exec(lines[i]!);
    if (!marker) continue;
    const after = lines[i]!.slice(marker.index + marker[0].length);
    const candidate = parsePrintedDate(after) ?? (lines[i + 1] ? parsePrintedDate(lines[i + 1]!) : null);
    if (candidate) return { value: candidate, lineIndex: i };
  }
  return null;
}

function normaliseStrength(match: RegExpExecArray): string {
  const unit = match[2]!.replace('μg', 'mcg').replace('µg', 'mcg').replace('iu', 'IU').replace('mL', 'ml');
  const amount = match[1]!.replace(',', '.');
  const per = match[3] ? `/${match[3]!.replace(',', '.')} ${match[4]!.replace('mL', 'ml')}` : '';
  return `${amount} ${unit}${per}`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Reading order: top to bottom, then left to right. */
export function orderLines(lines: readonly OcrLine[]): OcrLine[] {
  return [...lines].sort((a, b) => (Math.abs(a.y - b.y) < 0.012 ? a.x - b.x : a.y - b.y));
}

export function extractFromLines(input: readonly OcrLine[]): ScanResult {
  const lines = orderLines(input).filter((line) => line.text.trim().length > 0);
  const texts = lines.map((line) => line.text.trim());
  const rawText = texts.join('\n');
  const usable = lines.filter((line) => line.confidence >= MIN_LINE_CONFIDENCE);

  const fields: ScanResult['fields'] = {
    name: null,
    dosage: null,
    frequency: null,
    instructions: null,
    expirationDate: null,
    manufacturer: null,
    activeIngredients: null,
    form: null,
  };
  const confidence: ScanResult['confidence'] = { name: 0, dosage: 0, frequency: 0, instructions: 0, expirationDate: 0 };
  const warnings: string[] = [];
  const taken = new Set<number>();

  // Expiry — only after a printed marker.
  const expiry = findExpiry(texts);
  if (expiry) {
    fields.expirationDate = expiry.value;
    confidence.expirationDate = Math.min(0.95, lines[expiry.lineIndex]!.confidence);
    taken.add(expiry.lineIndex);
  }

  // Strength, form, ingredients, frequency, instructions, manufacturer.
  usable.forEach((line) => {
    const index = lines.indexOf(line);
    const text = line.text.trim();

    if (fields.dosage === null) {
      const m = STRENGTH.exec(text);
      if (m) {
        fields.dosage = normaliseStrength(m);
        confidence.dosage = Math.min(0.95, line.confidence);
      }
    }
    if (fields.form === null) {
      const m = FORM_WORD.exec(text);
      if (m) fields.form = m[1]!;
    }
    if (fields.activeIngredients === null) {
      const m = INGREDIENT_MARKER.exec(text);
      if (m && m[1]!.trim().length > 1) {
        fields.activeIngredients = m[1]!.trim().replace(/[.;]$/, '');
        taken.add(index);
      }
    }
    if (fields.frequency === null) {
      const m = FREQUENCY.exec(text);
      if (m) {
        fields.frequency = m[0];
        confidence.frequency = Math.min(0.9, line.confidence);
        taken.add(index);
      }
    }
    if (fields.instructions === null) {
      const m = INSTRUCTION.exec(text);
      if (m) {
        fields.instructions = m[0].trim().replace(/[.;]$/, '');
        confidence.instructions = Math.min(0.9, line.confidence);
        taken.add(index);
      }
    }
    if (fields.manufacturer === null && MANUFACTURER.test(text) && !STRENGTH.test(text)) {
      fields.manufacturer = text;
      taken.add(index);
    }
  });

  // Name — the most prominent remaining line of letters.
  const candidates = usable
    .map((line) => ({ line, index: lines.indexOf(line) }))
    .filter(({ line, index }) => {
      const text = line.text.trim();
      if (taken.has(index)) return false;
      if (text.length < 3 || text.length > 60) return false;
      if (NOT_A_NAME.test(text)) return false;
      if (MANUFACTURER.test(text)) return false;
      const letters = (text.match(/\p{L}/gu) ?? []).length;
      return letters >= Math.max(3, text.length * 0.5);
    });

  if (candidates.length > 0) {
    const tallest = candidates.reduce((best, c) => (c.line.height > best.line.height ? c : best));
    const typical = median(lines.map((l) => l.height));
    let name = tallest.line.text.trim();
    // "PANADOL 500mg" — the strength is already its own field.
    if (fields.dosage) name = name.replace(STRENGTH, '').replace(/\s{2,}/g, ' ').trim();
    if (name.length >= 2) {
      fields.name = name;
      const prominent = typical > 0 && tallest.line.height >= typical * NAME_PROMINENCE;
      confidence.name = prominent ? Math.min(0.9, tallest.line.confidence) : Math.min(UNSURE_NAME_CONFIDENCE, tallest.line.confidence);
    }
  }

  if (lines.length === 0) {
    warnings.push('NO_TEXT');
  } else if (usable.length < Math.max(1, Math.ceil(lines.length / 2))) {
    warnings.push('LOW_QUALITY');
  }

  return { rawText, fields, confidence, warnings, translation: null };
}
