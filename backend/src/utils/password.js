import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * @param {string} plainPassword
 * @returns {Promise<{ hash: string, salt: string }>}
 */
export async function hashPassword(plainPassword) {
  if (!plainPassword || typeof plainPassword !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  if (plainPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(plainPassword, salt);

  return {
    hash,
    salt,
  };
}

/**
 * @param {string} plainPassword
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, hash) {
  if (!plainPassword || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(plainPassword, hash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

