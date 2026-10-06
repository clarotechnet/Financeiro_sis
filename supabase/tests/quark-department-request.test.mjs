import assert from 'node:assert/strict';
import { createQuarkRequester, retryAfterMs } from '../functions/sync-quark-department/quark-request.ts';
const fixture = (statuses, retryAfter = null, deadline = 120_000) => {
 let clock = 0; const called = [];
 const request = createQuarkRequester({ base: 'https://fixture/', token: 'test', deadline,
  now: () => clock, sleep: async ms => { clock += ms; },
  fetcher: async () => { called.push(clock); const status = statuses.shift() ?? 200; return new Response(JSON.stringify({ok:true}), {status,headers:retryAfter ? {'Retry-After':retryAfter} : {}}); },
 });
 return {request,called};
};
assert.equal(retryAfterMs('7', 0), 7000);
assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:00:10 GMT', 2000), 8000);
assert.equal(retryAfterMs('invalid', 0), 0);
let f = fixture([200,200]); await f.request('first'); await f.request('next'); assert.deepEqual(f.called,[0,1200]);
f = fixture([429,200,200],'7'); await f.request('retry'); await f.request('next'); assert.deepEqual(f.called,[0,7000,9500]);
f = fixture([429,429,200]); await f.request('retry'); assert.deepEqual(f.called,[0,3000,9000]);
f = fixture([429,429,429,429,429]); await assert.rejects(()=>f.request('retry'),/continua limitando/); assert.equal(f.called.length,5);
f = fixture([429,200],'120',60_000); await assert.rejects(()=>f.request('retry'),/tempo seguro/); assert.equal(f.called.length,1);
f = fixture([401]); await assert.rejects(()=>f.request('unauthorized'),/HTTP 401/); assert.equal(f.called.length,1);
console.log('Requisições: espaçamento, Retry-After, espera progressiva, limite e falhas passaram.');
