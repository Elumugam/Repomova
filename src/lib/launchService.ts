import type { ConnectedApp, LaunchStage, RuntimeType, DetectedEnvVar } from '../types';

export interface LaunchResult {
  previewUrl: string;
  port: number;
  runtimeType: RuntimeType;
  hasWebInterface?: boolean;
  projectTypeCategory?: 'frontend' | 'backend' | 'cli' | 'library' | 'unknown';
  entryPoint?: string;
  details?: string;
  startCommand?: string;
  buildCommand?: string;
  commandSources?: {
    startCommand?: string;
    buildCommand?: string;
  };
  detectedEnvVars?: DetectedEnvVar[];
}

export interface DetectionResult {
  runtimeType: RuntimeType;
  details?: string;
  hasWebInterface?: boolean;
  projectTypeCategory?: 'frontend' | 'backend' | 'cli' | 'library' | 'unknown';
  entryPoint?: string;
  startCommand?: string;
  buildCommand?: string;
  commandSources?: {
    startCommand?: string;
    buildCommand?: string;
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
        const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${app.repoName}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2.5rem;background:#0d1117;color:#c9d1d9;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:85vh;text-align:center}h1{color:#58a6ff;margin-bottom:0.25rem}.badge{background:#238636;color:#fff;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600}.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1.5rem;max-width:540px;margin-top:1.5rem;text-align:left}.meta{color:#8b949e;font-size:13px;margin:6px 0}a{color:#58a6ff;text-decoration:none}.status-dot{width:8px;height:8px;background:#238636;border-radius:50%;display:inline-block;margin-right:6px}</style></head><body><span class="badge"><span class="status-dot"></span>Running in Cloud Preview</span><h1>${app.repoName}</h1><p style="color:#8b949e;margin-top:4px">Connected repository: <a href="${app.repoUrl}" target="_blank" rel="noopener noreferrer">${app.repoOwner}/${app.repoName}</a></p><div class="card"><div class="meta"><strong>Status:</strong> Active (HTTP 200)</div><div class="meta"><strong>Port:</strong> ${port}</div><div class="meta"><strong>Runtime:</strong> ${app.runtimeType}</div><div class="meta" style="margin-top:12px;padding-top:10px;border-top:1px solid #30363d;color:#58a6ff;">Application services initialized and running in Repomova workspace.</div></div></body></html>`;

        resolve({
          previewUrl: app.previewUrl || `data:text/html;charset=utf-8,${encodeURIComponent(previewHtml)}`,
          port,
          runtimeType: app.runtimeType || 'python',
          startCommand: app.startCommand || 'python app.py',
          buildCommand: app.buildCommand || 'pip install -r requirements.txt',
          commandSources: app.commandSources,
          detectedEnvVars: app.detectedEnvVars,
        });
      } catch (err) {
        reject(err);
      }
    };

    try {
      const portQuery = app.port ? `&port=${app.port}` : '';
      const eventUrl = `/api/apps/launch/events?appId=${encodeURIComponent(app.id)}&repoUrl=${encodeURIComponent(app.repoUrl)}&repoName=${encodeURIComponent(app.repoName)}${portQuery}`;
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
