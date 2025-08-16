function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(60));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-512',
    },
    keyMaterial,
    512,
  );
  const saltHex = bufferToHex(salt.buffer);
  const hashHex = bufferToHex(hashBuffer);
  return saltHex + hashHex;
}

export async function verifyPassword(
  providedPassword: string,
  storedPassword: string,
): Promise<boolean> {
  const saltHex = storedPassword.substring(0, 120);
  const originalHashHex = storedPassword.substring(120);
  const salt = hexToBuffer(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(providedPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-512',
    },
    keyMaterial,
    512,
  );
  const derivedHashHex = bufferToHex(hashBuffer);
  return derivedHashHex === originalHashHex;
}

export async function generateValidationCodeFromEmail(
  email: string,
): Promise<string> {
  const secret = process.env.SECRET_KEY;
  if (!secret) throw new Error('Secret key is required');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(email),
  );
  const hashHex = bufferToHex(signatureBuffer);
  const number = parseInt(hashHex.substring(0, 15), 16);
  const code = number % 1000000;
  return code.toString().padStart(6, '0');
}
