/**
 * Expo Config Plugin for Health Connect
 * Adds all required native Android configuration for react-native-health-connect
 *
 * This plugin configures:
 * 1. Health Connect permissions in AndroidManifest.xml
 * 2. Package visibility queries for Health Connect
 * 3. Permission rationale intent filters
 * 4. Activity alias for Android 14+ VIEW_PERMISSION_USAGE
 * 5. HealthConnectPermissionDelegate in MainActivity.kt
 */

const {
  withAndroidManifest,
  withMainActivity,
  AndroidConfig,
} = require('@expo/config-plugins');

// Health Connect permissions to add
const HEALTH_CONNECT_PERMISSIONS = [
  'android.permission.health.READ_EXERCISE',
  'android.permission.health.READ_STEPS',
  'android.permission.health.READ_HEART_RATE',
  'android.permission.health.READ_DISTANCE',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
  'android.permission.health.READ_TOTAL_CALORIES_BURNED',
];

/**
 * Add Health Connect permissions to AndroidManifest.xml
 */
function addHealthConnectPermissions(androidManifest) {
  const manifest = androidManifest.manifest;

  // Ensure permissions array exists
  if (!manifest['uses-permission']) {
    manifest['uses-permission'] = [];
  }

  // Add each Health Connect permission if not already present
  for (const permission of HEALTH_CONNECT_PERMISSIONS) {
    const exists = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === permission
    );

    if (!exists) {
      manifest['uses-permission'].push({
        $: { 'android:name': permission },
      });
    }
  }

  return androidManifest;
}

/**
 * Add Health Connect package to queries for visibility
 */
function addHealthConnectQueries(androidManifest) {
  const manifest = androidManifest.manifest;

  // Ensure queries array exists
  if (!manifest.queries) {
    manifest.queries = [];
  }

  // Check if Health Connect package query already exists
  const hasHealthConnectQuery = manifest.queries.some((query) => {
    if (query.package) {
      return query.package.some(
        (pkg) => pkg.$?.['android:name'] === 'com.google.android.apps.healthdata'
      );
    }
    return false;
  });

  if (!hasHealthConnectQuery) {
    // Find existing queries block or create one
    let queriesBlock = manifest.queries.find((q) => q.package || q.intent);
    if (!queriesBlock) {
      queriesBlock = {};
      manifest.queries.push(queriesBlock);
    }

    // Add package query
    if (!queriesBlock.package) {
      queriesBlock.package = [];
    }

    queriesBlock.package.push({
      $: { 'android:name': 'com.google.android.apps.healthdata' },
    });
  }

  return androidManifest;
}

/**
 * Add permission rationale intent filter to MainActivity
 */
function addPermissionRationaleIntentFilter(androidManifest) {
  const manifest = androidManifest.manifest;
  const application = manifest.application?.[0];

  if (!application) {
    console.warn('withHealthConnect: No application found in manifest');
    return androidManifest;
  }

  // Find MainActivity
  const mainActivity = application.activity?.find(
    (activity) =>
      activity.$?.['android:name'] === '.MainActivity' ||
      activity.$?.['android:name']?.endsWith('.MainActivity')
  );

  if (!mainActivity) {
    console.warn('withHealthConnect: MainActivity not found');
    return androidManifest;
  }

  // Ensure intent-filter array exists
  if (!mainActivity['intent-filter']) {
    mainActivity['intent-filter'] = [];
  }

  // Check if permission rationale intent filter already exists
  const hasRationaleFilter = mainActivity['intent-filter'].some((filter) => {
    return filter.action?.some(
      (action) =>
        action.$?.['android:name'] === 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE'
    );
  });

  if (!hasRationaleFilter) {
    mainActivity['intent-filter'].push({
      action: [
        { $: { 'android:name': 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE' } },
      ],
    });
  }

  return androidManifest;
}

/**
 * Add activity-alias for Android 14+ VIEW_PERMISSION_USAGE
 */
function addViewPermissionUsageAlias(androidManifest) {
  const manifest = androidManifest.manifest;
  const application = manifest.application?.[0];

  if (!application) {
    return androidManifest;
  }

  // Ensure activity-alias array exists
  if (!application['activity-alias']) {
    application['activity-alias'] = [];
  }

  // Check if ViewPermissionUsageActivity alias already exists
  const hasAlias = application['activity-alias'].some(
    (alias) => alias.$?.['android:name'] === 'ViewPermissionUsageActivity'
  );

  if (!hasAlias) {
    application['activity-alias'].push({
      $: {
        'android:name': 'ViewPermissionUsageActivity',
        'android:exported': 'true',
        'android:targetActivity': '.MainActivity',
        'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } },
          ],
          category: [
            { $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } },
          ],
        },
      ],
    });
  }

  return androidManifest;
}

/**
 * Modify AndroidManifest.xml with all Health Connect requirements
 */
const withHealthConnectManifest = (config) => {
  return withAndroidManifest(config, (config) => {
    let androidManifest = config.modResults;

    // Add permissions
    androidManifest = addHealthConnectPermissions(androidManifest);

    // Add package visibility queries
    androidManifest = addHealthConnectQueries(androidManifest);

    // Add permission rationale intent filter
    androidManifest = addPermissionRationaleIntentFilter(androidManifest);

    // Add VIEW_PERMISSION_USAGE activity alias
    androidManifest = addViewPermissionUsageAlias(androidManifest);

    return config;
  });
};

/**
 * Add HealthConnectPermissionDelegate to MainActivity.kt
 */
const withHealthConnectMainActivity = (config) => {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // Check if HealthConnectPermissionDelegate import already exists
    const hasImport = contents.includes('HealthConnectPermissionDelegate');

    if (!hasImport) {
      // Add import statement after the package declaration
      const importStatement =
        'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';

      // Find a good place to add the import (after other imports)
      const lastImportIndex = contents.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfImportLine = contents.indexOf('\n', lastImportIndex);
        contents =
          contents.slice(0, endOfImportLine + 1) +
          importStatement +
          '\n' +
          contents.slice(endOfImportLine + 1);
      }

      // Add HealthConnectPermissionDelegate.setPermissionDelegate(this) in onCreate
      // It should be called BEFORE super.onCreate()
      const onCreateMatch = contents.match(
        /override\s+fun\s+onCreate\s*\(\s*savedInstanceState\s*:\s*Bundle\?\s*\)\s*\{/
      );

      if (onCreateMatch) {
        const onCreateIndex = contents.indexOf(onCreateMatch[0]);
        const insertPosition = onCreateIndex + onCreateMatch[0].length;

        // Check if it's not already added
        if (!contents.includes('HealthConnectPermissionDelegate.setPermissionDelegate')) {
          const delegateCode =
            '\n    // Health Connect permission delegate - must be called before super.onCreate()\n    HealthConnectPermissionDelegate.setPermissionDelegate(this)\n';

          contents =
            contents.slice(0, insertPosition) +
            delegateCode +
            contents.slice(insertPosition);
        }
      }

      config.modResults.contents = contents;
    }

    return config;
  });
};

/**
 * Main plugin function
 */
const withHealthConnect = (config) => {
  // Apply manifest modifications
  config = withHealthConnectManifest(config);

  // Apply MainActivity modifications
  config = withHealthConnectMainActivity(config);

  return config;
};

module.exports = withHealthConnect;
