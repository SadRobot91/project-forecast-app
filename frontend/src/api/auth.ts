import { apiClient } from './client';
import type { AuthResponse } from '../types';
import { MOCK_AUTH } from '../mocks/mockData';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export async function login(email: string, password: string): Promise<AuthResponse> {
  if (USE_MOCK) {
    // Accept any credentials in mock mode
    await new Promise((r) => setTimeout(r, 600)); // simulate network
    return MOCK_AUTH;
  }
  return apiClient<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
