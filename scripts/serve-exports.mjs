// Local-only static server for the exports gallery (supports Range requests so videos can seek).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const exportRoot = path.join(projectRoot, 'exports');
const types = { '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.png': 'image/png', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8' };

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function reply(req, res, status, message, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(message), ...headers });
  res.end(req.method === 'HEAD' ? undefined : message);
}

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || !size || (!match[1] && !match[2])) return null;
  const first = match[1] ? Number(match[1]) : undefined;
  const last = match[2] ? Number(match[2]) : undefined;
  if ([first, last].some(value => value !== undefined && !Number.isSafeInteger(value))) return null;
  if (first === undefined) {
    if (last <= 0) return null;
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  if (first >= size || (last !== undefined && last < first)) return null;
  return { start: first, end: Math.min(last ?? size - 1, size - 1) };
}

export function createExportsServer(directory = exportRoot) {
  const requestedRoot = path.resolve(directory);
  if (!inside(projectRoot, requestedRoot)) throw new Error('The export folder must stay inside this project.');
  let root;
  try {
    root = fs.realpathSync(requestedRoot);
    if (!fs.statSync(root).isDirectory()) throw new Error('Not a directory');
  } catch {
    throw new Error('Export folder is missing. Render a collection inside exports/ first.');
  }
  if (!inside(projectRoot, root)) throw new Error('The export folder resolves outside this project.');

  return http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { reply(req, res, 405, 'Method not allowed', { Allow: 'GET, HEAD' }); return; }
    let pathname;
    try {
      if (!req.url?.startsWith('/')) throw new Error('Invalid path');
      pathname = decodeURIComponent(req.url.split('?')[0]);
      if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Invalid path');
    } catch { reply(req, res, 400, 'Invalid request path'); return; }
    if (pathname.split('/').includes('..')) { reply(req, res, 404, 'Not found'); return; }

    let target = path.resolve(root, `.${pathname}`), stat;
    if (!inside(root, target)) { reply(req, res, 404, 'Not found'); return; }
    try {
      // Check the resolved target before reading metadata or opening a stream:
      // lexical checks alone do not contain symlinks or Windows junctions.
      target = fs.realpathSync(target);
      if (!inside(root, target)) { reply(req, res, 404, 'Not found'); return; }
      stat = fs.statSync(target);
      if (stat.isDirectory()) {
        target = fs.realpathSync(path.join(target, 'index.html'));
        if (!inside(root, target)) { reply(req, res, 404, 'Not found'); return; }
        stat = fs.statSync(target);
      }
      if (!stat.isFile()) { reply(req, res, 404, 'Not found'); return; }
    } catch { reply(req, res, 404, 'Not found'); return; }

    const size = stat.size;
    const headers = { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Content-Length': size };
    let range;
    if (req.headers.range !== undefined) {
      range = byteRange(req.headers.range, size);
      if (!range) { reply(req, res, 416, 'Range not satisfiable', { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' }); return; }
      headers['Content-Range'] = `bytes ${range.start}-${range.end}/${size}`;
      headers['Content-Length'] = range.end - range.start + 1;
    }
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD' || size === 0) { res.end(); return; }
    const stream = fs.createReadStream(target, range ?? {});
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rawPort = process.argv[2] ?? '4180';
    if (process.argv.length > 3 || !/^\d+$/.test(rawPort) || Number(rawPort) > 65535) throw new Error('Port must be an integer from 0 to 65535.');
    const server = createExportsServer();
    server.on('error', error => { console.error(`Export server failed: ${error.message}`); process.exitCode = 1; });
    server.listen(Number(rawPort), '127.0.0.1', () => console.log(`Serving exports at http://127.0.0.1:${server.address().port}/`));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
