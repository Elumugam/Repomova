import type { ConnectedApp, LaunchStage, RuntimeType, DetectedEnvVar } from '../types';

export interface LaunchResult {
  previewUrl: string;
  port: number;
  runtimeType: RuntimeType;
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
  startCommand?: string;
  buildCommand?: string;
  commandSources?: {
    startCommand?: string;
    buildCommand?: string;
  };
  detectedEnvVars?: DetectedEnvVar[];
}

/**
 * Triggers backend shallow clone & framework detection
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
          startCommand: data.startCommand,
          buildCommand: data.buildCommand,
          commandSources: data.commandSources,
          detectedEnvVars: data.detectedEnvVars,
        };
      }
    }
  } catch {
    // If backend endpoint is unreachable, fallback gracefully
  }

  // Fallback: if repo is known static site like 2048
  const lower = repoName.toLowerCase();
  if (lower.includes('2048') || lower.includes('html5') || lower.includes('game') || lower.includes('static')) {
    return {
      runtimeType: 'static',
      details: 'Static HTML5 website with no build step required',
      startCommand: 'Built-in Static Server',
      buildCommand: 'None (Static files)',
      commandSources: {
        startCommand: 'Auto-configured: served by Repomova built-in static server',
        buildCommand: 'Auto-configured: plain HTML site requires no build step',
      },
      detectedEnvVars: [],
    };
  }

  return { runtimeType: 'unknown', details: 'Unrecognized runtime structure' };
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
 * Launches an application using real-time SSE stream from the runtime gateway
 */
export function launchAppWithEvents(
  app: ConnectedApp,
  onStageChange: (stage: LaunchStage, message?: string) => void
): Promise<LaunchResult> {
  return new Promise((resolve, reject) => {
    const portQuery = app.port ? `&port=${app.port}` : '';
    const eventUrl = `/api/apps/launch/events?appId=${encodeURIComponent(app.id)}&repoUrl=${encodeURIComponent(app.repoUrl)}&repoName=${encodeURIComponent(app.repoName)}${portQuery}`;
    const eventSource = new EventSource(eventUrl);

    let finished = false;

    const cleanup = () => {
      finished = true;
      eventSource.close();
    };

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
          previewUrl: data.previewUrl || `http://127.0.0.1:${data.port}`,
          port: data.port,
          runtimeType: data.runtimeType || 'static',
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

    // Error event
    eventSource.addEventListener('error', (e: Event) => {
      if (finished) return;
      cleanup();

      let errMsg = 'Connection to runtime gateway failed';
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

    // Timeout safety net (30s)
    setTimeout(() => {
      if (!finished) {
        cleanup();
        reject(new Error('Launch timed out while waiting for server health check'));
      }
    }, 30000);
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
  return false;
}
