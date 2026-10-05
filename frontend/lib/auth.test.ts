import { clearAccessToken, getAccessToken, setAccessToken } from './auth';

describe('auth token cookie helpers', () => {
  afterEach(() => {
    clearAccessToken();
  });

  it('returns null when no token has been set', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('stores and retrieves the access token', () => {
    setAccessToken('abc.def.ghi');
    expect(getAccessToken()).toBe('abc.def.ghi');
  });

  it('clears the access token', () => {
    setAccessToken('abc.def.ghi');
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it('url-encodes and decodes token values safely', () => {
    setAccessToken('token;with=special,chars');
    expect(getAccessToken()).toBe('token;with=special,chars');
  });

});
