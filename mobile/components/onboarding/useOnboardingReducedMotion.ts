import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

/** Reanimated's startup snapshot plus live OS updates and foreground refresh. */
export function useOnboardingReducedMotion() {
  const startupValue = useReducedMotion();
  const [enabled, setEnabled] = useState(startupValue);
  useEffect(() => {
    let mounted = true;
    let revision = 0;
    const refresh = () => {
      const requestRevision = ++revision;
      AccessibilityInfo.isReduceMotionEnabled().then((value) => {
        if (mounted && requestRevision === revision) setEnabled(value);
      }).catch(() => {});
    };
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      revision++;
      setEnabled(value);
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    refresh();
    return () => { mounted = false; revision++; motion.remove(); app.remove(); };
  }, []);
  return enabled;
}
