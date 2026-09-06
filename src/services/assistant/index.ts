/**
 * Assistant factory — the only place that decides which implementation runs.
 *
 *   Demo Mode on, or no proxy configured  → OfflineAssistant
 *   Demo Mode off and proxy configured    → ProxyAssistant (Claude)
 *
 * The screen says whether the AI is wanted; the factory knows whether the AI
 * is *possible*. Either can force the offline path, never the reverse.
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
