export interface MondayUser {
  id: string;
  name: string;
  avatar: string; // photo_thumb URL or empty string
}

const MONDAY_API_URL = 'https://api.monday.com/v2';

const USERS_QUERY = `
  query {
    users(kind: non_guests) {
      id
      name
      photo_thumb
    }
  }
`;

// Module-level cache — lives for the duration of the server process.
// Keyed by API token so multiple workspaces don't bleed into each other.
const cache = new Map<string, { users: MondayUser[]; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getWorkspaceUsers(token: string): Promise<MondayUser[]> {
  const cached = cache.get(token);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.users;
  }

  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query: USERS_QUERY }),
  });

  if (!response.ok) {
    throw new Error(`monday.com API error fetching users: ${response.status}`);
  }

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(`monday.com GraphQL error: ${json.errors.map((e: { message: string }) => e.message).join('; ')}`);
  }

  const users: MondayUser[] = (json.data?.users ?? []).map(
    (u: { id: string; name: string; photo_thumb: string }) => ({
      id: String(u.id),
      name: u.name,
      avatar: u.photo_thumb ?? '',
    })
  );

  cache.set(token, { users, fetchedAt: Date.now() });
  return users;
}
