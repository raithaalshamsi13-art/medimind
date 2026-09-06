/**
 * Typed, validated access to environment configuration.
 *
 * SECURITY (Phase 18): only `EXPO_PUBLIC_*` variables reach the app bundle, and
 * anything in the bundle is readable by anyone who downloads the APK. So the
 * ONLY values allowed here are ones that are safe to publish:
 *
 *   - Supabase project URL + anon key  → safe by design; the anon key is a
 *     public client key and every table is protected by Row Level Security.
 *   - Scan endpoint URL                → just a URL.
 *
 * The Anthropic API key is deliberately absent. It lives as a secret on the
 * Railway API server (`server/`) and never touches the device.
 */

function optional(value: string | undefined): string | null {
  return value !== undefined && value.trim().length > 0 ? value.trim() : null;
}

export const env = {
  supabaseUrl: optional(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: optional(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  /** URL of the API endpoint that performs AI label extraction (Milestone 4). */
  scanEndpoint: optional(process.env.EXPO_PUBLIC_SCAN_ENDPOINT),
  /** URL of the API endpoint that answers assistant questions, e.g. https://<railway-domain>/assistant */
  assistantEndpoint: optional(process.env.EXPO_PUBLIC_ASSISTANT_ENDPOINT),
  /**
   * Shared access key sent to the assistant server as `x-app-key`. This is
   * abuse mitigation (stops random internet traffic spending the AI budget),
   * NOT authentication — it ships in the bundle and is therefore public.
   */
  assistantAccessKey: optional(process.env.EXPO_PUBLIC_ASSISTANT_ACCESS_KEY),
} as const;

/** Cloud auth + sync are available. When false, the app runs fully offline. */
export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/** A real AI scanner is reachable. When false, we fall back to the mock. */
export const isRealScannerConfigured = Boolean(env.scanEndpoint);

/** The Claude-backed assistant proxy is reachable. When false, the offline assistant answers. */
export const isAssistantConfigured = Boolean(env.assistantEndpoint);

/** True in `expo start`, false in a production build. */
export const isDev = __DEV__;
