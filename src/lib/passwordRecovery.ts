export const PASSWORD_RESET_PATH = '/redefinir-senha';

type RecoveryLocation = {
  pathname: string;
  search: string;
  hash: string;
};

export const collectRecoveryParams = (location: Pick<RecoveryLocation, 'search' | 'hash'>) => {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.slice(1);

  const mergeParams = (raw: string) => {
    const cleaned = raw.replace(/^[#?&]/, '');
    if (!cleaned) return;

    new URLSearchParams(cleaned).forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  };

  mergeParams(hash);

  const queryIndex = hash.indexOf('?');
  if (queryIndex >= 0) mergeParams(hash.slice(queryIndex + 1));

  const nestedHashIndex = hash.indexOf('#');
  if (nestedHashIndex >= 0) mergeParams(hash.slice(nestedHashIndex + 1));

  return {
    type: params.get('type'),
    code: params.get('code'),
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    hasError: Boolean(params.get('error') || params.get('error_code') || params.get('error_description')),
  };
};

export const getPasswordRecoveryRedirect = (location: RecoveryLocation) => {
  if (location.pathname === PASSWORD_RESET_PATH) return null;
  if (collectRecoveryParams(location).type !== 'recovery') return null;

  // Keep the callback intact until the public reset page validates the session.
  return `${PASSWORD_RESET_PATH}${location.search}${location.hash}`;
};
