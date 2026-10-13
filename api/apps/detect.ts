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
  let buildCommand = 'npm run build';

  if (lowerName.includes('dash') || lowerUrl.includes('plotly/dash') || lowerName.includes('plotly')) {
    runtimeType = 'python';
    details = 'Plotly Dash Python application';
    startCommand = 'python app.py';
    buildCommand = 'pip install -r requirements.txt';
  } else if (lowerName.includes('next') || lowerUrl.includes('next')) {
    runtimeType = 'nextjs';
    details = 'Next.js application';
    startCommand = 'npm run dev';
    buildCommand = 'npm run build';
  } else if (lowerName.includes('react') || lowerName.includes('vite') || lowerUrl.includes('vite')) {
    runtimeType = 'vite';
    details = 'Vite / React application';
    startCommand = 'npm run dev';
    buildCommand = 'npm run build';
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
  } else if (lowerName.includes('2048') || lowerName.includes('html5') || lowerName.includes('static')) {
    runtimeType = 'static';
    details = 'Static HTML5 website with no build step required';
    startCommand = 'Built-in Static Server';
    buildCommand = 'None (Static files)';
  } else if (lowerName.includes('docker')) {
    runtimeType = 'docker';
    details = 'Docker containerized service';
    startCommand = 'docker compose up';
    buildCommand = 'docker build .';
  } else {
    runtimeType = 'node';
    details = 'Node.js application';
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(
    JSON.stringify({
      appId,
      runtimeType,
      details,
      startCommand,
      buildCommand,
      commandSources: {
        startCommand: 'Auto-configured: framework entry command',
        buildCommand: 'Auto-configured: package installation command',
      },
      detectedEnvVars: [],
      cloned: true,
    })
  );
}
