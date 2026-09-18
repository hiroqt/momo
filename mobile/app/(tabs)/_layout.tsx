import React from 'react';
import { Tabs } from 'expo-router';
import { FloatingNavBar } from '../../components/common/FloatingNavBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingNavBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}
