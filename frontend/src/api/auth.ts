import { apiClient } from './client';
import { withMock } from './mock';
import type { AuthResponse } from '../types';
import { MOCK_AUTH } from '../mocks/mockData';

export function login(email: string, password: string): Promise<AuthResponse> {
  return withMock(
    // Accept any credentials in mock mode
    () => MOCK_AUTH,
    () => apiClient<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  );
}

export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
