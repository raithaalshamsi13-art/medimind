/**
 * Assistant factory — the only place that decides which implementation runs.
 *
 *   proxy configured and AI wanted  → ProxyAssistant (Gemini / Groq / Claude via Railway)
 *   otherwise                       → OfflineAssistant
 *
 * The screen says whether the AI is wanted (always, when configured — Demo
 * Mode no longer switches the chat off); the factory knows whether the AI is
 * *possible*. Either can force the offline path, never the reverse. The
 * store also falls back to OfflineAssistant when an AI call fails.
 */

import { isAssistantConfigured } from '@/config/env';

import type { AssistantService } from './AssistantService';
import { OfflineAssistant } from './OfflineAssistant';
import { ProxyAssistant } from './ProxyAssistant';

const offline = new OfflineAssistant();
let proxy: ProxyAssistant | null = null;

export function getAssistantService(preferAi: boolean): AssistantService {
  if (preferAi && isAssistantConfigured) {
    proxy ??= new ProxyAssistant();
    return proxy;
  }
  return offline;
}

export type { AssistantRequest, AssistantService } from './AssistantService';
export { OfflineAssistant } from './OfflineAssistant';
export { ProxyAssistant } from './ProxyAssistant';
