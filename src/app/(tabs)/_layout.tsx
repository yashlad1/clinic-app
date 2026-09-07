import React from 'react';
import { Tabs } from 'expo-router';
import { color, touch, type, weight } from '../../ui/tokens';

/**
 * Three tabs, with labels ALWAYS visible. Two would work, but separating Stock
 * from Give Dose prevents mis-tapping "I gave a dose" for "I received stock" -
 * a mix-up that corrupts the ledger in the opposite direction and is hard to
 * spot later.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textMuted,
        tabBarShowLabel: true,
        tabBarStyle: { height: touch.tabBar, paddingBottom: 8, paddingTop: 6, borderTopColor: color.border },
        tabBarLabelStyle: { fontSize: type.min, fontWeight: weight.semibold },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Give dose' }} />
      <Tabs.Screen name="stock" options={{ title: 'Stock' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
