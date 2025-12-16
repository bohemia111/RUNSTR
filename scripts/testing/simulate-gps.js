/**
 * GPS Validation Simulator
 *
 * Simulates a running workout with realistic GPS data variations
 * to test what percentage of points get rejected by the filtering logic.
 *
 * Usage: node scripts/simulate-gps.js [android|ios]
 */

// Mock Platform for testing (running in Node.js, not React Native)
const mockPlatform = {
  OS: process.argv[2] === 'ios' ? 'ios' : 'android',
};

console.log(`\n🏃 GPS Validation Simulator - Testing ${mockPlatform.OS.toUpperCase()} thresholds\n`);

// Copy of your current thresholds (synced with SimpleRunTrackerTask.ts)
// SIMPLIFIED: Trust GPS hardware more, based on October 2024 implementation
const ACTIVITY_THRESHOLDS = {
  running: {
    maxAccuracy: mockPlatform.OS === 'android' ? 100 : 50,
    maxSpeed: 20, // m/s (~72 km/h) - only reject truly impossible
    maxTeleport: mockPlatform.OS === 'android' ? 150 : 100,
    minDistance: 0.5, // match October's jitter filter
  },
  walking: {
    maxAccuracy: mockPlatform.OS === 'android' ? 100 : 50,
    maxSpeed: 8,
    maxTeleport: mockPlatform.OS === 'android' ? 100 : 60,
    minDistance: 0.5,
  },
  cycling: {
    maxAccuracy: mockPlatform.OS === 'android' ? 100 : 50,
    maxSpeed: 30,
    maxTeleport: mockPlatform.OS === 'android' ? 200 : 150,
    minDistance: 1.0,
  },
};

// Haversine distance calculation (copy from your code)
function calculateDistance(p1, p2) {
  const R = 6371000;
  const φ1 = (p1.latitude * Math.PI) / 180;
  const φ2 = (p2.latitude * Math.PI) / 180;
  const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate realistic GPS data for a simulated run
 */
function generateSimulatedRun(durationMinutes, avgPaceMinPerKm, platform) {
  const points = [];

  // Starting point (arbitrary location)
  let lat = 40.7128;
  let lon = -74.0060;
  let timestamp = Date.now();

  // Calculate meters per second from pace
  const avgSpeedMps = 1000 / (avgPaceMinPerKm * 60); // e.g., 5 min/km = 3.33 m/s

  // Generate a point every 3 seconds (similar to your config)
  const intervalMs = 3000;
  const totalPoints = (durationMinutes * 60 * 1000) / intervalMs;

  for (let i = 0; i < totalPoints; i++) {
    // Simulate realistic GPS accuracy variations
    // iOS typically 5-15m, Android 10-50m with occasional spikes
    let accuracy;
    if (platform === 'ios') {
      accuracy = 5 + Math.random() * 10; // 5-15m
      // Occasional poor signal (10% chance)
      if (Math.random() < 0.1) {
        accuracy = 15 + Math.random() * 10; // 15-25m
      }
    } else {
      // Android - wider range, more variability
      accuracy = 10 + Math.random() * 25; // 10-35m typical
      // 20% chance of poor accuracy (urban canyon, buildings)
      if (Math.random() < 0.2) {
        accuracy = 30 + Math.random() * 30; // 30-60m
      }
      // 5% chance of very poor accuracy
      if (Math.random() < 0.05) {
        accuracy = 50 + Math.random() * 50; // 50-100m
      }
    }

    // Simulate speed variations (±20% of average)
    let speed = avgSpeedMps * (0.8 + Math.random() * 0.4);

    // Occasionally stop (traffic light, etc.) - 5% chance
    if (Math.random() < 0.05) {
      speed = Math.random() * 0.5; // Near standstill
    }

    // Calculate movement
    const distanceThisInterval = speed * (intervalMs / 1000);
    const bearing = Math.random() * 0.2 - 0.1; // Slight direction variations

    // Update position (simplified - moving roughly north)
    lat += (distanceThisInterval * Math.cos(bearing)) / 111000; // 111km per degree
    lon += (distanceThisInterval * Math.sin(bearing)) / (111000 * Math.cos(lat * Math.PI / 180));

    // Simulate GPS jitter (small random offset)
    const jitterLat = (Math.random() - 0.5) * (accuracy / 111000) * 0.5;
    const jitterLon = (Math.random() - 0.5) * (accuracy / 111000) * 0.5;

    points.push({
      latitude: lat + jitterLat,
      longitude: lon + jitterLon,
      accuracy: Math.round(accuracy * 10) / 10,
      speed: Math.round(speed * 100) / 100,
      timestamp: timestamp + i * intervalMs,
    });
  }

  return points;
}

/**
 * Run the validation logic (mimicking SimpleRunTrackerTask.ts)
 */
function validatePoints(points, activityType) {
  const thresholds = ACTIVITY_THRESHOLDS[activityType];
  const accepted = [];
  const rejectionLog = [];

  const stats = {
    totalPoints: points.length,
    accepted: 0,
    rejectedAccuracy: 0,
    rejectedSpeed: 0,
    rejectedTeleport: 0,
    rejectedMinDistance: 0,
    rejectedTooSoon: 0,
  };

  let lastValidPoint = null;

  for (const point of points) {
    // 1. Accuracy check (relaxed - trust GPS hardware)
    if (point.accuracy > thresholds.maxAccuracy) {
      stats.rejectedAccuracy++;
      rejectionLog.push(
        `REJECTED [accuracy]: ${point.accuracy.toFixed(1)}m > ${thresholds.maxAccuracy}m`
      );
      continue;
    }

    // REMOVED: warm-up buffer - first point now counts immediately

    // First valid point
    if (!lastValidPoint) {
      accepted.push(point);
      lastValidPoint = point;
      stats.accepted++;
      continue;
    }

    // 3. Time interval check
    const timeDiff = (point.timestamp - lastValidPoint.timestamp) / 1000;
    if (timeDiff < 1.0) {
      stats.rejectedTooSoon++;
      rejectionLog.push(`REJECTED [too soon]: ${timeDiff.toFixed(2)}s < 1.0s`);
      continue;
    }

    // 4. Calculate distance
    const distance = calculateDistance(
      { latitude: lastValidPoint.latitude, longitude: lastValidPoint.longitude },
      { latitude: point.latitude, longitude: point.longitude }
    );

    // 5. GPS jitter filter (minimum distance)
    if (distance < thresholds.minDistance) {
      // Silent rejection - normal when stationary
      stats.rejectedMinDistance++;
      continue;
    }

    // 6. Teleportation filter
    if (distance > thresholds.maxTeleport) {
      stats.rejectedTeleport++;
      rejectionLog.push(
        `REJECTED [teleport]: ${distance.toFixed(1)}m > ${thresholds.maxTeleport}m`
      );
      continue;
    }

    // 7. Speed validation
    const calculatedSpeed = distance / timeDiff;
    const speed = point.speed || calculatedSpeed;
    if (speed > thresholds.maxSpeed) {
      stats.rejectedSpeed++;
      rejectionLog.push(
        `REJECTED [speed]: ${speed.toFixed(1)} m/s > ${thresholds.maxSpeed} m/s`
      );
      continue;
    }

    // Point passed all checks
    accepted.push(point);
    lastValidPoint = point;
    stats.accepted++;
  }

  return { accepted, stats, rejectionLog };
}

// Run simulation
console.log('='.repeat(60));
console.log('Simulating a 30-minute run at 5:30/km pace...');
console.log('='.repeat(60));

const simulatedPoints = generateSimulatedRun(
  30, // 30 minutes
  5.5, // 5:30 min/km pace
  mockPlatform.OS
);

console.log(`Generated ${simulatedPoints.length} GPS points\n`);

// Show sample of raw data
console.log('Sample of raw GPS data (first 10 points):');
console.log('-'.repeat(60));
simulatedPoints.slice(0, 10).forEach((p, i) => {
  console.log(
    `  ${i + 1}. accuracy: ${p.accuracy.toFixed(1)}m, speed: ${p.speed.toFixed(2)} m/s`
  );
});
console.log('');

// Run validation
const result = validatePoints(simulatedPoints, 'running');

// Print results
console.log('='.repeat(60));
console.log('VALIDATION RESULTS');
console.log('='.repeat(60));
console.log(`
Total Points:     ${result.stats.totalPoints}
Accepted:         ${result.stats.accepted} (${((result.stats.accepted / result.stats.totalPoints) * 100).toFixed(1)}%)
`);

console.log('Rejection Breakdown:');
console.log('-'.repeat(40));
console.log(`  Accuracy too poor:  ${result.stats.rejectedAccuracy} (${((result.stats.rejectedAccuracy / result.stats.totalPoints) * 100).toFixed(1)}%)`);
console.log(`  Speed too fast:     ${result.stats.rejectedSpeed} (${((result.stats.rejectedSpeed / result.stats.totalPoints) * 100).toFixed(1)}%)`);
console.log(`  Teleport jump:      ${result.stats.rejectedTeleport} (${((result.stats.rejectedTeleport / result.stats.totalPoints) * 100).toFixed(1)}%)`);
console.log(`  Too close (jitter): ${result.stats.rejectedMinDistance} (${((result.stats.rejectedMinDistance / result.stats.totalPoints) * 100).toFixed(1)}%)`);
console.log(`  Too soon (<1s):     ${result.stats.rejectedTooSoon} (${((result.stats.rejectedTooSoon / result.stats.totalPoints) * 100).toFixed(1)}%)`);

// Calculate estimated distance
const acceptedTotalDistance = result.accepted.reduce((sum, point, i) => {
  if (i === 0) return 0;
  return sum + calculateDistance(
    { latitude: result.accepted[i - 1].latitude, longitude: result.accepted[i - 1].longitude },
    { latitude: point.latitude, longitude: point.longitude }
  );
}, 0);

const expectedDistance = (30 / 5.5) * 1000; // 30 min at 5.5 min/km

console.log('');
console.log('Distance Analysis:');
console.log('-'.repeat(40));
console.log(`  Expected distance:  ${(expectedDistance / 1000).toFixed(2)} km`);
console.log(`  Recorded distance:  ${(acceptedTotalDistance / 1000).toFixed(2)} km`);
console.log(`  Difference:         ${((acceptedTotalDistance - expectedDistance) / expectedDistance * 100).toFixed(1)}%`);

// Show some rejection examples
if (result.rejectionLog.length > 0) {
  console.log('\nSample Rejections (first 20):');
  console.log('-'.repeat(40));
  result.rejectionLog.slice(0, 20).forEach((log) => {
    console.log(`  ${log}`);
  });

  // Count rejection reasons
  const accuracyRejections = result.rejectionLog.filter(l => l.includes('[accuracy]'));
  if (accuracyRejections.length > 0) {
    console.log(`\n⚠️  ${accuracyRejections.length} points rejected for accuracy > ${ACTIVITY_THRESHOLDS.running.maxAccuracy}m`);
    console.log('   Consider increasing maxAccuracy threshold for Android');
  }
}

console.log('\n' + '='.repeat(60));
console.log('RECOMMENDATION');
console.log('='.repeat(60));

const acceptRate = (result.stats.accepted / result.stats.totalPoints) * 100;
if (acceptRate < 70) {
  console.log(`
❌ PROBLEM: Only ${acceptRate.toFixed(1)}% of GPS points accepted!

This means GPS will appear to "stop" frequently during workouts.
The distance counter will stall for extended periods.

Top issues to fix:
`);

  if (result.stats.rejectedAccuracy > result.stats.totalPoints * 0.1) {
    console.log(`1. ACCURACY THRESHOLD TOO STRICT
   Current: ${ACTIVITY_THRESHOLDS.running.maxAccuracy}m
   Suggestion: Increase to 50m for Android
   Impact: Would accept ${result.stats.rejectedAccuracy} more points
`);
  }

  if (result.stats.rejectedTeleport > result.stats.totalPoints * 0.05) {
    console.log(`2. TELEPORT THRESHOLD TOO STRICT
   Current: ${ACTIVITY_THRESHOLDS.running.maxTeleport}m
   Suggestion: Increase to 80m for Android
`);
  }
} else if (acceptRate < 90) {
  console.log(`
⚠️  MODERATE: ${acceptRate.toFixed(1)}% of GPS points accepted.

This should work but may show occasional distance stalls.
Consider relaxing thresholds slightly.
`);
} else {
  console.log(`
✅ GOOD: ${acceptRate.toFixed(1)}% of GPS points accepted!

Your thresholds look reasonable for ${mockPlatform.OS}.
GPS tracking should work reliably.
`);
}

console.log(`
Run again with different platform:
  node scripts/simulate-gps.js ios
  node scripts/simulate-gps.js android
`);
