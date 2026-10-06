type RequestOptions = {
 base: string; token: string; deadline: number;
 fetcher?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>;
};
export function retryAfterMs(value: string | null, now: number): number {
 if (!value) return 0;
 const seconds = Number(value);
 if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
 const date = Date.parse(value);
 return Number.isFinite(date) ? Math.max(0, date - now) : 0;
}
// One requester per sync: requests and page retries share the same pacing state.
export function createQuarkRequester(options: RequestOptions) {
 const fetcher = options.fetcher || fetch;
 const now = options.now || Date.now;
 const sleep = options.sleep || ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
 let nextAt = 0;
 let interval = 1200;
 const timeError = () => new Error('O QuarkRH não liberou a consulta dentro do tempo seguro. Aguarde alguns minutos e tente novamente. Nenhum cadastro foi alterado.');
 return async (path: string, unit?: string): Promise<unknown> => {
  for (let attempt = 0; attempt < 5; attempt++) {
   const delay = Math.max(0, nextAt - now());
   if (now() + delay + 1000 >= options.deadline) throw timeError();
   if (delay) await sleep(delay);
   const remaining = options.deadline - now();
   if (remaining <= 1000) throw timeError();
   const result = await fetcher(options.base + path, {
    headers: { Accept: 'application/json', 'Auth-Token': options.token, ...(unit ? { 'Unidade-ID': unit } : {}) },
    signal: AbortSignal.timeout(Math.min(20_000, remaining)),
   });
   nextAt = now() + interval;
   if (result.status === 429) {
    const retryAfter = retryAfterMs(result.headers.get('Retry-After'), now());
    await result.body?.cancel();
    if (attempt === 4) throw new Error(`O QuarkRH continua limitando as requisições${unit ? ` na unidade ${unit}` : ''}. Aguarde alguns minutos e tente novamente. Nenhum cadastro foi alterado.`);
    interval = 2500;
    nextAt = now() + Math.max(retryAfter, 3000 * 2 ** attempt, interval);
    continue;
   }
   if (!result.ok) {
    await result.body?.cancel();
    throw new Error(`QuarkRH respondeu HTTP ${result.status}${unit ? ` na unidade ${unit}` : ''}. Nenhum cadastro foi alterado.`);
   }
   return await result.json();
  }
  throw timeError();
 };
}
