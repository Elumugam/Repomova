/* ============================================
   Static Repository Preview Resolver
   Fetches genuine repository assets & injects CDN base tag
   ============================================ */

export interface StaticPreviewResult {
  html: string;
  branch: string;
  entryPath: string;
  sourceUrl: string;
  baseHref: string;
  previewUrl: string;
}

/**
 * Parses GitHub owner and repo name from various URL formats
 */
export function extractGitHubRepoInfo(urlOrFullName: string): { owner: string; repo: string } | null {
  if (!urlOrFullName) return null;
  const clean = urlOrFullName.trim().replace(/\.git$/, '');

  // https://github.com/owner/repo or http://...
  const matchUrl = clean.match(/github\.com\/([^/]+)\/([^/?#]+)/i);
  if (matchUrl) {
    return { owner: matchUrl[1], repo: matchUrl[2] };
  }

  // owner/repo
  const matchSimple = clean.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (matchSimple) {
    return { owner: matchSimple[1], repo: matchSimple[2] };
  }

  return null;
}

/**
 * Injects <base href="..."> into HTML <head> so all relative scripts, styles,
 * and assets resolve against CDN / raw host rather than failing inside iframes.
 */
export function injectBaseHref(html: string, baseHref: string): string {
  const normalizedBase = baseHref.endsWith('/') ? baseHref : `${baseHref}/`;
  const baseTag = `  <base href="${normalizedBase}">\n`;

  // Insert right after <head> or <head ...>
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n${baseTag}`);
  }

  // Fallback: prepend before <html> or start of document
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, `$1\n<head>\n${baseTag}</head>`);
  }

  return `<head>\n${baseTag}</head>\n${html}`;
}

/**
 * Attempts to fetch the real index.html from a GitHub repository
 * trying standard branches (master, main, gh-pages) and paths.
 */
export async function fetchRepositoryHtml(
  repoUrl: string,
  repoName: string
): Promise<StaticPreviewResult | null> {
  const info = extractGitHubRepoInfo(repoUrl) || extractGitHubRepoInfo(repoName);
  if (!info) return null;

  const { owner, repo } = info;
  const branches = ['master', 'main', 'gh-pages'];
  const paths = ['index.html', 'dist/index.html', 'public/index.html', 'build/index.html'];

  for (const branch of branches) {
    for (const filePath of paths) {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
      try {
        const res = await fetch(rawUrl, { method: 'GET' });
        if (res.ok) {
          const rawHtml = await res.text();
          // Verify it's actually HTML, not a 404 text or redirect
          if (
            rawHtml.length > 50 &&
            (rawHtml.toLowerCase().includes('<!doctype') ||
              rawHtml.toLowerCase().includes('<html') ||
              rawHtml.toLowerCase().includes('<head') ||
              rawHtml.toLowerCase().includes('<body') ||
              rawHtml.toLowerCase().includes('<div'))
          ) {
            const dirPrefix = filePath.includes('/')
              ? filePath.substring(0, filePath.lastIndexOf('/') + 1)
              : '';
            const baseHref = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${dirPrefix}`;
            const injectedHtml = injectBaseHref(rawHtml, baseHref);

            return {
              html: injectedHtml,
              branch,
              entryPath: filePath,
              sourceUrl: rawUrl,
              baseHref,
              previewUrl: `data:text/html;charset=utf-8,${encodeURIComponent(injectedHtml)}`,
            };
          }
        }
      } catch {
        // Continue trying next branch/path
      }
    }
  }

  return null;
}
