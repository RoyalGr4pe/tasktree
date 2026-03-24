import type { MondayItem } from '@/types';

const MONDAY_API_URL = 'https://api.monday.com/v2';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function mondayRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string
): Promise<T> {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`monday.com API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    const messages = json.errors.map((e: { message: string }) => e.message).join('; ');
    throw new Error(`monday.com GraphQL error: ${messages}`);
  }

  return json.data as T;
}

// ---------------------------------------------------------------------------
// getBoardItems
// Fetches all items for a board using cursor-based pagination.
// monday.com returns up to 500 items per page; we loop until exhausted.
// ---------------------------------------------------------------------------

const ITEMS_QUERY = `
  query GetBoardItems($boardId: ID!, $cursor: String, $limit: Int!) {
    boards(ids: [$boardId]) {
      items_page(limit: $limit, cursor: $cursor) {
        cursor
        items {
          id
          name
          board {
            id
          }
        }
      }
    }
  }
`;

interface ItemsPageResponse {
  boards: Array<{
    items_page: {
      cursor: string | null;
      items: MondayItem[];
    };
  }>;
}

export async function getBoardItems(
  boardId: string,
  token: string,
  maxItems = 2000
): Promise<MondayItem[]> {
  const allItems: MondayItem[] = [];
  let cursor: string | null = null;
  const pageSize = 500;

  do {
    const data: ItemsPageResponse = await mondayRequest<ItemsPageResponse>(
      ITEMS_QUERY,
      {
        boardId,
        cursor: cursor ?? undefined,
        limit: pageSize,
      },
      token
    );

    const board: ItemsPageResponse['boards'][0] | undefined = data.boards?.[0];
    if (!board) break;

    const page: ItemsPageResponse['boards'][0]['items_page'] = board.items_page;
    allItems.push(...page.items);
    cursor = page.cursor ?? null;

    // Safety cap to avoid runaway loops
    if (allItems.length >= maxItems) break;
  } while (cursor);

  return allItems.slice(0, maxItems);
}

// ---------------------------------------------------------------------------
// renameItem
// Uses change_item_name mutation (monday.com API 2024-01+).
// ---------------------------------------------------------------------------

const RENAME_MUTATION = `
  mutation RenameItem($boardId: ID!, $itemId: ID!, $name: String!) {
    change_simple_column_value(board_id: $boardId, item_id: $itemId, column_id: "name", value: $name) {
      id
      name
    }
  }
`;

interface RenameResponse {
  change_simple_column_value: { id: string; name: string };
}

export async function renameItem(
  boardId: string,
  itemId: string,
  name: string,
  token: string
): Promise<void> {
  await mondayRequest<RenameResponse>(
    RENAME_MUTATION,
    { boardId, itemId, name },
    token
  );
}

// ---------------------------------------------------------------------------
// createItem
// Creates a new item on a monday.com board and returns it.
// ---------------------------------------------------------------------------

const CREATE_ITEM_MUTATION = `
  mutation CreateItem($boardId: ID!, $name: String!) {
    create_item(board_id: $boardId, item_name: $name) {
      id
      name
      board {
        id
      }
    }
  }
`;

interface CreateItemResponse {
  create_item: MondayItem;
}

export async function createItem(
  boardId: string,
  name: string,
  token: string
): Promise<MondayItem> {
  const data = await mondayRequest<CreateItemResponse>(
    CREATE_ITEM_MUTATION,
    { boardId, name },
    token
  );
  return data.create_item;
}

// ---------------------------------------------------------------------------
// deleteItem
// Permanently deletes a monday.com item.
// ---------------------------------------------------------------------------

const DELETE_ITEM_MUTATION = `
  mutation DeleteItem($itemId: ID!) {
    delete_item(item_id: $itemId) {
      id
    }
  }
`;

export async function deleteItem(itemId: string, token: string): Promise<void> {
  await mondayRequest<{ delete_item: { id: string } }>(
    DELETE_ITEM_MUTATION,
    { itemId },
    token
  );
}

// ---------------------------------------------------------------------------
// getItemById
// Fetch a single item by id (used for refresh after rename).
// ---------------------------------------------------------------------------

const ITEM_BY_ID_QUERY = `
  query GetItem($itemId: ID!) {
    items(ids: [$itemId]) {
      id
      name
      board {
        id
      }
    }
  }
`;

interface ItemByIdResponse {
  items: MondayItem[];
}

export async function getItemById(
  itemId: string,
  token: string
): Promise<MondayItem | null> {
  const data = await mondayRequest<ItemByIdResponse>(
    ITEM_BY_ID_QUERY,
    { itemId },
    token
  );
  return data.items?.[0] ?? null;
}
