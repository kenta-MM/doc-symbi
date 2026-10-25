import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
export async function serveTestBuild() {
  const root = resolve('.test-build');
  let version = 1;
  const server = createServer((request, response) => {
    void (async () => {
      const path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
      const file = resolve(root, `.${path === '/' ? '/index.html' : path}`);
      if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
      try {
        const mime: Record<string, string> = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
        const body = await readFile(file);
        response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
        response.end(path === '/service-worker.js' ? Buffer.concat([body, Buffer.from(`\n// test deployment ${version}`)]) : body);
      } catch { response.writeHead(404).end(); }
    })();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  return { origin: `http://127.0.0.1:${address.port}`, update: () => { version++; }, close: () => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); }) };
}
