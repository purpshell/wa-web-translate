// Anti-ban: zero out the WebcFingerprint extension fields that WhatsApp's WAM telemetry
// would otherwise emit. Modeled after the existing wa-logger hook.
//
// MUST be installed before any other WA-internal hook so the wrapper is in place when
// WhatsApp's bundle constructs its event registry.

import { injectToFunction } from '../wa';

export function installWamScrub(): boolean {
  return injectToFunction(
    { module: 'WAWebWamCodegenUtils', function: 'defineEvents' },
    (orig, ...args: any[]) => {
      const ctor = orig(...args);
      if (typeof ctor !== 'function') return ctor;
      return new Proxy(ctor as new (...a: any[]) => any, {
        construct(target, a, newTarget) {
          const inst = Reflect.construct(target, a, newTarget);
          try {
            const name = inst?.$className || (target as any).name;
            if (name === 'WebcFingerprint' && inst?.all) {
              inst.all.extentionIds = '';
              inst.all.externalSources = '';
            }
          } catch {}
          return inst;
        },
      });
    },
  );
}
