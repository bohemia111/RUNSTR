/**
 * Fitness Age Calculation Verification
 * Tests the 75% VO2 + 25% BMI formula with your actual values
 */

console.log('=== FITNESS AGE CALCULATION TEST ===\n');

// Your actual values
const chronologicalAge = 34;
const vo2Max = 38;
const bmi = 23;

console.log('Input Values:');
console.log(`  Chronological Age: ${chronologicalAge} years`);
console.log(`  VO2 Max: ${vo2Max} ml/kg/min`);
console.log(`  BMI: ${bmi}\n`);

// Men's VO2 max norms by age (from BodyCompositionAnalytics.ts)
const menNorms = {
  20: 47, 25: 46, 30: 44, 35: 43, 40: 42, 45: 40, 50: 39,
  55: 37, 60: 36, 65: 34, 70: 33
};

console.log('VO2 Max Norms for Men:');
Object.entries(menNorms).forEach(([age, vo2]) => {
  const marker = vo2 === vo2Max ? ' ← YOUR VO2 MAX' : '';
  console.log(`  Age ${age}: VO2 ${vo2}${marker}`);
});

// Calculate VO2 Max Age
let vo2Age = chronologicalAge;
let smallestDiff = Infinity;

for (const [ageStr, normVO2] of Object.entries(menNorms)) {
  const age = parseInt(ageStr);
  const diff = Math.abs(normVO2 - vo2Max);

  if (diff < smallestDiff) {
    smallestDiff = diff;
    vo2Age = age;
  }
}

console.log(`\nVO2 Max Age Calculation:`);
console.log(`  Your VO2 ${vo2Max} is closest to age ${vo2Age} (VO2 ${menNorms[vo2Age]})`);
console.log(`  Difference: ${Math.abs(menNorms[vo2Age] - vo2Max)} points`);

// Calculate BMI Age
let bmiAge;
if (bmi >= 18.5 && bmi <= 24.9) {
  bmiAge = chronologicalAge; // Healthy
} else if (bmi >= 25 && bmi < 30) {
  bmiAge = chronologicalAge + 5; // Overweight
} else if (bmi >= 30) {
  bmiAge = chronologicalAge + 10; // Obese
} else {
  bmiAge = chronologicalAge + 3; // Underweight
}

console.log(`\nBMI Age Calculation:`);
console.log(`  BMI ${bmi} is in the HEALTHY range (18.5-24.9)`);
console.log(`  BMI Age: ${bmiAge} years (no adjustment)`);

// Calculate weighted fitness age
const fitnessAge = Math.round((vo2Age * 0.75) + (bmiAge * 0.25));

console.log(`\nWeighted Fitness Age:`);
console.log(`  (VO2 Age × 0.75) + (BMI Age × 0.25)`);
console.log(`  (${vo2Age} × 0.75) + (${bmiAge} × 0.25)`);
console.log(`  ${vo2Age * 0.75} + ${bmiAge * 0.25}`);
console.log(`  = ${fitnessAge} years`);

console.log(`\n=== RESULT ===`);
console.log(`Your Fitness Age: ${fitnessAge} years (Chronological Age: ${chronologicalAge})`);
console.log(`Difference: ${fitnessAge - chronologicalAge > 0 ? '+' : ''}${fitnessAge - chronologicalAge} years`);

// Analysis
console.log(`\n=== ANALYSIS ===`);
console.log(`Why is your fitness age ${fitnessAge} instead of 30-34?`);
console.log('');
console.log(`1. VO2 Max ${vo2Max} maps to age ${vo2Age} in the norms table`);
console.log(`   - This means a typical ${vo2Age}-year-old has VO2 max ${menNorms[vo2Age]}`);
console.log(`   - Your VO2 ${vo2Max} is ${vo2Max - menNorms[vo2Age]} points ${vo2Max > menNorms[vo2Age] ? 'above' : 'below'} that norm`);
console.log('');
console.log(`2. For a 34-year-old, expected VO2 max would be:`);
console.log(`   - Age 35 norm: VO2 ${menNorms[35]}`);
console.log(`   - Your VO2 ${vo2Max} is ${menNorms[35] - vo2Max} points below expected`);
console.log('');
console.log('3. Possible explanations:');
console.log('   a) The norms table may be calibrated for trained athletes, not general population');
console.log('   b) Your 10K time might be slower than 56 minutes (check actual workout data)');
console.log('   c) The VO2 calculation may still need adjustment');
console.log('');

// What VO2 max would give fitness age 34?
console.log('=== TO GET FITNESS AGE 34 ===');
console.log('Working backwards from fitness age 34:');
console.log('  Fitness Age = (VO2 Age × 0.75) + (BMI Age × 0.25)');
console.log('  34 = (VO2 Age × 0.75) + (34 × 0.25)');
console.log('  34 = (VO2 Age × 0.75) + 8.5');
console.log('  25.5 = VO2 Age × 0.75');
console.log('  VO2 Age = 34');
console.log('');
console.log(`  VO2 age 34 corresponds to VO2 max ~${menNorms[35]} (age 35 in norms)`);
console.log(`  You would need VO2 max ~43 to have fitness age 34`);
console.log(`  Current VO2 ${vo2Max} → Deficit of ${43 - vo2Max} points`);
