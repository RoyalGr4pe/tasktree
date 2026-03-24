# TaskTree

Unlimited task hierarchy for monday.com boards. Built as a monday.com marketplace Board View app.

## Tech Stack

- **Next.js 14** (App Router)
- **React 18** + TypeScript
- **TailwindCSS**
- **dnd-kit** (drag-and-drop)
- **Supabase** (Postgres – tree persistence)
- **monday.com Apps SDK** + GraphQL API

---

## Project Structure

```
/app
  /api/monday
    /tree       GET (fetch nodes) · POST (sync items) · PATCH (update node)
    /items      GET (proxy to monday GraphQL)
    /rename     PATCH (rename monday item)
  /board-view   Main embedded board view page
  layout.tsx
  globals.css

/components
  /Tree
    Tree.tsx        DndContext wrapper, optimistic updates
    TreeNode.tsx    Sortable node with inline rename
    DragLayer.tsx   Custom drag overlay
  /ui
    Spinner.tsx
    ErrorBoundary.tsx

/lib
  monday.ts       getBoardItems (paginated), renameItem
  supabase.ts     Supabase client
  tree-utils.ts   buildTree, flattenTree, calculateDepth, reorderNodes

/types
  index.ts        All TypeScript interfaces

/supabase/migrations
  001_initial.sql  Postgres schema
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_DEV_BOARD_ID` | (local dev only) A monday.com board ID |
| `NEXT_PUBLIC_DEV_TOKEN` | (local dev only) A monday.com personal API token |

### 3. Run the Supabase migration

In the Supabase dashboard → SQL Editor, run:

```sql
-- contents of supabase/migrations/001_initial.sql
```

Or with the Supabase CLI:

```bash
supabase db push
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000/board-view](http://localhost:3000/board-view).

---

## Deploying to Vercel

```bash
vercel --prod
```

Set the same environment variables in the Vercel dashboard.

After deploying, update `monday-app-manifest.json` and the monday Developer Center with your production URL.

---

## monday.com App Setup

1. Go to [monday.com Developer Center](https://monday.com/developers/apps)
2. Create a new app → Board View feature
3. Set the iframe URL to `https://your-domain.vercel.app/board-view`
4. Request permissions: `boards:read`, `items:read`, `items:write`
5. Install the app on a board

---

## How It Works

1. **Mount**: The board view page initialises the monday SDK and reads `boardId` + `sessionToken` from the SDK context.
2. **Fetch**: Board items are fetched via `/api/monday/items` (server-side proxy to avoid CORS).
3. **Sync**: Items are upserted into Supabase via `/api/monday/tree` POST. Existing nodes are untouched (hierarchy preserved).
4. **Render**: Flat nodes are assembled into a `TreeNode[]` tree and rendered with dnd-kit.
5. **Drag**: On drop, positions and parent IDs are recalculated client-side (optimistic), then PATCHed to Supabase.
6. **Rename**: Double-click a node name to edit inline; saved via `/api/monday/rename`.

---

## Architecture Notes

- The monday session token is **never persisted** — it is forwarded per-request from the SDK via the `x-monday-token` header.
- The Supabase schema uses a self-referential `nodes` table with a `parent_node_id` FK.
- `position` integers are contiguous per parent group; gaps are closed on each drag-end.
- Row Level Security is enabled on the `nodes` table. Tighten the policy before production.
