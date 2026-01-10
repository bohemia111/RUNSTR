/**
 * Screen Configurations
 * Animation configs and screen options for React Navigation
 *
 * ✅ PERFORMANCE FIX: Using native driver animations instead of JS interpolators
 * Native animations run on the UI thread, not blocking the JS thread
 */

import { StackNavigationOptions } from '@react-navigation/stack';
import { TransitionPresets } from '@react-navigation/stack';

// ✅ PERFORMANCE: Use native transition presets instead of custom JS interpolators
// These use the native driver and don't block the JavaScript thread
const slideFromRightAnimation = {
  ...TransitionPresets.SlideFromRightIOS,
  cardStyle: { backgroundColor: '#000' }, // Prevents white flash
};

const modalSlideFromBottomAnimation = {
  ...TransitionPresets.ModalSlideFromBottomIOS,
  cardStyle: { backgroundColor: '#000' }, // Prevents white flash
};

// Screen-specific configurations
export const screenConfigurations = {
  // Main Team Screen - no animation for instant load
  Team: {
    animationEnabled: false,
    headerShown: false,
  } as StackNavigationOptions,

  // Profile Screen - slide from right
  Profile: {
    animationEnabled: true,
    ...slideFromRightAnimation,
  } as StackNavigationOptions,

  // Wallet Screen - slide from right
  Wallet: {
    animationEnabled: true,
    ...slideFromRightAnimation,
  } as StackNavigationOptions,

  // Captain Dashboard - slide from right
  CaptainDashboard: {
    animationEnabled: true,
    ...slideFromRightAnimation,
  } as StackNavigationOptions,

  // Team Discovery Modal - slide from bottom
  TeamDiscovery: {
    presentation: 'modal' as const,
    animationEnabled: true,
    ...modalSlideFromBottomAnimation,
  } as StackNavigationOptions,

  // Event Detail Screen - slide from right
  EventDetail: {
    animationEnabled: true,
    ...slideFromRightAnimation,
  } as StackNavigationOptions,
};

// Default navigator options
export const defaultScreenOptions: StackNavigationOptions = {
  headerShown: false,
  cardStyle: { backgroundColor: '#000' },
};
