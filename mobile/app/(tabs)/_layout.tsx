import React, { useMemo, useCallback } from 'react';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { InteractiveTabPager, TabPageConfig } from '../../components/common/InteractiveTabPager';
import HomeScreen from './index';
import LibraryScreen from './library';
import ProfileScreen from './profile';

const PAGES: TabPageConfig[] = [
  { key: 'index', component: HomeScreen },
  { key: 'library', component: LibraryScreen },
  { key: 'profile', component: ProfileScreen },
];

const ROUTE_MAP: Record<string, number> = {
  index: 0,
  library: 1,
  profile: 2,
};

const INDEX_TO_ROUTE: Record<number, string> = {
  0: '/(tabs)',
  1: '/(tabs)/library',
  2: '/(tabs)/profile',
};

export default function TabsLayout() {
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();

  const activeIndex = useMemo(() => {
    const segs = (segments || []) as string[];
    if (segs[0] === '(tabs)') {
      const tabName = segs[1] || 'index';
      return ROUTE_MAP[tabName] ?? 0;
    }
    if (pathname.includes('library')) return 1;
    if (pathname.includes('profile')) return 2;
    return 0;
  }, [segments, pathname]);

  const handleTabChange = useCallback(
    (newIndex: number) => {
      const targetRoute = INDEX_TO_ROUTE[newIndex];
      if (targetRoute) {
        router.replace(targetRoute as any);
      }
    },
    [router]
  );

  return (
    <InteractiveTabPager
      pages={PAGES}
      activeIndex={activeIndex}
      onTabChange={handleTabChange}
    />
  );
}
