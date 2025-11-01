// MUST BE FIRST - Apply all global polyfills for React Native
import './src/utils/applyGlobalPolyfills';

// Additional polyfill for WebView crypto (needed for NWC)
import 'react-native-webview-crypto';

import { registerRootComponent } from 'expo';
import App from './src/App';

// Register background location tasks BEFORE app initialization
// This ensures TaskManager knows about the background tasks on both iOS and Android
import './src/services/activity/BackgroundLocationTask'; // Legacy task (still used by old tracker)
import './src/services/activity/SimpleRunTrackerTask'; // NEW: Simple tracker task

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);