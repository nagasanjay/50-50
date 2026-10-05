import { apiFetch, ApiError, buildUrl, refreshAccessToken } from './api';
import { clearAccessToken, getAccessToken, setAccessToken } from './auth';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status',
    json: async () => body,
  } as Response;
}

describe('apiFetch', () => {
  beforeEach(() => {
    clearAccessToken();
    global.fetch = jest.fn();
  });

  it('attaches the access token as a bearer header and returns parsed JSON', async () => {
    setAccessToken('valid-token');
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, { hello: 'world' }));

    const result = await apiFetch<{ hello: string }>('/groups');

    expect(result).toEqual({ hello: 'world' });
    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect((requestInit.headers as Headers).get('Authorization')).toBe('Bearer valid-token');
  });

  it('refreshes the access token once on a 401 and retries the original request', async () => {
    setAccessToken('expired-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-token' }))
      .mockResolvedValueOnce(jsonResponse(200, { balances: [] }));

    const result = await apiFetch<{ balances: unknown[] }>('/groups/1/balances');

    expect(result).toEqual({ balances: [] });
    expect(getAccessToken()).toBe('fresh-token');
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const retryCallHeaders = (global.fetch as jest.Mock).mock.calls[2][1].headers as Headers;
    expect(retryCallHeaders.get('Authorization')).toBe('Bearer fresh-token');
  });

  it('throws an ApiError with the backend message when the request fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      jsonResponse(404, { message: 'Group not found' }),
    );

    await expect(apiFetch('/groups/missing')).rejects.toMatchObject(
      new ApiError(404, 'Group not found'),
    );
  });

  it('does not attempt to refresh when a server-side accessToken was explicitly provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }));

    await expect(
      apiFetch('/groups', { accessToken: 'server-token' }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces the original 401 when the refresh attempt itself fails', async () => {
    setAccessToken('expired-token');
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(401, {}));

    await expect(apiFetch('/groups')).rejects.toMatchObject(new ApiError(401, 'expired'));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns undefined for a 204 No Content response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: async () => {
        throw new Error('should not be called for 204');
      },
    } as unknown as Response);

    const result = await apiFetch('/groups/1/expenses/1');
    expect(result).toBeUndefined();
  });

  it('defaults the Content-Type header to JSON when a body is sent', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, {}));

    await apiFetch('/groups', { method: 'POST', body: JSON.stringify({ name: 'Trip' }) });

    const requestInit = (global.fetch as jest.Mock).mock.calls[0][1];
    expect((requestInit.headers as Headers).get('Content-Type')).toBe('application/json');
  });

});

describe('buildUrl', () => {
  it('goes through the same-origin rewrite proxy in the browser', () => {
    expect(buildUrl('/groups', false)).toBe('/api/groups');
  });

  it('hits the backend directly when rendering on the server', () => {
    expect(buildUrl('/groups', true)).toBe('http://backend:4000/groups');
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => {
    clearAccessToken();
    global.fetch = jest.fn();
  });

  it('stores and returns the new access token on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-token' }));

    const token = await refreshAccessToken();

    expect(token).toBe('new-token');
    expect(getAccessToken()).toBe('new-token');
  });

  it('clears the token and returns null when the refresh request fails', async () => {
    setAccessToken('stale-token');
    (global.fetch as jest.Mock).mockResolvedValueOnce(jsonResponse(401, {}));

    const token = await refreshAccessToken();

    expect(token).toBeNull();
    expect(getAccessToken()).toBeNull();
  });
});
