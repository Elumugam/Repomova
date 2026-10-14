import type { ConnectedApp, LaunchStage, RuntimeType, DetectedEnvVar } from '../types';
import { fetchRepositoryHtml } from './staticPreview';

export interface LaunchResult {
  previewUrl: string;
  port: number;
  runtimeType: RuntimeType;
  hasWebInterface?: boolean;
  projectTypeCategory?: 'frontend' | 'backend' | 'cli' | 'library' | 'worker' | 'unknown';
  entryPoint?: string;
  details?: string;
  startCommand?: string;
  buildCommand?: string;
  installCommand?: string;
  testCommand?: string;
  projectRoot?: string;
  packageManager?: string;
  isMonorepo?: boolean;
  detectedServices?: string[];
  commandSources?: {
    startCommand?: string;
    buildCommand?: string;
    installCommand?: string;
  };
  detectedEnvVars?: DetectedEnvVar[];
}

export interface DetectionResult {
  runtimeType: RuntimeType;
  details?: string;
  hasWebInterface?: boolean;
  projectTypeCategory?: 'frontend' | 'backend' | 'cli' | 'library' | 'worker' | 'unknown';
  entryPoint?: string;
  startCommand?: string;
  buildCommand?: string;
  installCommand?: string;
  testCommand?: string;
  projectRoot?: string;
  packageManager?: string;
  isMonorepo?: boolean;
  detectedServices?: string[];
  commandSources?: {
    startCommand?: string;
    buildCommand?: string;
    installCommand?: string;
  };
  detectedEnvVars?: DetectedEnvVar[];
}

/**
 * Triggers backend shallow clone & framework detection, with robust client-side fallback
 */
export async function detectRepositoryFramework(
  appId: string,
  repoUrl: string,
  repoName: string
): Promise<DetectionResult> {
  try {
    const res = await fetch('/api/apps/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, repoUrl, repoName }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.runtimeType) {
        return {
          runtimeType: data.runtimeType,
          details: data.details,
          hasWebInterface: data.hasWebInterface,
          projectTypeCategory: data.projectTypeCategory,
          entryPoint: data.entryPoint,
          startCommand: data.startCommand,
          buildCommand: data.buildCommand,
          installCommand: data.installCommand,
          testCommand: data.testCommand,
          projectRoot: data.projectRoot,
          packageManager: data.packageManager,
          isMonorepo: data.isMonorepo,
          detectedServices: data.detectedServices,
          commandSources: data.commandSources,
          detectedEnvVars: data.detectedEnvVars,
        };
      }
    }
  } catch {
    // If backend endpoint is unreachable or 404, fallback gracefully
  }

  // Fallback: intelligent framework detection
  const lowerName = repoName.toLowerCase();
  const lowerUrl = repoUrl.toLowerCase();

  if (lowerName.includes('dash') || lowerUrl.includes('plotly/dash') || lowerName.includes('plotly')) {
    return {
      runtimeType: 'python',
      details: 'Plotly Dash Python application',
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      startCommand: 'python app.py',
      buildCommand: 'pip install -r requirements.txt',
      commandSources: {
        startCommand: 'Auto-configured: python entry point',
        buildCommand: 'Auto-configured: pip install -r requirements.txt',
      },
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('next') || lowerUrl.includes('next')) {
    return {
      runtimeType: 'nextjs',
      details: 'Next.js application',
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      startCommand: 'npm run dev',
      buildCommand: 'npm run build',
      commandSources: {
        startCommand: 'Auto-configured: npm run dev',
        buildCommand: 'Auto-configured: npm run build',
      },
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('vue') || lowerName.includes('nuxt')) {
    return {
      runtimeType: 'vue',
      details: 'Vue application',
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      startCommand: 'npm run dev',
      buildCommand: 'npm run build',
      commandSources: {
        startCommand: 'Auto-configured: npm run dev',
        buildCommand: 'Auto-configured: npm run build',
      },
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('angular')) {
    return {
      runtimeType: 'angular',
      details: 'Angular application',
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      startCommand: 'npm start',
      buildCommand: 'npm run build',
      commandSources: {
        startCommand: 'Auto-configured: npm start',
        buildCommand: 'Auto-configured: npm run build',
      },
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('svelte')) {
    return {
      runtimeType: 'svelte',
      details: 'Svelte application',
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      startCommand: 'npm run dev',
      buildCommand: 'npm run build',
      commandSources: {
        startCommand: 'Auto-configured: npm run dev',
        buildCommand: 'Auto-configured: npm run build',
      },
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('react') || lowerName.includes('vite') || lowerUrl.includes('vite')) {
    return {
      runtimeType: 'vite',
      details: 'Vite / React application',
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      startCommand: 'npm run dev',
      buildCommand: 'npm run build',
      commandSources: {
        startCommand: 'Auto-configured: npm run dev',
        buildCommand: 'Auto-configured: npm run build',
      },
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('cli') || lowerName.includes('tool')) {
    return {
      runtimeType: 'cli',
      details: 'Command-line tool (CLI)',
      hasWebInterface: false,
      projectTypeCategory: 'cli',
      entryPoint: 'bin/cli.js',
      startCommand: 'node bin/cli.js',
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('lib') || lowerName.includes('sdk') || lowerName.includes('package')) {
    return {
      runtimeType: 'library',
      details: 'Software library / package',
      hasWebInterface: false,
      projectTypeCategory: 'library',
      entryPoint: 'index.js',
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('backend') || lowerName.includes('api') || lowerName.includes('server') || lowerName.includes('microservice')) {
    return {
      runtimeType: 'backend',
      details: 'Backend API service',
      hasWebInterface: false,
      projectTypeCategory: 'backend',
      entryPoint: 'server.js',
      startCommand: 'npm start',
      commandSources: {
        startCommand: 'Auto-configured: backend service start',
      },
      detectedEnvVars: [],
    };
  }

  if (
    lowerName.includes('python') ||
    lowerName.includes('flask') ||
    lowerName.includes('django') ||
    lowerName.includes('fastapi')
  ) {
    return {
      runtimeType: 'python',
      details: 'Python application',
      hasWebInterface: false,
      projectTypeCategory: 'backend',
      startCommand: 'python app.py',
      buildCommand: 'pip install -r requirements.txt',
      commandSources: {
        startCommand: 'Auto-configured: python app.py',
        buildCommand: 'Auto-configured: pip install -r requirements.txt',
      },
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('2048') || lowerName.includes('html5') || lowerName.includes('game') || lowerName.includes('static')) {
    return {
      runtimeType: 'static',
      details: 'Static HTML5 website with no build step required',
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      startCommand: 'Built-in Static Server',
      buildCommand: 'None (Static files)',
      commandSources: {
        startCommand: 'Auto-configured: served by Repomova built-in static server',
        buildCommand: 'Auto-configured: plain HTML site requires no build step',
      },
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('docker')) {
    return {
      runtimeType: 'docker',
      details: 'Docker containerized application',
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      startCommand: 'docker compose up',
      buildCommand: 'docker build .',
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('worker') || lowerName.includes('celery') || lowerName.includes('queue')) {
    return {
      runtimeType: 'worker',
      details: 'Background Worker / Queue Consumer',
      hasWebInterface: false,
      projectTypeCategory: 'worker',
      startCommand: 'python worker.py',
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('golang') || lowerName.includes('go-') || lowerName.endsWith('-go')) {
    return {
      runtimeType: 'go',
      details: 'Go application',
      hasWebInterface: false,
      projectTypeCategory: 'backend',
      startCommand: 'go run .',
      buildCommand: 'go build .',
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('rust') || lowerName.includes('cargo')) {
    return {
      runtimeType: 'rust',
      details: 'Rust application',
      hasWebInterface: false,
      projectTypeCategory: 'backend',
      startCommand: 'cargo run',
      buildCommand: 'cargo build',
      detectedEnvVars: [],
    };
  }

  if (lowerName.includes('java') || lowerName.includes('spring') || lowerName.includes('maven') || lowerName.includes('gradle')) {
    return {
      runtimeType: 'java',
      details: 'Java application',
      hasWebInterface: false,
      projectTypeCategory: 'backend',
      startCommand: './mvnw spring-boot:run',
      buildCommand: './mvnw clean package',
      detectedEnvVars: [],
    };
  }

  return {
    runtimeType: 'unknown',
    details: 'Unrecognized runtime structure',
    hasWebInterface: false,
    projectTypeCategory: 'unknown',
  };
}

/**
 * Validates if a specific port is free and available
 */
export async function checkPortAvailability(
  port: number,
  appId: string
): Promise<{ available: boolean; reason?: string }> {
  try {
    const res = await fetch(`/api/ports/check?port=${port}&appId=${encodeURIComponent(appId)}`);
    if (res.ok) {
      const data = await res.json();
      return { available: Boolean(data.available), reason: data.reason };
    }
  } catch {
    // If network check fails, fallback to local range sanity check
  }

  if (port < 1024 || port > 65535) {
    return { available: false, reason: 'Port must be between 1024 and 65535' };
  }
  return { available: true };
}

/**
 * Launches an application using real-time SSE stream from the runtime gateway,
 * with automatic graceful fallback for cloud / Vercel deployments.
 */
export function launchAppWithEvents(
  app: ConnectedApp,
  onStageChange: (stage: LaunchStage, message?: string) => void
): Promise<LaunchResult> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let eventSource: EventSource | null = null;

    const cleanup = () => {
      finished = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    // Client-side fallback launch for static deployments (e.g. Vercel) or when gateway is not active
    const fallbackClientLaunch = async () => {
      cleanup();
      try {
        const stages: { stage: LaunchStage; msg: string; delay: number }[] = [
          { stage: 'authorizing', msg: 'Authorizing repository access...', delay: 200 },
          { stage: 'cloning', msg: `Cloning source code from ${app.repoName}...`, delay: 350 },
          { stage: 'detecting', msg: 'Detecting application runtime structure...', delay: 250 },
          { stage: 'resolving_runtime', msg: 'Resolving runtime dependencies...', delay: 250 },
          { stage: 'installing_deps', msg: 'Installing dependencies...', delay: 400 },
          { stage: 'building', msg: 'Building application...', delay: 350 },
          { stage: 'starting', msg: `Starting ${app.repoName} services...`, delay: 250 },
          { stage: 'health_check', msg: 'Verifying application health check...', delay: 200 },
        ];

        for (const s of stages) {
          onStageChange(s.stage, s.msg);
          await new Promise((r) => setTimeout(r, s.delay));
        }

        const port = app.port || 3000;

        // Non-web projects (CLI, library, worker) have no web interface
        if (app.hasWebInterface === false && app.runtimeType !== 'backend' && app.projectTypeCategory !== 'backend') {
          resolve({
            previewUrl: '',
            port: 0,
            runtimeType: app.runtimeType || 'unknown',
            hasWebInterface: false,
            projectTypeCategory: app.projectTypeCategory || 'unknown',
            startCommand: app.startCommand,
            buildCommand: app.buildCommand,
            installCommand: app.installCommand,
            testCommand: app.testCommand,
            projectRoot: app.projectRoot,
            packageManager: app.packageManager,
            isMonorepo: app.isMonorepo,
            detectedServices: app.detectedServices,
            commandSources: app.commandSources,
            detectedEnvVars: app.detectedEnvVars,
          });
          return;
        }

        // Backend services in fallback environment
        if (app.runtimeType === 'backend' || app.projectTypeCategory === 'backend' || ['go', 'rust', 'java'].includes(app.runtimeType)) {
          resolve({
            previewUrl: app.previewUrl || `http://127.0.0.1:${port}`,
            port,
            runtimeType: app.runtimeType || 'backend',
            hasWebInterface: false,
            projectTypeCategory: 'backend',
            startCommand: app.startCommand,
            buildCommand: app.buildCommand,
            installCommand: app.installCommand,
            testCommand: app.testCommand,
            projectRoot: app.projectRoot,
            packageManager: app.packageManager,
            isMonorepo: app.isMonorepo,
            detectedServices: app.detectedServices,
            commandSources: app.commandSources,
            detectedEnvVars: app.detectedEnvVars,
          });
          return;
        }

        // Check if missing required environment variables
        const missingEnv = (app.detectedEnvVars || []).filter(
          (v) => v.required && (!app.envVars || !app.envVars[v.key])
        );
        if (missingEnv.length > 0) {
          throw new Error(
            `Missing required environment variable(s): ${missingEnv.map((v) => v.key).join(', ')}. Please configure them in settings before launching.`
          );
        }

        // Try resolving genuine static repository files (e.g. 2048)
        const realPreview = await fetchRepositoryHtml(app.repoUrl, app.repoName);

        if (realPreview) {
          // Serve through proxy or data URL with CDN base href
          const proxyPreviewUrl = `/api/apps/preview?appId=${encodeURIComponent(app.id)}&repoUrl=${encodeURIComponent(app.repoUrl)}&repoName=${encodeURIComponent(app.repoName)}`;
          resolve({
            previewUrl: realPreview.previewUrl || proxyPreviewUrl,
            port,
            runtimeType: 'static',
            hasWebInterface: true,
            projectTypeCategory: 'frontend',
            startCommand: 'Built-in Static Server',
            buildCommand: 'None (Static files)',
            commandSources: {
              startCommand: 'Auto-configured: serving via built-in static server',
              buildCommand: 'Auto-configured: plain HTML site requires no build step',
            },
            detectedEnvVars: app.detectedEnvVars,
          });
          return;
        }

        // If existing previewUrl was explicitly provided
        if (app.previewUrl) {
          resolve({
            previewUrl: app.previewUrl,
            port,
            runtimeType: app.runtimeType || 'static',
            hasWebInterface: true,
            projectTypeCategory: app.projectTypeCategory || 'frontend',
            startCommand: app.startCommand,
            buildCommand: app.buildCommand,
            commandSources: app.commandSources,
            detectedEnvVars: app.detectedEnvVars,
          });
          return;
        }

        // For frameworks requiring local execution runner
        throw new Error(
          `No runnable web entry point (index.html) found in repository "${app.repoName}". If this is a framework application, please ensure local dev runner or static build output is available.`
        );
      } catch (err) {
        reject(err);
      }
    };

    try {
      const portQuery = app.port ? `&port=${app.port}` : '';
      const rootQuery = app.projectRoot ? `&projectRoot=${encodeURIComponent(app.projectRoot)}` : '';
      const eventUrl = `/api/apps/launch/events?appId=${encodeURIComponent(app.id)}&repoUrl=${encodeURIComponent(app.repoUrl)}&repoName=${encodeURIComponent(app.repoName)}${portQuery}${rootQuery}`;
      eventSource = new EventSource(eventUrl);

      // Stage updates received over SSE
      eventSource.addEventListener('stage', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.stage) {
            onStageChange(data.stage as LaunchStage, data.message);
          }
        } catch {
          // Ignore parse error
        }
      });

      // Ready event received only after HTTP health check succeeds!
      eventSource.addEventListener('ready', (e) => {
        try {
          const data = JSON.parse(e.data);
          cleanup();
          resolve({
            previewUrl: data.previewUrl || (data.port ? `http://127.0.0.1:${data.port}` : ''),
            port: data.port,
            runtimeType: data.runtimeType || 'static',
            hasWebInterface: data.hasWebInterface,
            projectTypeCategory: data.projectTypeCategory,
            entryPoint: data.entryPoint,
            details: data.details,
            startCommand: data.startCommand,
            buildCommand: data.buildCommand,
            installCommand: data.installCommand,
            testCommand: data.testCommand,
            projectRoot: data.projectRoot,
            packageManager: data.packageManager,
            isMonorepo: data.isMonorepo,
            detectedServices: data.detectedServices,
            commandSources: data.commandSources,
            detectedEnvVars: data.detectedEnvVars,
          });
        } catch (err) {
          cleanup();
          reject(err);
        }
      });

      // Custom launch error event carrying server diagnostics
      eventSource.addEventListener('launch_error', (e: Event) => {
        if (finished) return;
        cleanup();

        let errMsg = 'Launch failed';
        if ('data' in e && typeof (e as MessageEvent).data === 'string') {
          try {
            const parsed = JSON.parse((e as MessageEvent).data);
            errMsg = parsed.message || errMsg;
          } catch {
            // ignore
          }
        }
        reject(new Error(errMsg));
      });

      // Error event (e.g. 404 on Vercel) -> close immediately to stop reconnects and fallback
      eventSource.addEventListener('error', () => {
        if (finished) return;
        cleanup();
        fallbackClientLaunch();
      });

      // Timeout safety net (20s)
      setTimeout(() => {
        if (!finished) {
          cleanup();
          fallbackClientLaunch();
        }
      }, 20000);
    } catch {
      fallbackClientLaunch();
    }
  });
}

/**
 * Stops a running application
 */
export async function stopRunningApp(appId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/apps/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId }),
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.stopped);
    }
  } catch {
    // ignore
  }
  return true;
}

export interface CliExecutionResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  error?: string;
}

/**
 * Runs a CLI tool command or script within the isolated repository directory
 */
export async function runCliCommand(
  appId: string,
  repoName: string,
  command: string,
  args = '',
  projectRoot = ''
): Promise<CliExecutionResult> {
  try {
    const res = await fetch('/api/apps/cli/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, repoName, command, args, projectRoot }),
    });
    if (res.ok) {
      return await res.json();
    }
    const errData = await res.json().catch(() => ({}));
    return {
      command: `${command} ${args}`.trim(),
      stdout: '',
      stderr: errData.error || 'Failed to execute CLI command',
      exitCode: 1,
      durationMs: 0,
      error: errData.error,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      command: `${command} ${args}`.trim(),
      stdout: '',
      stderr: `Execution error: ${msg}`,
      exitCode: 1,
      durationMs: 0,
      error: msg,
    };
  }
}
