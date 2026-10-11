import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createExportsServer } from '../scripts/serve-exports.mjs';

const projectRoot = fs.realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const scratchParent = path.join(projectRoot, '.cache');
fs.mkdirSync(scratchParent, { recursive: true });
const scratch = fs.mkdtempSync(path.join(scratchParent, 'exports-server-test-'));
const gallery = path.join(scratch, 'gallery'), outside = path.join(scratch, 'outside');
fs.mkdirSync(gallery); fs.mkdirSync(outside);
fs.writeFileSync(path.join(gallery, 'clip.mp4'), '0123456789');
fs.writeFileSync(path.join(gallery, 'index.html'), '<p>Local gallery</p>');
fs.writeFileSync(path.join(gallery, 'empty.mp4'), '');
fs.writeFileSync(path.join(outside, 'private.txt'), 'outside-gallery-content');
const junction = path.join(gallery, 'outside-junction');
fs.symlinkSync(outside, junction, process.platform === 'win32' ? 'junction' : 'dir');

let child, port;
const request = (requestPath, headers = {}, method = 'GET') => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, method, headers }, res => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    res.on('error', reject);
  });
  req.on('error', reject); req.end();
});

test.before(async () => {
  const entry = new URL('../scripts/serve-exports.mjs', import.meta.url).href;
  const code = `import { createExportsServer } from ${JSON.stringify(entry)}; const server = createExportsServer(process.argv[1]); server.listen(0, '127.0.0.1', () => console.log(server.address().port));`;
  child = spawn(process.execPath, ['--input-type=module', '-e', code, gallery], { cwd: projectRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', chunk => { errors += chunk; });
  port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${errors}`)), 10000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited with ${code}: ${errors}`)); });
    child.stdout.once('data', chunk => { clearTimeout(timeout); resolve(Number(chunk.toString().trim())); });
  });
  assert.ok(Number.isInteger(port) && port > 0);
});

test.after(async () => {
  if (child && child.exitCode === null) { const closed = once(child, 'exit'); child.kill(); await closed; }
  // Remove the junction itself, then verify the scratch target before deletion.
  fs.unlinkSync(junction);
  assert.equal(path.dirname(fs.realpathSync(scratch)), fs.realpathSync(scratchParent));
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('serves local files, directory indexes and HEAD requests on loopback', async () => {
  const full = await request('/clip.mp4?preview=1');
  assert.equal(full.status, 200); assert.equal(full.body, '0123456789');
  assert.equal(full.headers['content-length'], '10');
  assert.equal(full.headers['content-type'], 'video/mp4');
  assert.equal((await request('/')).body, '<p>Local gallery</p>');
  const head = await request('/clip.mp4', {}, 'HEAD');
  assert.equal(head.status, 200); assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], '10');
  const write = await request('/clip.mp4', {}, 'POST');
  assert.equal(write.status, 405); assert.equal(write.headers.allow, 'GET, HEAD');
});

test('serves explicit, open-ended and suffix byte ranges without overreading', async () => {
  for (const [range, expected, contentRange] of [
    ['bytes=2-5', '2345', 'bytes 2-5/10'],
    ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'],
    ['bytes=8-99', '89', 'bytes 8-9/10'],
    ['bytes=-99', '0123456789', 'bytes 0-9/10'],
  ]) {
    const response = await request('/clip.mp4', { Range: range });
    assert.equal(response.status, 206, range); assert.equal(response.body, expected, range);
    assert.equal(response.headers['content-range'], contentRange, range);
    assert.equal(Number(response.headers['content-length']), expected.length, range);
  }
});

test('invalid byte ranges return 416 while the server remains usable', async () => {
  for (const range of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4', 'bytes=999999999999999999999-', 'nonsense']) {
    const response = await request('/clip.mp4', { Range: range });
    assert.equal(response.status, 416, range); assert.equal(response.headers['content-range'], 'bytes */10');
  }
  assert.equal((await request('/empty.mp4')).status, 200);
  assert.equal((await request('/empty.mp4', { Range: 'bytes=0-' })).status, 416);
  assert.equal((await request('/clip.mp4')).body, '0123456789');
});

test('missing files, traversal and outside junctions reveal no outside content', async () => {
  for (const url of ['/missing', '/../outside/private.txt', '/%2e%2e/outside/private.txt', '/%2e%2e%2foutside/private.txt', '/outside-junction/private.txt']) {
    const response = await request(url);
    assert.equal(response.status, 404, url);
    assert.doesNotMatch(response.body, /outside-gallery-content/, url);
  }
  for (const url of ['/%', '/%FF', '/%00', '/..%5coutside%5cprivate.txt']) {
    assert.equal((await request(url)).status, 400, url);
  }
  assert.equal((await request('/clip.mp4')).status, 200);
});

test('missing or outside serving roots produce clear errors without starting a server', () => {
  assert.throws(() => createExportsServer(path.join(scratch, 'not-created')), /Export folder is missing.*Render a collection/);
  assert.throws(() => createExportsServer(path.dirname(projectRoot)), /must stay inside this project/);
});
