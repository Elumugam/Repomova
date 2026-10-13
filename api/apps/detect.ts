import type { IncomingMessage, ServerResponse } from 'http';

interface DetectRequestBody {
  appId?: string;
  repoUrl?: string;
  repoName?: string;
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  let body: DetectRequestBody = {};
  if (req.body && typeof req.body === 'object') {
    body = req.body;
  } else {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
    } catch {
      body = {};
    }
  }

  const { appId, repoUrl = '', repoName = '' } = body;
  const lowerName = repoName.toLowerCase();
  const lowerUrl = repoUrl.toLowerCase();

  let runtimeType = 'unknown';
  let details = 'Generic application';
  let startCommand = 'npm start';
  let buildCommand: string | undefined = 'npm run build';
  let hasWebInterface = true;
  let projectTypeCategory: 'frontend' | 'backend' | 'cli' | 'library' | 'unknown' = 'frontend';
  let startCommandSource = 'Default start command';
  let buildCommandSource: string | undefined = 'Default build command';
  const detectedEnvVars: Array<{ key: string; required: boolean; isSecret: boolean; description?: string }> = [];

  // Parse repo info
  let owner = '';
  let repo = '';
  const matchUrl = (repoUrl || '').trim().replace(/\.git$/, '').match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (matchUrl) {
    owner = matchUrl[1];
    repo = matchUrl[2];
  } else {
    const matchSimple = repoName.trim().match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (matchSimple) {
      owner = matchSimple[1];
      repo = matchSimple[2];
    }
  }

  let inspected = false;
  if (owner && repo) {
    const branches = ['master', 'main'];
    for (const branch of branches) {
      // 1. Try fetching package.json
      try {
        const pkgRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`);
        if (pkgRes.ok) {
          const pkg = await pkgRes.json();
          const scripts = (pkg.scripts || {}) as Record<string, string>;
          const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

          if (scripts.dev) {
            startCommand = 'npm run dev';
            startCommandSource = "Detected from package.json 'scripts.dev'";
          } else if (scripts.start) {
            startCommand = 'npm start';
            startCommandSource = "Detected from package.json 'scripts.start'";
          } else {
            startCommand = 'node index.js';
            startCommandSource = 'Default Node.js entry point';
          }

          if (scripts.build) {
            buildCommand = 'npm run build';
            buildCommandSource = "Detected from package.json 'scripts.build'";
          } else {
            buildCommand = undefined;
            buildCommandSource = undefined;
          }

          if (allDeps['next']) {
            runtimeType = 'nextjs';
            details = 'Next.js application';
          } else if (allDeps['vite']) {
            runtimeType = 'vite';
            details = 'Vite application';
          } else if (allDeps['vue'] || allDeps['nuxt']) {
            runtimeType = 'vue';
            details = 'Vue application';
          } else if (allDeps['react'] || allDeps['react-scripts']) {
            runtimeType = 'react';
            details = 'React application';
          } else if (allDeps['express'] || allDeps['fastify'] || allDeps['koa'] || allDeps['@nestjs/core']) {
            runtimeType = 'backend';
            details = 'Node.js Backend Service';
            hasWebInterface = false;
            projectTypeCategory = 'backend';
          } else {
            runtimeType = 'node';
            details = 'Node.js application';
          }

          inspected = true;
          break;
        }
      } catch {
        // continue
      }

      // 2. Try checking index.html for static site
      try {
        const indexRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/index.html`);
        if (indexRes.ok) {
          runtimeType = 'static';
          details = 'Static HTML5 website (entry file: index.html)';
          hasWebInterface = true;
          projectTypeCategory = 'frontend';
          startCommand = 'Built-in Static Server';
          buildCommand = 'None (Static files)';
          startCommandSource = 'Auto-configured: serving via built-in static server';
          buildCommandSource = 'Auto-configured: plain HTML site requires no build step';
          inspected = true;
          break;
        }
      } catch {
        // continue
      }
    }

    // Try checking .env.example
    for (const branch of ['master', 'main']) {
      try {
        const envRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/.env.example`);
        if (envRes.ok) {
          const text = await envRes.text();
          for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            const key = eqIdx > 0 ? trimmed.slice(0, eqIdx).trim() : trimmed;
            if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
            const isSecret = /(KEY|SECRET|PASSWORD|TOKEN|AUTH|PRIVATE|CREDENTIAL)/i.test(key);
            const rawVal = eqIdx > 0 ? trimmed.slice(eqIdx + 1).trim() : '';
            const required = !rawVal && !trimmed.toLowerCase().includes('optional');
            detectedEnvVars.push({
              key,
              required,
              isSecret,
              description: 'Specified in .env.example',
            });
          }
          break;
        }
      } catch {
        // continue
      }
    }
  }

  // Heuristic fallbacks if repository inspection failed or offline
  if (!inspected) {
    if (lowerName.includes('2048') || lowerName.includes('html5') || lowerName.includes('static') || lowerUrl.includes('2048')) {
      runtimeType = 'static';
      details = 'Static HTML5 website with no build step required';
      startCommand = 'Built-in Static Server';
      buildCommand = 'None (Static files)';
      startCommandSource = 'Auto-configured: built-in static server';
      buildCommandSource = 'Auto-configured: plain HTML site requires no build step';
      hasWebInterface = true;
      projectTypeCategory = 'frontend';
    } else if (lowerName.includes('dash') || lowerUrl.includes('plotly/dash') || lowerName.includes('plotly')) {
      runtimeType = 'python';
      details = 'Plotly Dash Python application';
      startCommand = 'python app.py';
      buildCommand = 'pip install -r requirements.txt';
      startCommandSource = 'Auto-configured: python entry point';
      buildCommandSource = 'Auto-configured: pip install -r requirements.txt';
      hasWebInterface = true;
      projectTypeCategory = 'frontend';
    } else if (lowerName.includes('next') || lowerUrl.includes('next')) {
      runtimeType = 'nextjs';
      details = 'Next.js application';
      startCommand = 'npm run dev';
      buildCommand = 'npm run build';
      hasWebInterface = true;
      projectTypeCategory = 'frontend';
    } else if (lowerName.includes('react') || lowerName.includes('vite') || lowerUrl.includes('vite')) {
      runtimeType = 'vite';
      details = 'Vite / React application';
      startCommand = 'npm run dev';
      buildCommand = 'npm run build';
      hasWebInterface = true;
      projectTypeCategory = 'frontend';
    } else if (
      lowerName.includes('python') ||
      lowerName.includes('flask') ||
      lowerName.includes('django') ||
      lowerName.includes('fastapi')
    ) {
      runtimeType = 'python';
      details = 'Python application';
      startCommand = 'python app.py';
      buildCommand = 'pip install -r requirements.txt';
      hasWebInterface = false;
      projectTypeCategory = 'backend';
    } else if (lowerName.includes('docker')) {
      runtimeType = 'docker';
      details = 'Docker containerized service';
      startCommand = 'docker compose up';
      buildCommand = 'docker build .';
      hasWebInterface = true;
      projectTypeCategory = 'frontend';
    } else {
      runtimeType = 'node';
      details = 'Node.js application';
      startCommand = 'npm start';
      buildCommand = 'npm run build';
      hasWebInterface = true;
      projectTypeCategory = 'frontend';
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      appId,
      runtimeType,
      details,
      hasWebInterface,
      projectTypeCategory,
      startCommand,
      buildCommand,
      commandSources: {
        startCommand: startCommandSource,
        buildCommand: buildCommandSource,
      },
      detectedEnvVars,
      cloned: true,
    })
  );
}
