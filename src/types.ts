/* ============================================
   App Types — Repomova
   ============================================ */

// ---------- Application Status ----------
export type AppStatus =
  | 'connected'
  | 'preparing'
  | 'requires_configuration'
  | 'installing_dependencies'
  | 'building'
  | 'starting'
  | 'running'
  | 'stopped'
  | 'failed'
  | 'unsupported';

export const APP_STATUS_LABELS: Record<AppStatus, string> = {
  connected: 'Connected',
  preparing: 'Preparing',
  requires_configuration: 'Requires Setup',
  installing_dependencies: 'Installing',
  building: 'Building',
  starting: 'Starting',
  running: 'Running',
  stopped: 'Stopped',
  failed: 'Failed',
  unsupported: 'Unsupported',
};

export const APP_STATUS_COLORS: Record<AppStatus, string> = {
  connected: 'var(--color-status-stopped)',
  preparing: 'var(--color-status-preparing)',
  requires_configuration: 'var(--color-status-building)',
  installing_dependencies: 'var(--color-status-preparing)',
  building: 'var(--color-status-building)',
  starting: 'var(--color-status-preparing)',
  running: 'var(--color-status-running)',
  stopped: 'var(--color-status-stopped)',
  failed: 'var(--color-status-error)',
  unsupported: 'var(--color-status-stopped)',
};

// ---------- Runtime Types ----------
export type RuntimeType =
  | 'react'
  | 'vite'
  | 'nextjs'
  | 'vue'
  | 'angular'
  | 'svelte'
  | 'static'
  | 'node'
  | 'python'
  | 'backend'
  | 'cli'
  | 'library'
  | 'docker'
  | 'unknown';

export const RUNTIME_LABELS: Record<RuntimeType, string> = {
  react: 'React',
  vite: 'Vite',
  nextjs: 'Next.js',
  vue: 'Vue',
  angular: 'Angular',
  svelte: 'Svelte',
  static: 'Static Site',
  node: 'Node.js',
  python: 'Python',
  backend: 'Backend API / Service',
  cli: 'CLI Tool',
  library: 'Library / Package',
  docker: 'Docker',
  unknown: 'Unknown',
};

export function isFrontendRuntime(type: RuntimeType): boolean {
  return ['static', 'react', 'vite', 'nextjs', 'vue', 'angular', 'svelte'].includes(type);
}

export interface DetectedEnvVar {
  key: string;
  description?: string;
  required: boolean;
  isSecret: boolean;
}

export interface ConnectedApp {
  id: string;
  userId: string;
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  repoUrl: string;
  defaultBranch: string;
  cloneStatus: 'pending' | 'cloning' | 'cloned' | 'failed';
  runtimeType: RuntimeType;
  status: AppStatus;
  lastOpened: string | null;
  createdAt: string;
  updatedAt: string;
  description?: string;
  language?: string;
  isPrivate?: boolean;
  port?: number;
  previewUrl?: string;
  buildCommand?: string;
  startCommand?: string;
  commandSources?: {
    startCommand?: string;
    buildCommand?: string;
  };
  detectionDetails?: string;
  detectedEnvVars?: DetectedEnvVar[];
  envVars?: Record<string, string>;
  lockfileHash?: string;
  hasWebInterface?: boolean;
  entryPoint?: string;
  projectTypeCategory?: 'frontend' | 'backend' | 'cli' | 'library' | 'unknown';
  lastError?: string;
  isBookmarked?: boolean;
}

// ---------- Open Tab ----------
export interface OpenTab {
  id: string;
  appId?: string;
  title: string;
  previewUrl?: string;
  status?: AppStatus;
}

// ---------- Auth ----------
export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

// ---------- GitHub ----------
export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  language: string | null;
  isPrivate: boolean;
  defaultBranch: string;
  htmlUrl: string;
  cloneUrl: string;
  updatedAt: string;
  stargazersCount: number;
}

// ---------- Config / Setup ----------
export interface ConfigField {
  key: string;
  label: string;
  description: string;
  type: 'text' | 'password' | 'number' | 'select' | 'boolean';
  required: boolean;
  default?: string;
  options?: string[];
  isSecret: boolean;
}

export interface AppConfig {
  appId: string;
  fields: Record<string, string>;
}

// ---------- Launch Progress ----------
export type LaunchStage =
  | 'authorizing'
  | 'cloning'
  | 'verifying'
  | 'detecting'
  | 'resolving_runtime'
  | 'collecting_config'
  | 'installing_deps'
  | 'building'
  | 'starting'
  | 'health_check'
  | 'ready'
  | 'failed';

export const LAUNCH_STAGE_LABELS: Record<LaunchStage, string> = {
  authorizing: 'Authorizing repository',
  cloning: 'Cloning source code',
  verifying: 'Verifying repository',
  detecting: 'Detecting application type',
  resolving_runtime: 'Resolving runtime',
  collecting_config: 'Collecting configuration',
  installing_deps: 'Installing dependencies',
  building: 'Building application',
  starting: 'Starting services',
  health_check: 'Checking application health',
  ready: 'Application ready',
  failed: 'Launch failed',
};

// ---------- Theme ----------
export type Theme = 'light' | 'dark';
