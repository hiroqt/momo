import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { usePathname, useSegments } from 'expo-router';
import { BackHandler } from 'react-native';
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

export default function TabsLayout() {
  const pathname = usePathname();
  const segments = useSegments();

  // Compute route target index from external navigation / deep links
  const routeTargetIndex = useMemo(() => {
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

  const [activeTab, setActiveTab] = useState(routeTargetIndex);

  // Sync activeTab when external navigation changes the URL
  useEffect(() => {
    setActiveTab(routeTargetIndex);
  }, [routeTargetIndex]);

  // Handle tab change from internal swipe or floating navbar press:
  // All 4 tabs are rendered internally inside InteractiveTabPager.
  // We do NOT call router.replace() here because calling router.replace() triggers
  // react-native-screens fragment replacement on Android, which detaches views and causes a screen flicker.
  const handleTabChange = useCallback((newIndex: number) => {
    setActiveTab(newIndex);
  }, []);

  // Handle Android hardware back button: return to Home (tab 0) if on another tab
  useEffect(() => {
    const onBackPress = () => {
      if (activeTab !== 0) {
        setActiveTab(0);
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeTab]);

  return (
    <InteractiveTabPager
      pages={PAGES}
      activeIndex={activeTab}
      onTabChange={handleTabChange}
    />
  );
}

