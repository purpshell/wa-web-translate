import {
  newRpcId,
  TAG,
  type RpcMessage,
  type TranslateRpcRequest,
} from '@/shared/messages';
import type { TranslateRequest, TranslateResult } from '@/shared/types';

interface Pending {
  resolve: (r: TranslateResult) => void;
  reject: (e: Error) => void;
}

const pending = new Map<string, Pending>();

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const data = e.data as RpcMessage | undefined;
  if (!data || (data as unknown as Record<string, unknown>)[TAG] !== true) return;
  if (data.kind !== 'TRANSLATE_RESULT') return;
  const p = pending.get(data.id);
  if (!p) return;
  pending.delete(data.id);
  if (data.ok) p.resolve(data.result);
  else p.reject(new Error(data.error));
});

export function translate(req: TranslateRequest, timeoutMs = 30000): Promise<TranslateResult> {
  const id = newRpcId();
  const msg: TranslateRpcRequest = {
    __waTrans: true,
    kind: 'TRANSLATE_REQUEST',
    id,
    payload: req,
  };
  return new Promise<TranslateResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pending.delete(id)) reject(new Error('Translate request timed out'));
    }, timeoutMs);
    pending.set(id, {
      resolve: (r) => {
        clearTimeout(timer);
        resolve(r);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    window.postMessage(msg, '*');
  });
}
