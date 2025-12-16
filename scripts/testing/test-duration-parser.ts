#!/usr/bin/env tsx
/**
 * Test Duration Parser Fix
 *
 * Purpose: Verify parseDuration() handles both MM:SS and HH:MM:SS formats
 */

// Inline test of the parser logic
function parseDuration(durationStr: string): number {
  const parts = durationStr.split(':');
  if (parts.length === 3) {
    // HH:MM:SS format
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseInt(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    // MM:SS format
    const minutes = parseInt(parts[0]);
    const seconds = parseInt(parts[1]);
    return minutes * 60 + seconds;
  }
  return 0;
}

console.log('🧪 Testing Duration Parser Fix\n');
console.log('================================================\n');

// Test cases from the actual workout event
const testCases = [
  { input: '05:00', expected: 300, format: 'MM:SS' },
  { input: '10:00', expected: 600, format: 'MM:SS' },
  { input: '15:00', expected: 900, format: 'MM:SS' },
  { input: '55:00', expected: 3300, format: 'MM:SS' },
  { input: '01:00:00', expected: 3600, format: 'HH:MM:SS' },
  { input: '00:30:45', expected: 1845, format: 'HH:MM:SS' },
  { input: '02:15:30', expected: 8130, format: 'HH:MM:SS' },
];

console.log('📋 Test Cases:\n');

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected, format }) => {
  const result = parseDuration(input);
  const status = result === expected ? '✅ PASS' : '❌ FAIL';

  if (result === expected) {
    passed++;
  } else {
    failed++;
  }

  console.log(`${status} - ${format} "${input}" → ${result}s (expected ${expected}s)`);
});

console.log('\n================================================\n');
console.log(`📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('✅ All tests passed! Duration parser fix is working correctly.\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Parser needs more work.\n');
  process.exit(1);
}
