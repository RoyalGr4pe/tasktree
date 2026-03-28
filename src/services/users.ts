'use client';

import { apiFetch } from '@/lib/api-fetch';
import type { MondayUser } from '@/types';

export async function getUsers(): Promise<MondayUser[]> {
  const res = await apiFetch('/api/users');
  const { users } = await res.json();
  return users ?? [];
}
