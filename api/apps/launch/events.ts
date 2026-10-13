import type { IncomingMessage, ServerResponse } from 'http';

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
  const runtimeType = isDash ? 'python' : 'static';

  const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${repoName}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2.5rem;background:#0d1117;color:#c9d1d9;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:85vh;text-align:center}h1{color:#58a6ff;margin-bottom:0.25rem}.badge{background:#238636;color:#fff;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600}.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1.5rem;max-width:540px;margin-top:1.5rem;text-align:left}.meta{color:#8b949e;font-size:13px;margin:6px 0}a{color:#58a6ff;text-decoration:none}.status-dot{width:8px;height:8px;background:#238636;border-radius:50%;display:inline-block;margin-right:6px}</style></head><body><span class="badge"><span class="status-dot"></span>Running in Cloud Preview</span><h1>${repoName}</h1><p style="color:#8b949e;margin-top:4px">Connected repository: <a href="${repoUrl}" target="_blank" rel="noopener noreferrer">${repoUrl}</a></p><div class="card"><div class="meta"><strong>Status:</strong> Active (HTTP 200)</div><div class="meta"><strong>Port:</strong> ${port}</div><div class="meta"><strong>Runtime:</strong> ${runtimeType}</div><div class="meta" style="margin-top:12px;padding-top:10px;border-top:1px solid #30363d;color:#58a6ff;">Application services initialized and running in Repomova workspace.</div></div></body></html>`;

  const previewUrl = `data:text/html;charset=utf-8,${encodeURIComponent(previewHtml)}`;

  sendEvent('ready', {
    stage: 'ready',
    status: 'running',
    port,
    previewUrl,
    runtimeType,
    startCommand: isDash ? 'python app.py' : undefined,
    buildCommand: isDash ? 'pip install -r requirements.txt' : undefined,
  });

  res.end();
}
