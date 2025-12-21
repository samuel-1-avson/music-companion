/**
 * Crypto Service - Token Encryption/Decryption
 * 
 * Uses AES-256-GCM for secure token encryption.
 * Tokens are encrypted before storing in database and decrypted when retrieved.
 */
import crypto from 'crypto';
import { config } from '../utils/config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Interface for encrypted data structure
 */
interface EncryptedData {
  encrypted: string;  // Base64 encoded ciphertext
  iv: string;         // Base64 encoded initialization vector
  authTag: string;    // Base64 encoded authentication tag
}

/**
 * Get the encryption key from config
 * Must be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = config.security?.encryptionKey || '';
  
  if (!key || key.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 characters');
  }
  
  // Take first 32 bytes if longer, or hash if needed
  if (key.length === 32) {
    return Buffer.from(key, 'utf8');
  }
  
  // Use SHA-256 to derive a 32-byte key from any length secret
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a plaintext string
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt an encrypted string
 */
export function decrypt(encrypted: string, iv: string, authTag: string): string {
  const key = getEncryptionKey();
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'base64'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt a token for storage
 * Returns a base64-encoded JSON string containing all encryption data
 */
export function encryptToken(token: string): string {
  if (!token) return '';
  
  try {
    const encryptedData = encrypt(token);
    return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
  } catch (error) {
    console.error('[Crypto] Encryption failed:', error);
    throw new Error('Token encryption failed');
  }
}

/**
 * Decrypt a token from storage
 * Accepts the base64-encoded JSON string from encryptToken
 */
export function decryptToken(encryptedData: string): string {
  if (!encryptedData) return '';
  
  try {
    const parsed: EncryptedData = JSON.parse(
      Buffer.from(encryptedData, 'base64').toString('utf8')
    );
    
    return decrypt(parsed.encrypted, parsed.iv, parsed.authTag);
  } catch (error) {
    console.error('[Crypto] Decryption failed:', error);
    throw new Error('Token decryption failed');
  }
}

/**
 * Check if encryption is configured
 */
export function isEncryptionEnabled(): boolean {
  return !!(config.security?.isEncryptionConfigured);
}

/**
 * Safely encrypt token (returns original if encryption not configured)
 */
export function safeEncryptToken(token: string): string {
  if (!token) return '';
  if (!isEncryptionEnabled()) return token;
  return encryptToken(token);
}

/**
 * Safely decrypt token (returns original if not encrypted format)
 */
export function safeDecryptToken(encryptedData: string, isEncrypted: boolean): string {
  if (!encryptedData) return '';
  if (!isEncrypted || !isEncryptionEnabled()) return encryptedData;
  
  try {
    return decryptToken(encryptedData);
  } catch {
    // If decryption fails, might be plaintext from before encryption was enabled
    console.warn('[Crypto] Decryption failed, returning as-is (might be plaintext)');
    return encryptedData;
  }
}

export default {
  encrypt,
  decrypt,
  encryptToken,
  decryptToken,
  isEncryptionEnabled,
  safeEncryptToken,
  safeDecryptToken,
};
