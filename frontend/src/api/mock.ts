// Punto unico di intercettazione per la modalità mock (VITE_USE_MOCK=true).
// Le funzioni api diventano: withMock(() => MOCK_X, () => apiClient(...)).

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const MOCK_LATENCY_MS = 300;

export async function withMock<T>(mockFn: () => T | Promise<T>, realFn: () => Promise<T>): Promise<T> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));
    return mockFn();
  }
  return realFn();
}
