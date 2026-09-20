import React, { useMemo, useCallback } from 'react';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { InteractiveTabPager, TabPageConfig } from '../../components/common/InteractiveTabPager';
import HomeScreen from './index';
import LibraryScreen from './library';
import TabShop from './shop';
import ProfileScreen from './profile';

const PAGES: TabPageConfig[] = [
  { key: 'index', component: HomeScreen },
  { key: 'library', component: LibraryScreen },
  { key: 'shop', component: TabShop },
  { key: 'profile', component: ProfileScreen },
];

const ROUTE_MAP: Record<string, number> = {
  index: 0,
  library: 1,
  shop: 2,
  profile: 3,
};

const INDEX_TO_ROUTE: Record<number, string> = {
  0: '/(tabs)',
  1: '/(tabs)/library',
  2: '/(tabs)/shop',
  3: '/(tabs)/profile',
};

export default function TabsLayout() {
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();

  const activeIndex = useMemo(() => {
    const segs = (segments || []) as string[];
    const path = (pathname || '').toLowerCase();

    // Priority 1: Direct segment inspection & pathname checks for specific non-home tabs
    if (segs.includes('library') || path.includes('library')) return 1;
    if (segs.includes('shop') || path.includes('shop')) return 2;
    if (segs.includes('profile') || path.includes('profile')) return 3;
    if (segs.includes('index') || path.endsWith('/(tabs)') || path === '/') return 0;

    // Priority 2: Structured (tabs) route mapping if child segment is resolved
    if (segs[0] === '(tabs)' && segs[1] && ROUTE_MAP[segs[1]] !== undefined) {
      return ROUTE_MAP[segs[1]];
    }

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
