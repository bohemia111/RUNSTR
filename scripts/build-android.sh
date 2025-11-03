#!/bin/bash

echo "🤖 Building Android APK for RUNSTR..."

# 1. Ensure local.properties exists
if [ ! -f "android/local.properties" ]; then
  echo "sdk.dir=$HOME/Library/Android/sdk" > android/local.properties
  echo "✅ Created android/local.properties"
fi

# 2. Set JAVA_HOME
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
echo "✅ Set JAVA_HOME to Android Studio's JDK"

# 3. Clean previous builds
echo "🧹 Cleaning previous builds..."
cd android && ./gradlew clean

# 4. Build release APK
echo "🔨 Building release APK..."
./gradlew assembleRelease

# 5. Check if build succeeded
if [ -f "app/build/outputs/apk/release/app-release.apk" ]; then
  echo "✅ Build successful!"
  echo "📦 APK location: android/app/build/outputs/apk/release/app-release.apk"
  ls -lh app/build/outputs/apk/release/app-release.apk
else
  echo "❌ Build failed!"
  exit 1
fi
