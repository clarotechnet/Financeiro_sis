import assert from 'node:assert/strict';
import test from 'node:test';
import { collectRecoveryParams, getPasswordRecoveryRedirect } from '../src/lib/passwordRecovery.ts';

const location = (value) => new URL(value, 'https://example.com');

test('recovery callbacks at the site root go to the reset page without losing tokens', () => {
  const url = location('/#access_token=test-access&refresh_token=test-refresh&type=recovery');
  assert.equal(getPasswordRecoveryRedirect(url), `/redefinir-senha${url.hash}`);
  assert.equal(collectRecoveryParams(url).type, 'recovery');
});

test('recovery callbacks take priority over login and protected routes', () => {
  for (const path of ['/login', '/dre-consolidado', '/configuracoes']) {
    const url = location(`${path}?type=recovery&code=test-code`);
    assert.equal(getPasswordRecoveryRedirect(url), `/redefinir-senha${url.search}`);
  }
});

test('callbacks already on the reset page do not create redirect loops', () => {
  assert.equal(getPasswordRecoveryRedirect(location('/redefinir-senha#type=recovery')), null);
});

test('normal login, signup and OAuth callbacks are not treated as password recovery', () => {
  for (const path of [
    '/',
    '/login',
    '/?code=oauth-code',
    '/#access_token=test-access&refresh_token=test-refresh&type=signup',
    '/#access_token=test-access&refresh_token=test-refresh&type=invite',
  ]) {
    assert.equal(getPasswordRecoveryRedirect(location(path)), null);
  }
});

test('parameters are read from query strings, fragments and legacy hash routes', () => {
  for (const path of [
    '/redefinir-senha?access_token=test-access&refresh_token=test-refresh&type=recovery',
    '/redefinir-senha#type=recovery&access_token=test-access&refresh_token=test-refresh',
    '/#/redefinir-senha?type=recovery&access_token=test-access&refresh_token=test-refresh',
    '/#/redefinir-senha#access_token=test-access&refresh_token=test-refresh&type=recovery',
  ]) {
    const params = collectRecoveryParams(location(path));
    assert.equal(params.accessToken, 'test-access');
    assert.equal(params.refreshToken, 'test-refresh');
    assert.equal(params.type, 'recovery');
  }
});

test('query parameters take precedence and encoded token values are preserved', () => {
  const url = location('/?type=recovery&code=test%2Bcode%3D#type=signup&code=other');
  assert.equal(collectRecoveryParams(url).type, 'recovery');
  assert.equal(collectRecoveryParams(url).code, 'test+code=');
  assert.equal(getPasswordRecoveryRedirect(url), `/redefinir-senha${url.search}${url.hash}`);
});

test('expired or rejected callbacks are detected before using an existing session', () => {
  for (const path of [
    '/redefinir-senha#error=access_denied&error_code=otp_expired',
    '/redefinir-senha?error_code=otp_expired',
    '/redefinir-senha#error_description=Email+link+is+invalid+or+has+expired',
  ]) {
    assert.equal(collectRecoveryParams(location(path)).hasError, true);
  }
  assert.equal(collectRecoveryParams(location('/redefinir-senha?code=test-code')).hasError, false);
});
