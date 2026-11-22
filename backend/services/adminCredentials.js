/**
 * Admin Credential Sync
 * ADMIN_USERNAME / ADMIN_PASSWORD env vars are the source of truth. On every
 * login attempt this syncs them into Firestore (platformConfig/adminCredentials,
 * password stored as a salted scrypt hash - never plaintext) if they've
 * changed, then verifies the submitted credentials against the synced
 * record. Changing the env vars in Render automatically updates the stored
 * credentials on the next login attempt - no separate "first run" step.
 */

import crypto from 'crypto';
import { firestoreClient } from './firestoreClient.js';

const DOC_PATH = 'platformConfig/adminCredentials';

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

class AdminCredentialsService {
  /**
   * Ensures Firestore mirrors the current ADMIN_USERNAME/ADMIN_PASSWORD env
   * vars (creating or updating the record if they differ), then verifies
   * the submitted username/password against the synced record.
   * Returns { configured: boolean, valid: boolean }.
   */
  async syncAndVerify(submittedUsername, submittedPassword) {
    const envUsername = process.env.ADMIN_USERNAME;
    const envPassword = process.env.ADMIN_PASSWORD;

    if (!envUsername || !envPassword) {
      return { configured: false, valid: false };
    }

    let stored = await firestoreClient.getDoc(DOC_PATH).catch(() => null);

    const usernameChanged = !stored || stored.username !== envUsername;
    const passwordChanged = !stored || !stored.passwordSalt ||
      hashPassword(envPassword, stored.passwordSalt) !== stored.passwordHash;

    if (usernameChanged || passwordChanged) {
      const salt = crypto.randomBytes(16).toString('hex');
      stored = {
        username: envUsername,
        passwordHash: hashPassword(envPassword, salt),
        passwordSalt: salt,
        updatedAt: new Date().toISOString()
      };
      await firestoreClient.setDocument(DOC_PATH, stored, { merge: false });
    }

    const valid =
      typeof submittedUsername === 'string' &&
      typeof submittedPassword === 'string' &&
      safeCompare(submittedUsername, stored.username) &&
      safeCompare(hashPassword(submittedPassword, stored.passwordSalt), stored.passwordHash);

    return { configured: true, valid };
  }
}

export const adminCredentials = new AdminCredentialsService();
