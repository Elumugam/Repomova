import type { RuntimeType } from '../types';

export const GITHUB_URL_PATTERN = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/)?$/;

export function parseGitHubUrl(url: string): { owner: string; name: string } | null {
  const match = url.trim().match(GITHUB_URL_PATTERN);
  if (!match) return null;
  return { owner: match[1], name: match[2] };
}

export function guessRuntimeType(name: string, language?: string): RuntimeType {
  const lower = name.toLowerCase();
  if (lower.includes('next')) return 'nextjs';
  if (lower.includes('react') || lower.includes('vite')) return 'vite';
  if (
    lower.includes('python') ||
    lower.includes('flask') ||
    lower.includes('django') ||
    lower.includes('fastapi') ||
    lower.includes('dash') ||
    lower.includes('plotly')
  ) {
    return 'python';
  }
  if (lower.includes('docker')) return 'docker';
  if (lower.includes('2048') || lower.includes('static') || lower.includes('html5') || language?.toLowerCase() === 'html') return 'static';
  if (language?.toLowerCase() === 'python') return 'python';
  if (language?.toLowerCase() === 'typescript' || language?.toLowerCase() === 'javascript') return 'node';
  return 'unknown';
}
