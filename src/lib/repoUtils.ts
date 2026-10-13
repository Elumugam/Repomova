import type { RuntimeType } from '../types';

export const GITHUB_URL_PATTERN = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/)?$/;

export function parseGitHubUrl(url: string): { owner: string; name: string } | null {
  const match = url.trim().match(GITHUB_URL_PATTERN);
  if (!match) return null;
  return { owner: match[1], name: match[2] };
}

export function guessRuntimeType(name: string, language?: string): RuntimeType {
  const lower = name.toLowerCase();
  const langLower = language?.toLowerCase();

  if (lower.includes('next')) return 'nextjs';
  if (lower.includes('nuxt') || lower.includes('vue')) return 'vue';
  if (lower.includes('angular')) return 'angular';
  if (lower.includes('svelte')) return 'svelte';
  if (lower.includes('react') || lower.includes('vite')) return 'vite';
  if (
    lower.includes('python') ||
    lower.includes('flask') ||
    lower.includes('django') ||
    lower.includes('fastapi') ||
    lower.includes('dash') ||
    lower.includes('plotly') ||
    langLower === 'python'
  ) {
    return 'python';
  }
  if (lower.includes('docker')) return 'docker';
  if (lower.includes('2048') || lower.includes('static') || lower.includes('html5') || langLower === 'html') return 'static';
  if (langLower === 'typescript' || langLower === 'javascript') return 'node';
  if (lower.includes('backend') || lower.includes('api') || lower.includes('server')) return 'backend';
  if (lower.includes('cli') || lower.includes('tool')) return 'cli';
  if (lower.includes('lib') || lower.includes('sdk') || lower.includes('package')) return 'library';
  return 'unknown';
}
