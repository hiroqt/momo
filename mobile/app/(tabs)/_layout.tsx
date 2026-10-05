import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingNavBar } from '@/components/common/FloatingNavBar';
import { colors } from '@/constants/theme';

/** Use the router's tab state so deep links and Back restore the visible page. */
export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="initialRoute"
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        animation: 'none',
        lazy: true,
        sceneStyle: { backgroundColor: colors.background },
      }}
      tabBar={props => <FloatingNavBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="library" options={{ title: 'Library' }} />
      <Tabs.Screen name="shop" options={{ title: 'Shop' }} />
      <Tabs.Screen name="profile" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
