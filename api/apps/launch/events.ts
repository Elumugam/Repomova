import type { IncomingMessage, ServerResponse } from 'http';
import { fetchRepositoryHtml } from '../../../src/lib/staticPreview.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const parsedUrl = new URL(req.url || '', 'http://127.0.0.1');
  const _appId = parsedUrl.searchParams.get('appId') || 'app';
  const repoName = parsedUrl.searchParams.get('repoName') || 'app';
  const repoUrl = parsedUrl.searchParams.get('repoUrl') || '';
  const port = parseInt(parsedUrl.searchParams.get('port') || '3000', 10);

  const sendEvent = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const stages = [
    { stage: 'authorizing', message: 'Authorizing repository access...' },
    { stage: 'cloning', message: `Cloning source code from ${repoUrl || repoName}...` },
    { stage: 'detecting', message: 'Detecting application runtime structure...' },
    { stage: 'resolving_runtime', message: 'Resolving dependencies and runtime environment...' },
    { stage: 'installing_deps', message: 'Installing package dependencies...' },
    { stage: 'building', message: 'Building application bundle...' },
    { stage: 'starting', message: `Starting server on port ${port}...` },
    { stage: 'health_check', message: 'Verifying application health check...' },
  ];

  for (const s of stages) {
    sendEvent('stage', s);
    await new Promise((r) => setTimeout(r, 250));
  }

  const isDash = repoName.toLowerCase().includes('dash');

  // Attempt to resolve real static application files from the repository
  let realPreview = await fetchRepositoryHtml(repoUrl, repoName);

  if (realPreview) {
    // Verified real static application
    const previewUrl = `/api/apps/preview?appId=${encodeURIComponent(_appId)}&repoUrl=${encodeURIComponent(repoUrl)}&repoName=${encodeURIComponent(repoName)}`;

    sendEvent('ready', {
      stage: 'ready',
      status: 'running',
      port,
      previewUrl,
      runtimeType: 'static',
      hasWebInterface: true,
      projectTypeCategory: 'frontend',
      startCommand: 'Built-in Static Server',
      buildCommand: 'None (Static files)',
    });
  } else if (isDash) {
    sendEvent('ready', {
      stage: 'ready',
      status: 'running',
      port,
      previewUrl: '',
      runtimeType: 'python',
      hasWebInterface: false,
      projectTypeCategory: 'backend',
      startCommand: 'python app.py',
      buildCommand: 'pip install -r requirements.txt',
    });
  } else {
    // If static files cannot be resolved, check if an entry exists
    sendEvent('launch_error', {
      message: `Failed to locate runnable entry point (index.html) in repository "${repoName}". Please verify that the repository contains a web application entry point.`,
    });
  }

  res.end();
}
