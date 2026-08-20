/**
 * Cryptographic Password Hashing & Verification Utilities
 * Uses Web Cryptography API (PBKDF2-HMAC-SHA256, 100,000 iterations)
 */

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

const ITERATIONS = 100000;
const HASH_ALGO = 'SHA-256';

/**
 * Hash a plain text password using PBKDF2-SHA256 with a secure random salt
 * @returns Formatted hash string: `pbkdf2_sha256$<iterations>$<hexSalt>$<hexHash>`
 */
export async function hashPassword(password: string): Promise<string> {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Web Cryptography API is unavailable.');
  }

  // 1. Generate 16 bytes of cryptographically secure random salt
  const saltBytes = new Uint8Array(16);
  cryptoObj.getRandomValues(saltBytes);
  const hexSalt = bufferToHex(saltBytes.buffer);

  // 2. Import password as raw key
  const enc = new TextEncoder();
  const passwordKey = await cryptoObj.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // 3. Derive 256-bit (32 bytes) key using PBKDF2
  const derivedBits = await cryptoObj.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: HASH_ALGO,
    },
    passwordKey,
    256
  );

  const hexHash = bufferToHex(derivedBits);
  return `pbkdf2_sha256$${ITERATIONS}$${hexSalt}$${hexHash}`;
}

/**
 * Verify a plain text password against a stored hash
 */
export async function verifyPassword(password: string, storedHashOrPlain: string): Promise<boolean> {
  if (!password || !storedHashOrPlain) return false;

  // 1. Check if stored value is a PBKDF2 formatted hash
  if (storedHashOrPlain.startsWith('pbkdf2_sha256$')) {
    const parts = storedHashOrPlain.split('$');
    if (parts.length !== 4) return false;

    const iterations = parseInt(parts[1], 10) || ITERATIONS;
    const hexSalt = parts[2];
    const expectedHexHash = parts[3];

    const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
    if (!cryptoObj || !cryptoObj.subtle) return false;

    const saltBytes = hexToBuffer(hexSalt);
    const enc = new TextEncoder();

    const passwordKey = await cryptoObj.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const derivedBits = await cryptoObj.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations,
        hash: HASH_ALGO,
      },
      passwordKey,
      256
    );

    const actualHexHash = bufferToHex(derivedBits);
    return actualHexHash === expectedHexHash;
  }

  // 2. Backward compatibility: direct string match for legacy plaintext passwords
  return password === storedHashOrPlain;
}
