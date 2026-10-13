import type { IncomingMessage, ServerResponse } from 'http';
import { fetchRepositoryHtml } from '../../src/lib/staticPreview.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '', 'http://127.0.0.1');
  const repoUrl = parsedUrl.searchParams.get('repoUrl') || '';
  const repoName = parsedUrl.searchParams.get('repoName') || 'app';

  if (!repoUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Missing repoUrl query parameter');
    return;
  }

  try {
    const preview = await fetchRepositoryHtml(repoUrl, repoName);
    if (!preview) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;background:#111;color:#eee;">
        <h2>Entry point not found</h2>
        <p>Could not locate <code>index.html</code> in repository <strong>${repoUrl}</strong>.</p>
      </body></html>`);
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(preview.html);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`Error resolving repository preview: ${msg}`);
  }
}
