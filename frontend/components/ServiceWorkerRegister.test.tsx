import { render } from '@testing-library/react';
import { ServiceWorkerRegister } from './ServiceWorkerRegister';

describe('ServiceWorkerRegister', () => {
  afterEach(() => {
    // jsdom has no native serviceWorker support, so tests must clean up any
    // property they defined on the shared `navigator` object.
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  });

  it('registers the service worker on mount', () => {
    const register = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register },
      configurable: true,
    });

    render(<ServiceWorkerRegister />);

    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('does not throw when the browser has no serviceWorker support', () => {
    // jsdom does not implement the serviceWorker API by default, so this is
    // already the unsupported case with no further setup needed.
    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
  });
});
