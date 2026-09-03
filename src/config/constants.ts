/** Static app-wide values. No logic here. */

export const APP_NAME = 'MediMind';

export const APP_TAGLINE = 'Check the medicine first. Then remind the user.';

/** The descriptor that sits under the wordmark in the logo lockup. */
export const APP_LOGO_TAGLINE = 'Health & Medication Reminder';

/**
 * The five stages of the MediMind workflow. This is the app's core idea and it
 * drives the navigation and the demo script.
 */
export const WORKFLOW_STEPS = ['Scan', 'Check', 'Confirm', 'Remind', 'Track'] as const;

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

/**
 * Shown on the About screen, during onboarding, and next to every AI-extracted
 * result. Required by the project's medical-safety rule: MediMind organises
 * what is printed on a label, it does not practise medicine.
 */
export const MEDICAL_DISCLAIMER =
  'MediMind is an informational medication-management and reminder tool. It helps you read ' +
  'and organise what is printed on a medicine label. It does not diagnose conditions, ' +
  'prescribe medication, or replace advice from a doctor or pharmacist. Always follow the ' +
  'instructions on your medication label, and speak to a healthcare professional if you are ' +
  'unsure about anything.';

/** Short version, used inline under scan results where space is tight. */
export const MEDICAL_DISCLAIMER_SHORT =
  'MediMind reads the label — it does not give medical advice. Always check with a pharmacist ' +
  'or doctor if you are unsure.';
