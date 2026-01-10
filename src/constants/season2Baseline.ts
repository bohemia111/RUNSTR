/**
 * Season II Baseline Totals - Generated 2026-01-08T12:33:03.475Z
 *
 * Pre-computed workout totals from Season II start (Jan 1, 2026)
 * until the baseline timestamp. App only fetches workouts AFTER this.
 *
 * Stats: 193 unique events, 165 valid workouts
 */

export const BASELINE_TIMESTAMP = 1767875581; // 2026-01-08T12:33:01.000Z

export interface ActivityTotals {
  distance: number; // km
  duration: number; // seconds
  count: number;
}

export interface UserBaseline {
  running: ActivityTotals;
  walking: ActivityTotals;
  cycling: ActivityTotals;
}

export const SEASON2_BASELINE: Record<string, UserBaseline> = {
  // TheWildHustle
  '30ceb64e73197a05958c8bd92ab079c815bb44fbfbb3eb5d9766c5207f08bdf5': {
    running: { distance: 26.28, duration: 8342, count: 3 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // guy
  '745eb529d0e42d2fa6c904bbc2c10702deae964b4dd3079803ab8b43536dda12': {
    running: { distance: 87.07, duration: 35240, count: 10 },
    walking: { distance: 13.9, duration: 11711, count: 6 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Lhasa Sensei
  'dae73fdd90d98db1a8405bcecac60cd6ce8d10896a6a2c5e04011125e16cd432': {
    running: { distance: 25.63, duration: 11190, count: 1 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // LOPES
  '43256bc0859462cf14fa7de594a48babdf189b91abe27f88d824abf69b2343c9': {
    running: { distance: 45.04, duration: 18263, count: 15 },
    walking: { distance: 2.21, duration: 2373, count: 3 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // KjetilR
  'e7df627c638d934b37548d8408b43dc5d4762fa270c26abec5916bff62aac80d': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 41.76, duration: 27846, count: 9 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // JokerHasse
  '6b42a3b227b086e850ff659a151863ce070eb60d32bae8a4618928655effc3f6': {
    running: { distance: 83.07, duration: 38264, count: 7 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Busch21
  '0c252c138ee446b6f9c0964ff609380fc82e52c8d318529607f293fcdf828bea': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 6.39, duration: 3271, count: 1 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Hoov
  'c8b22b81877eaa54e1ab21e39824f85a29e61f71da9fbabbef8930b171b98da8': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 20.64, duration: 15008, count: 4 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // MAKE SONGS LONGER
  '9fce3aea32b35637838fb45b75be32595742e16bb3e4742cc82bb3d50f9087e6': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 0.0, duration: 172, count: 1 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Helen Yrmom (removed duplicate 10.15km walk on Jan 4)
  'e5237023a5c0929e7ae0e5128d41a8213138400ec110dbe9d8a29278f22b7c13': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 60.85, duration: 324428, count: 20 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // bitcoin_rene
  '02734f19cae7850e7bca6c0a2bb6a534f152d5acbd86eece1d2bfbd5d6502003': {
    running: { distance: 8.91, duration: 3709, count: 1 },
    walking: { distance: 31.1, duration: 25514, count: 6 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Drew
  '5a654b6394bb83ecc1b95f848d6bc44e6d21120de5d832040704d9823b2c0af4': {
    running: { distance: 8.15, duration: 2766, count: 2 },
    walking: { distance: 2.27, duration: 5143, count: 2 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Heiunter
  '5d405752c1b4ddd0714baf3ce415db52e5506036f345ff575ee16e2b4cf189bf': {
    running: { distance: 34.06, duration: 11511, count: 3 },
    walking: { distance: 7.88, duration: 6336, count: 2 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Uno
  'a80fc4a78634ee26aabcac951b4cfd7b56ae18babd33c5afdcf6bed6dc80ebd1': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 12.94, duration: 88052, count: 4 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Seth
  'a723805cda67251191c8786f4da58f797e6977582301354ba8e91bcb0342dc9c': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 3.78, duration: 3014, count: 1 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // means (removed suspicious 48.86km/12hr walk with round timestamp)
  'fad80b7451b03f686fd9e487b05b69c04c808e26a1db655e59e0e296a5c9f4dd': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 34.49, duration: 34348, count: 9 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // negr0
  '20d29810d6a5f92b045ade02ebbadc9036d741cc686b00415c42b4236fe4ad2f': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 11.28, duration: 87602, count: 4 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // johnny9
  'ea28488b659ab6433167cd024eb72e01a375ac17ce54a1cdc6e5dce2f6d93923': {
    running: { distance: 37.87, duration: 17237, count: 6 },
    walking: { distance: 5.42, duration: 6584, count: 3 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Tumbleweed
  'c6f0f4279f12200f77e1943cd26aaedf6081fda8585695f9a923b4723686da12': {
    running: { distance: 8.66, duration: 3244, count: 2 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Ajax
  '661305095522a18a1095b7b86874ef618da9c5d1ba5f4af375688e2129c07317': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 7.53, duration: 3192, count: 3 },
  },
  // Patrick
  '0f563fe2cfdf180cb104586b95873379a0c1fdcfbc301a80c8255f33d15f039d': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 3.25, duration: 3036, count: 2 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // ObjectiF MooN
  'd84517802a434757c56ae8642bffb4d26e5ade0712053750215680f5896e579b': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 4.73, duration: 448114, count: 8 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Aaron Tomac
  '81b91540daeee031df309460a9bcf5866a54c70217ff173bcdefd1982f12b0ba': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 9.1, duration: 15482, count: 7 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Adrien Lacombe
  '7ebbce1843a17cd778a5e169e3d2f679f5ac7b5125d1c43d265e190f7b27538c': {
    running: { distance: 42.2, duration: 17589, count: 5 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Taljarn
  '86f7eea066dd4dc574d01b0f9317a03508887f815fb58d8ef66873cc42fe3431': {
    running: { distance: 16.22, duration: 7010, count: 2 },
    walking: { distance: 0.0, duration: 270413, count: 4 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // saiy2k
  '0418ca2d6cd6c7fbc4e0391bb745027023a7edbc38f2a60fc3b68f006efb85eb': {
    running: { distance: 17.85, duration: 7856, count: 4 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // OrangePillosophy
  '556329e4245ec4889c33b29262c85335a082c2e25cd08b69ff46e17e70b785ec': {
    running: { distance: 0.0, duration: 0, count: 0 },
    walking: { distance: 4.84, duration: 4885, count: 2 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
  // Jose Sammut
  '24b45900a92fbc4527ccf975bd416988e444c6e4d9f364c5158667f077623fe2': {
    running: { distance: 4.96, duration: 1370, count: 1 },
    walking: { distance: 0.0, duration: 0, count: 0 },
    cycling: { distance: 0.0, duration: 0, count: 0 },
  },
};

/**
 * Get baseline totals for a user
 * Returns zeros for users not in baseline (new participants)
 */
export function getBaselineTotals(pubkey: string): UserBaseline {
  const baseline = SEASON2_BASELINE[pubkey];
  if (baseline) {
    return baseline;
  }
  // Return zeros for users not in baseline
  return {
    running: { distance: 0, duration: 0, count: 0 },
    walking: { distance: 0, duration: 0, count: 0 },
    cycling: { distance: 0, duration: 0, count: 0 },
  };
}

// ============================================================================
// CHARITY BASELINE - Generated by scripts/generate-charity-baseline.ts
// ============================================================================

export interface CharityActivityTotals {
  distance: number;  // km
  participantCount: number;
}

export interface CharityBaseline {
  charityId: string;
  running: CharityActivityTotals;
  walking: CharityActivityTotals;
  cycling: CharityActivityTotals;
}

/**
 * Season II Charity Baseline
 *
 * Charity distance totals aggregated from Season II start until baseline date.
 * Run `npx tsx scripts/generate-charity-baseline.ts` to regenerate.
 */
export const SEASON2_CHARITY_BASELINE: CharityBaseline[] = [
  // Will be populated by running scripts/generate-charity-baseline.ts
  // Empty by default - no default charity assignment
];
