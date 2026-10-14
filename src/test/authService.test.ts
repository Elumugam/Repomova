import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  signUpUser,
  signInUser,
  getSessionUser,
  signOutUser,
  updateUserProfile,
  hashPassword,
  verifyPassword,
  setCustomDbPath,
  clearAuthDb,
  loadAuthDb,
} from '../server/authService';

describe('Dedicated Repomova Auth Service (Server-side)', () => {
  let tempDir: string;
  let testDbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repomova-auth-test-'));
    testDbPath = path.join(tempDir, 'auth_test_db.json');
    setCustomDbPath(testDbPath);
    clearAuthDb();
  });

  afterEach(() => {
    clearAuthDb();
    setCustomDbPath(null);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Password Hashing & Cryptographic Verification', () => {
    it('generates unique random salt and PBKDF2 hash for the same password', () => {
      const p1 = hashPassword('superSecret123');
      const p2 = hashPassword('superSecret123');

      expect(p1.salt).not.toBe(p2.salt);
      expect(p1.hash).not.toBe(p2.hash);
      expect(p1.salt.length).toBe(32); // 16 bytes hex = 32 chars
      expect(p1.hash.length).toBe(128); // 64 bytes hex = 128 chars
    });

    it('verifies passwords correctly with timingSafeEqual', () => {
      const { salt, hash } = hashPassword('mypassword456');
      expect(verifyPassword('mypassword456', hash, salt)).toBe(true);
      expect(verifyPassword('wrongpassword', hash, salt)).toBe(false);
      expect(verifyPassword('', hash, salt)).toBe(false);
    });
  });

  describe('User Registration (signUpUser)', () => {
    it('creates a new user and persists session to disk', async () => {
      const res = await signUpUser({
        email: 'developer@example.com',
        password: 'securePassword123',
        confirmPassword: 'securePassword123',
        displayName: 'Dev Lead',
      });

      expect(res.user).toBeDefined();
      expect(res.user.id).toMatch(/^usr_/);
      expect(res.user.email).toBe('developer@example.com');
      expect(res.user.displayName).toBe('Dev Lead');
      expect(res.token).toBeDefined();
      expect(res.token.length).toBe(64); // 32 bytes hex = 64 chars

      // Verify persisted to disk
      const db = loadAuthDb();
      expect(db.users).toHaveLength(1);
      expect(db.users[0].email).toBe('developer@example.com');
      expect(db.sessions).toHaveLength(1);
      expect(db.sessions[0].token).toBe(res.token);
    });

    it('rejects registration with invalid email format', async () => {
      await expect(
        signUpUser({
          email: 'not-an-email',
          password: 'securePassword123',
          confirmPassword: 'securePassword123',
        })
      ).rejects.toThrow(/Please enter a valid email address/i);
    });

    it('rejects registration with short password (< 6 chars)', async () => {
      await expect(
        signUpUser({
          email: 'dev@example.com',
          password: '123',
          confirmPassword: '123',
        })
      ).rejects.toThrow(/Password must be at least 6 characters long/i);
    });

    it('rejects registration when password confirmation does not match', async () => {
      await expect(
        signUpUser({
          email: 'dev@example.com',
          password: 'securePassword123',
          confirmPassword: 'differentPassword456',
        })
      ).rejects.toThrow(/Passwords do not match/i);
    });

    it('prevents duplicate account creation for the same email', async () => {
      await signUpUser({
        email: 'duplicate@example.com',
        password: 'securePassword123',
        confirmPassword: 'securePassword123',
      });

      await expect(
        signUpUser({
          email: 'DUPLICATE@example.com', // case-insensitive check
          password: 'anotherPassword123',
          confirmPassword: 'anotherPassword123',
        })
      ).rejects.toThrow(/An account with this email address already exists/i);
    });
  });

  describe('User Authentication (signInUser)', () => {
    beforeEach(async () => {
      await signUpUser({
        email: 'user@example.com',
        password: 'mySecretPassword99',
        confirmPassword: 'mySecretPassword99',
        displayName: 'Registered User',
      });
    });

    it('authenticates user with valid credentials and creates active session', async () => {
      const res = await signInUser({
        email: 'user@example.com',
        password: 'mySecretPassword99',
      });

      expect(res.user.email).toBe('user@example.com');
      expect(res.user.displayName).toBe('Registered User');
      expect(res.token).toBeDefined();

      const sessionUser = await getSessionUser(res.token);
      expect(sessionUser).toEqual(res.user);
    });

    it('rejects login with incorrect password', async () => {
      await expect(
        signInUser({
          email: 'user@example.com',
          password: 'wrongPassword!',
        })
      ).rejects.toThrow(/Invalid email or password/i);
    });

    it('rejects login with non-existent email', async () => {
      await expect(
        signInUser({
          email: 'nonexistent@example.com',
          password: 'mySecretPassword99',
        })
      ).rejects.toThrow(/Invalid email or password/i);
    });
  });

  describe('Session Management & Sign Out', () => {
    it('restores session from token and invalidates on signOut', async () => {
      const auth = await signUpUser({
        email: 'session@example.com',
        password: 'sessionPassword123',
        confirmPassword: 'sessionPassword123',
      });

      // Valid session
      const user = await getSessionUser(auth.token);
      expect(user?.email).toBe('session@example.com');

      // Sign out
      await signOutUser(auth.token);

      // Session is now invalidated
      const loggedOut = await getSessionUser(auth.token);
      expect(loggedOut).toBeNull();
    });

    it('returns null for empty or non-existent tokens', async () => {
      expect(await getSessionUser('')).toBeNull();
      expect(await getSessionUser('invalid-random-token-123')).toBeNull();
    });
  });

  describe('Profile Updates (updateUserProfile)', () => {
    it('updates user display name securely with active session token', async () => {
      const auth = await signUpUser({
        email: 'profile@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        displayName: 'Original Name',
      });

      const updated = await updateUserProfile(auth.token, {
        displayName: 'Updated Engineer',
      });

      expect(updated.displayName).toBe('Updated Engineer');

      // Subsequent session check reflects new display name
      const sessionUser = await getSessionUser(auth.token);
      expect(sessionUser?.displayName).toBe('Updated Engineer');
    });

    it('rejects profile update without valid token', async () => {
      await expect(
        updateUserProfile('', { displayName: 'Hacker' })
      ).rejects.toThrow(/Unauthorized/i);

      await expect(
        updateUserProfile('invalid-token', { displayName: 'Hacker' })
      ).rejects.toThrow(/Session expired or invalid/i);
    });
  });
});
