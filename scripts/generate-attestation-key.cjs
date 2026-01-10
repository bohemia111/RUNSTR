/**
 * Generate a new attestation keypair for RUNSTR workout verification
 *
 * This creates a new nsec/npub pair specifically for signing kind 1302
 * attestation events. The npub is public (share with verifiers), the
 * nsec is encrypted and embedded in the app.
 *
 * Usage: node scripts/generate-attestation-key.cjs
 *
 * Output:
 * - Prints npub (save this for verification scripts)
 * - Prints nsec (add to .env as ATTESTATION_NSEC)
 * - Run encrypt-secrets.cjs after adding to .env
 */

const crypto = require('crypto');

// Simple bech32 encoding for nsec/npub
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function bech32Encode(prefix, data) {
  const values = [];

  // Convert bytes to 5-bit groups
  let acc = 0;
  let bits = 0;
  for (const byte of data) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      values.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) {
    values.push((acc << (5 - bits)) & 31);
  }

  // Compute checksum
  const checksum = createChecksum(prefix, values);
  const combined = [...values, ...checksum];

  // Encode to string
  let result = prefix + '1';
  for (const v of combined) {
    result += CHARSET[v];
  }

  return result;
}

function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) {
        chk ^= GEN[i];
      }
    }
  }
  return chk;
}

function hrpExpand(hrp) {
  const result = [];
  for (const c of hrp) {
    result.push(c.charCodeAt(0) >> 5);
  }
  result.push(0);
  for (const c of hrp) {
    result.push(c.charCodeAt(0) & 31);
  }
  return result;
}

function createChecksum(hrp, data) {
  const values = [...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0];
  const mod = polymod(values) ^ 1;
  const result = [];
  for (let i = 0; i < 6; i++) {
    result.push((mod >> (5 * (5 - i))) & 31);
  }
  return result;
}

// secp256k1 curve parameters
const CURVE = {
  P: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'),
  N: BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141'),
  Gx: BigInt('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),
  Gy: BigInt('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8'),
};

function mod(a, b = CURVE.P) {
  const result = a % b;
  return result >= 0n ? result : b + result;
}

function modInverse(a, m = CURVE.P) {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }
  return mod(old_s, m);
}

function pointAdd(p1, p2) {
  if (p1 === null) return p2;
  if (p2 === null) return p1;

  const [x1, y1] = p1;
  const [x2, y2] = p2;

  if (x1 === x2 && y1 === y2) {
    // Point doubling
    const s = mod((3n * x1 * x1) * modInverse(2n * y1));
    const x3 = mod(s * s - 2n * x1);
    const y3 = mod(s * (x1 - x3) - y1);
    return [x3, y3];
  }

  const s = mod((y2 - y1) * modInverse(x2 - x1));
  const x3 = mod(s * s - x1 - x2);
  const y3 = mod(s * (x1 - x3) - y1);
  return [x3, y3];
}

function pointMultiply(k, point = [CURVE.Gx, CURVE.Gy]) {
  let result = null;
  let addend = point;

  while (k > 0n) {
    if (k & 1n) {
      result = pointAdd(result, addend);
    }
    addend = pointAdd(addend, addend);
    k >>= 1n;
  }

  return result;
}

function getPublicKey(privateKeyBytes) {
  const privateKeyBigInt = BigInt('0x' + Buffer.from(privateKeyBytes).toString('hex'));
  const [x, _y] = pointMultiply(privateKeyBigInt);

  // Return x-only pubkey (32 bytes)
  const hex = x.toString(16).padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

function main() {
  console.log('='.repeat(60));
  console.log('RUNSTR Workout Attestation Key Generator');
  console.log('='.repeat(60));
  console.log('');

  // Generate 32 random bytes for private key
  const privateKeyBytes = crypto.randomBytes(32);

  // Derive public key
  const publicKeyBytes = getPublicKey(privateKeyBytes);

  // Encode as nsec and npub
  const nsec = bech32Encode('nsec', privateKeyBytes);
  const npub = bech32Encode('npub', publicKeyBytes);

  console.log('Generated new attestation keypair:');
  console.log('');
  console.log('PUBLIC KEY (share with verifiers):');
  console.log('-'.repeat(60));
  console.log(npub);
  console.log('');
  console.log('Hex pubkey:', publicKeyBytes.toString('hex'));
  console.log('');
  console.log('PRIVATE KEY (add to .env as ATTESTATION_NSEC):');
  console.log('-'.repeat(60));
  console.log(nsec);
  console.log('');
  console.log('='.repeat(60));
  console.log('');
  console.log('Next steps:');
  console.log('1. Add to .env: ATTESTATION_NSEC=' + nsec);
  console.log('2. Run: node scripts/encrypt-secrets.cjs');
  console.log('3. Save the npub for verification scripts');
  console.log('');
  console.log('The npub should be published so external verifiers know');
  console.log('which pubkey signs legitimate RUNSTR attestation events.');
}

main();
