const { nip19 } = require('nostr-tools');
const fs = require('fs');
const path = require('path');

// Read the current file
const filePath = path.join(__dirname, '../src/constants/season2.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Extract all pubkey entries and generate correct npubs
const pubkeyRegex = /pubkey: '([a-f0-9]{64})'/g;
let match;
const corrections = [];

while ((match = pubkeyRegex.exec(content)) !== null) {
  const hex = match[1];
  const correctNpub = nip19.npubEncode(hex);
  corrections.push({ hex, correctNpub });
}

console.log('=== GENERATING CORRECT NPUBS ===\n');
console.log(`Found ${corrections.length} pubkeys to fix\n`);

// For each correction, find and replace the npub in the file
let fixCount = 0;
for (const { hex, correctNpub } of corrections) {
  // Find pattern: pubkey: 'HEX',\n    npub: 'WRONG_NPUB',
  const pattern = new RegExp(
    `(pubkey: '${hex}',\\s*\\n\\s*npub: ')(npub1[a-z0-9]+)(',)`,
    'g'
  );

  const oldContent = content;
  content = content.replace(pattern, (match, prefix, oldNpub, suffix) => {
    if (oldNpub !== correctNpub) {
      console.log(`Fixing: ${oldNpub.slice(0, 30)}... -> ${correctNpub.slice(0, 30)}...`);
      fixCount++;
      return prefix + correctNpub + suffix;
    }
    return match;
  });
}

console.log(`\n✅ Fixed ${fixCount} npubs`);

// Write the corrected file
fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nWrote updated file to: ${filePath}`);
