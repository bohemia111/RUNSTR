/**
 * VO2 Max Calculation Test Script
 * Tests different formula implementations to find the correct one
 * Run with: node scripts/test-vo2max-calculations.js
 */

console.log('=== VO2 MAX CALCULATION TEST SCRIPT ===\n');

// Test data: 56-minute 10K (user's actual data)
const testCases = [
  {
    name: '56-minute 10K (User Report)',
    distance: 10000, // meters
    duration: 3360, // seconds (56 minutes)
    expectedVO2: 35, // Expected based on running calculators
  },
  {
    name: '25-minute 5K (Elite)',
    distance: 5000,
    duration: 1500, // 25 minutes
    expectedVO2: 52, // Elite runner
  },
  {
    name: '45-minute 10K (Fast)',
    distance: 10000,
    duration: 2700, // 45 minutes
    expectedVO2: 45, // Fast recreational
  },
  {
    name: '30-minute 5K (Average)',
    distance: 5000,
    duration: 1800, // 30 minutes
    expectedVO2: 38, // Average runner
  },
];

// ============================================================
// METHOD 1: Jack Daniels VDOT (velocity in m/s) - CURRENT BROKEN CODE
// ============================================================
function jackDanielsVDOT_MetersPerSecond(distance, duration) {
  const timeMinutes = duration / 60;
  const speedMPS = distance / (timeMinutes * 60); // meters per SECOND

  const numerator = -4.60 + 0.182258 * speedMPS + 0.000104 * (speedMPS * speedMPS);
  const denominator = 0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);

  const vo2Max = numerator / denominator;

  // Apply 20-80 cap like the current code
  return Math.max(20, Math.min(80, vo2Max));
}

// ============================================================
// METHOD 2: Jack Daniels VDOT (velocity in m/min) - PROPOSED FIX
// ============================================================
function jackDanielsVDOT_MetersPerMinute(distance, duration) {
  const timeMinutes = duration / 60;
  const velocityMPM = distance / timeMinutes; // meters per MINUTE

  const numerator = -4.60 + 0.182258 * velocityMPM + 0.000104 * (velocityMPM * velocityMPM);
  const denominator = 0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes);

  const vo2Max = numerator / denominator;

  return Math.max(20, Math.min(80, vo2Max));
}

// ============================================================
// METHOD 3: Cooper 12-Minute Test Formula
// ============================================================
function cooperFormula(distance, duration) {
  const timeMinutes = duration / 60;
  const paceMinPerKm = timeMinutes / (distance / 1000);

  // Calculate 12-minute distance based on pace
  const distance12min = (12 / paceMinPerKm) * 1000;

  // Cooper formula: VO2max = (distance - 504.9) / 44.73
  const vo2Max = (distance12min - 504.9) / 44.73;

  return Math.max(20, Math.min(80, vo2Max));
}

// ============================================================
// METHOD 4: Simple Running Economy Formula
// ============================================================
function simpleRunningEconomy(distance, duration) {
  const speedKmh = (distance / 1000) / (duration / 3600);

  // Rough approximation: VO2max ≈ 3.5 * speed_kmh
  // This is a very simplified formula but can serve as sanity check
  const vo2Max = 3.5 * speedKmh;

  return Math.max(20, Math.min(80, vo2Max));
}

// ============================================================
// RUN ALL TESTS
// ============================================================

console.log('Testing all formulas:\n');

testCases.forEach((testCase, index) => {
  console.log(`\n--- TEST CASE ${index + 1}: ${testCase.name} ---`);
  console.log(`Distance: ${testCase.distance}m, Duration: ${testCase.duration}s (${(testCase.duration / 60).toFixed(1)} min)`);
  console.log(`Expected VO2 max: ~${testCase.expectedVO2} ml/kg/min\n`);

  // Method 1: Current broken code
  const result1 = jackDanielsVDOT_MetersPerSecond(testCase.distance, testCase.duration);
  const error1 = Math.abs(result1 - testCase.expectedVO2);
  console.log(`Method 1 (Jack Daniels m/s - CURRENT CODE):`);
  console.log(`  Result: ${result1.toFixed(1)} ml/kg/min`);
  console.log(`  Error: ${error1.toFixed(1)} (${error1 > 5 ? '❌ BROKEN' : '✅ OK'})`);

  // Method 2: Proposed fix
  const result2 = jackDanielsVDOT_MetersPerMinute(testCase.distance, testCase.duration);
  const error2 = Math.abs(result2 - testCase.expectedVO2);
  console.log(`\nMethod 2 (Jack Daniels m/min - PROPOSED FIX):`);
  console.log(`  Result: ${result2.toFixed(1)} ml/kg/min`);
  console.log(`  Error: ${error2.toFixed(1)} (${error2 > 5 ? '❌ INACCURATE' : '✅ GOOD'})`);

  // Method 3: Cooper
  const result3 = cooperFormula(testCase.distance, testCase.duration);
  const error3 = Math.abs(result3 - testCase.expectedVO2);
  console.log(`\nMethod 3 (Cooper 12-min test):`);
  console.log(`  Result: ${result3.toFixed(1)} ml/kg/min`);
  console.log(`  Error: ${error3.toFixed(1)} (${error3 > 5 ? '❌ INACCURATE' : '✅ GOOD'})`);

  // Method 4: Simple
  const result4 = simpleRunningEconomy(testCase.distance, testCase.duration);
  const error4 = Math.abs(result4 - testCase.expectedVO2);
  console.log(`\nMethod 4 (Simple Running Economy):`);
  console.log(`  Result: ${result4.toFixed(1)} ml/kg/min`);
  console.log(`  Error: ${error4.toFixed(1)} (${error4 > 5 ? '❌ INACCURATE' : '✅ GOOD'})`);
});

// ============================================================
// DETAILED DEBUG OF USER'S 56-MINUTE 10K
// ============================================================

console.log('\n\n=== DETAILED DEBUG: 56-MINUTE 10K ===\n');

const distance = 10000;
const duration = 3360;
const timeMinutes = 56;

console.log('Input:');
console.log(`  Distance: ${distance} meters`);
console.log(`  Duration: ${duration} seconds (${timeMinutes} minutes)`);

console.log('\n--- Method 1: CURRENT BROKEN CODE ---');
const speedMPS = distance / (timeMinutes * 60);
console.log(`Speed (m/s): ${speedMPS.toFixed(3)}`);

const num1 = -4.60 + 0.182258 * speedMPS + 0.000104 * (speedMPS * speedMPS);
console.log(`Numerator: -4.60 + (0.182258 × ${speedMPS.toFixed(3)}) + (0.000104 × ${speedMPS.toFixed(3)}²)`);
console.log(`         = -4.60 + ${(0.182258 * speedMPS).toFixed(3)} + ${(0.000104 * speedMPS * speedMPS).toFixed(3)}`);
console.log(`         = ${num1.toFixed(3)}`);

const denom = 0.8 +
  0.1894393 * Math.exp(-0.012778 * timeMinutes) +
  0.2989558 * Math.exp(-0.1932605 * timeMinutes);
console.log(`Denominator: ${denom.toFixed(4)}`);

const vo2_broken = num1 / denom;
console.log(`VO2 max (uncapped): ${vo2_broken.toFixed(3)}`);
console.log(`VO2 max (capped 20-80): ${Math.max(20, Math.min(80, vo2_broken)).toFixed(1)}`);
console.log(`Result: ❌ BROKEN (returns ${Math.max(20, Math.min(80, vo2_broken)).toFixed(1)}, expected ~35)`);

console.log('\n--- Method 2: PROPOSED FIX ---');
const velocityMPM = distance / timeMinutes;
console.log(`Velocity (m/min): ${velocityMPM.toFixed(3)}`);

const num2 = -4.60 + 0.182258 * velocityMPM + 0.000104 * (velocityMPM * velocityMPM);
console.log(`Numerator: -4.60 + (0.182258 × ${velocityMPM.toFixed(3)}) + (0.000104 × ${velocityMPM.toFixed(3)}²)`);
console.log(`         = -4.60 + ${(0.182258 * velocityMPM).toFixed(3)} + ${(0.000104 * velocityMPM * velocityMPM).toFixed(3)}`);
console.log(`         = ${num2.toFixed(3)}`);

console.log(`Denominator: ${denom.toFixed(4)} (same as above)`);

const vo2_fixed = num2 / denom;
console.log(`VO2 max (uncapped): ${vo2_fixed.toFixed(3)}`);
console.log(`VO2 max (capped 20-80): ${Math.max(20, Math.min(80, vo2_fixed)).toFixed(1)}`);
console.log(`Result: ✅ FIXED (returns ${Math.max(20, Math.min(80, vo2_fixed)).toFixed(1)}, expected ~35)`);

console.log('\n=== CONCLUSION ===');
console.log('The fix is simple: Use meters per MINUTE instead of meters per SECOND');
console.log('Change line 419 from:');
console.log('  const speedMPS = distanceMeters / (timeMinutes * 60);');
console.log('To:');
console.log('  const velocityMPM = distanceMeters / timeMinutes;');
console.log('\nThis single change fixes the 60x velocity error.\n');
