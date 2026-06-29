import crypto from 'crypto';

/**
 * Hash a password using Node's native pbkdf2 algorithm.
 * @param {string} password 
 * @returns {string} format: salt:hash
 */
export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

/**
 * Verify a password against a hash.
 * @param {string} password 
 * @param {string} storedHash format: salt:hash
 * @returns {boolean}
 */
export const verifyPassword = (password, storedHash) => {
  const [salt, originalHash] = storedHash.split(':');
  if (!salt || !originalHash) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === originalHash;
};
