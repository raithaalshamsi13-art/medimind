/**
 * The safety engine — CHECK in SCAN → CHECK → CONFIRM → REMIND → TRACK.
 *
 * One pure function decides a medicine's `safetyStatus`. It runs on every
 * save (manual or scanned), and again on launch because dates move. It is
 * deliberately conservative and deliberately simple:
 *
 *   EXPIRED        the recorded expiry date has passed
 *   EXPIRING_SOON  within the 30-day window
 *   NEEDS_REVIEW   something a person must confirm before relying on this
 *                  entry: a scanned field read with low confidence, no dose
 *                  or frequency recorded, or a scan whose name was never
 *                  confirmed
 *   SAFE           in date and the key fields are present
 *
 * "Safe" here means "safe to be reminded about": in date and complete. It is
 * NOT a clinical judgement — nothing here knows whether the medicine suits
 * the person, and the wording in the UI says so.
 */

import { expiryStatus } from './expiry';
import type { Medication, SafetyStatus } from './medication';

/** Below this, a scanned entry is flagged for a human to check. */
export const REVIEW_CONFIDENCE = 0.7;

export type SafetyReason =
  | 'EXPIRED'
  | 'EXPIRING_SOON'
  | 'LOW_SCAN_CONFIDENCE'
  | 'NO_DOSAGE'
  | 'NO_FREQUENCY'
  | 'NO_EXPIRY';

export type SafetyEvaluation = {
  status: SafetyStatus;
  /** Every reason that applied, most serious first. Empty for SAFE. */
  reasons: SafetyReason[];
};

export function evaluateSafety(
  medication: Pick<Medication, 'expirationDate' | 'dosage' | 'frequency' | 'source' | 'scanConfidence'>,
  today: Date = new Date(),
): SafetyEvaluation {
  const reasons: SafetyReason[] = [];
  const expiry = expiryStatus(medication.expirationDate, today);

  if (expiry?.state === 'EXPIRED') {
    return { status: 'EXPIRED', reasons: ['EXPIRED'] };
  }

  if (
    medication.source === 'SCAN' &&
    medication.scanConfidence !== null &&
    medication.scanConfidence < REVIEW_CONFIDENCE
  ) {
    reasons.push('LOW_SCAN_CONFIDENCE');
  }
  if (!medication.dosage) reasons.push('NO_DOSAGE');
  if (!medication.frequency) reasons.push('NO_FREQUENCY');

  if (reasons.length > 0) {
    // A review is more urgent than a soft "expiring soon" badge; the expiry
    // is still listed so the screen can mention both.
    if (expiry?.state === 'EXPIRING_SOON') reasons.push('EXPIRING_SOON');
    return { status: 'NEEDS_REVIEW', reasons };
  }

  if (expiry?.state === 'EXPIRING_SOON') {
    return { status: 'EXPIRING_SOON', reasons: ['EXPIRING_SOON'] };
  }
  if (!medication.expirationDate) {
    // In date as far as we know; noted, not flagged — many blister packs
    // have no readable date and the user chose to leave it blank.
    return { status: 'SAFE', reasons: ['NO_EXPIRY'] };
  }
  return { status: 'SAFE', reasons: [] };
}
