import { describe, it, expect } from 'vitest';
import { parseGitHubUrl, guessRuntimeType } from '../lib/repoUtils';

describe('repoUtils', () => {
  describe('parseGitHubUrl', () => {
    it('parses standard https GitHub URLs', () => {
      const parsed = parseGitHubUrl('https://github.com/facebook/react');
      expect(parsed).toEqual({ owner: 'facebook', name: 'react' });
    });

    it('handles trailing slash and .git extension', () => {
      const withSlash = parseGitHubUrl('https://github.com/vercel/next.js/');
      expect(withSlash).toEqual({ owner: 'vercel', name: 'next.js' });

      const withGit = parseGitHubUrl('https://github.com/tailwindlabs/tailwindcss.git');
      expect(withGit).toEqual({ owner: 'tailwindlabs', name: 'tailwindcss' });
    });

    it('returns null for invalid URLs', () => {
      expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull();
      expect(parseGitHubUrl('not-a-url')).toBeNull();
      expect(parseGitHubUrl('https://github.com/')).toBeNull();
      expect(parseGitHubUrl('https://github.com/onlyonepart')).toBeNull();
    });
  });

  describe('guessRuntimeType', () => {
    it('identifies nextjs projects from name', () => {
      expect(guessRuntimeType('my-nextjs-dashboard')).toBe('nextjs');
      expect(guessRuntimeType('portfolio-next')).toBe('nextjs');
    });

    it('identifies vite/react projects from name', () => {
      expect(guessRuntimeType('vite-dashboard')).toBe('vite');
      expect(guessRuntimeType('react-weather-app')).toBe('vite');
    });

    it('identifies python projects from name and language', () => {
      expect(guessRuntimeType('fastapi-service')).toBe('python');
      expect(guessRuntimeType('my-flask-api')).toBe('python');
      expect(guessRuntimeType('backend-api', 'Python')).toBe('python');
    });

    it('identifies docker projects from name', () => {
      expect(guessRuntimeType('docker-compose-stack')).toBe('docker');
    });

    it('identifies static sites like 2048 from name and language', () => {
      expect(guessRuntimeType('2048')).toBe('static');
      expect(guessRuntimeType('html5-game-2048')).toBe('static');
      expect(guessRuntimeType('personal-site', 'HTML')).toBe('static');
    });

    it('falls back to node or unknown', () => {
      expect(guessRuntimeType('custom-microservice', 'TypeScript')).toBe('node');
      expect(guessRuntimeType('custom-microservice', 'Go')).toBe('unknown');
    });
  });
});
