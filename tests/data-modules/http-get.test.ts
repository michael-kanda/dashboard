import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { buildUrl, httpGet, HttpError, parseBody } from '../../src/lib/http-get.ts';

test('buildUrl hängt Parameter an und lässt undefined weg', () => {
  const url = new URL(buildUrl('https://api.example.test/v1/?a=1', { key: 'k y', url: '*.example.at/*', leer: undefined, n: 50 }));
  assert.equal(url.searchParams.get('a'), '1');
  assert.equal(url.searchParams.get('key'), 'k y');
  assert.equal(url.searchParams.get('url'), '*.example.at/*');
  assert.equal(url.searchParams.get('n'), '50');
  assert.equal(url.searchParams.has('leer'), false);
});

test('parseBody liest JSON, sonst Text (wie axios)', () => {
  assert.deepEqual(parseBody('{"d":[1]}'), { d: [1] });
  assert.deepEqual(parseBody(' [1,2] '), [1, 2]);
  assert.equal(parseBody('Keyword;Position\nanwalt;3'), 'Keyword;Position\nanwalt;3');
  assert.equal(parseBody('{kaputt'), '{kaputt');
});

test('httpGet liefert Daten und wirft HttpError bei Fehlerstatus', async () => {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/ok') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ key: url.searchParams.get('key'), accept: req.headers.accept }));
    } else if (url.pathname === '/text') {
      res.end('a|1\nb|2');
    } else if (url.pathname === '/slow') {
      setTimeout(() => res.end('spät'), 500);
    } else {
      res.statusCode = 403;
      res.end(JSON.stringify({ message: 'Key ungültig' }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const ok = await httpGet<{ key: string; accept: string }>(`${base}/ok`, { params: { key: 'abc' }, headers: { Accept: 'application/json' } });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.data, { key: 'abc', accept: 'application/json' });

    const text = await httpGet<string>(`${base}/text`);
    assert.equal(text.data, 'a|1\nb|2');

    await assert.rejects(httpGet(`${base}/fehler`), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 403);
      assert.deepEqual(error.data, { message: 'Key ungültig' });
      assert.equal(error.response.status, 403);
      return true;
    });

    await assert.rejects(httpGet(`${base}/slow`, { timeoutMs: 50 }), (error: unknown) => {
      assert.equal((error as Error).name, 'TimeoutError');
      return true;
    });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
