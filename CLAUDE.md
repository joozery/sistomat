# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (default port 3000)
npm run build    # Production build + TypeScript check
npm run start    # Run production build
npm run lint     # Run ESLint
```

## Environment Variables

Requires `.env.local` at project root:

```
MONGODB_URI=mongodb://wooyou_app:<password>@72.60.195.203:27017/sistomat?authSource=admin
JWT_SECRET=<secret>
```

## Architecture

**Next.js 16 App Router** — full-stack, no separate backend server.

### Auth Flow

1. `middleware.ts` — reads `auth_token` cookie; redirects unauthenticated requests from `/dashboard/*` to `/login`, and authenticated users away from `/login`
2. Login page (`/login`) calls `POST /api/users/login`, receives JWT, stores token in **both** `document.cookie` (for middleware) and `localStorage` (for client components that attach `Authorization: Bearer` headers)
3. Logout clears both cookie and localStorage

### API Layer (`src/app/api/`)

All routes connect to MongoDB via `src/lib/mongodb.ts` (singleton `MongoClient`). Protected routes extract JWT from `Authorization: Bearer` header or `auth_token` cookie and call `jwt.verify()` before querying.

| Route | Auth | Collection |
|-------|------|------------|
| `POST /api/users/login` | public | `users` |
| `GET /api/projects` | required | `projects` |
| `POST /api/projects/add` | required | `projects` |

### Database (`sistomat` on MongoDB)

**`users`** — `{ username, password (bcrypt), role, created_at }`
**`projects`** — `{ project_id, received_date, due_date, status, created_at }`

To seed a new user:
```bash
node -e "
const {MongoClient}=require('mongodb');const bcrypt=require('bcryptjs');
const client=new MongoClient(process.env.MONGODB_URI);
async function run(){await client.connect();const db=client.db('sistomat');
const hash=await bcrypt.hash('PASSWORD',10);
await db.collection('users').insertOne({username:'USERNAME',password:hash,role:'Admin',created_at:new Date()});
await client.close();}run();
"
```

### UI Layer (`src/app/dashboard/`)

Dashboard is a nested layout: `dashboard/layout.tsx` wraps every page with `SidebarProvider` → `AppSidebar` + `SidebarInset` → `AppNavbar` + `<main>`.

**shadcn/ui uses Base UI** (`@base-ui/react`) — not Radix UI. Key differences:
- Use `render` prop instead of `asChild`: `<SidebarMenuButton render={<Link href="..." />}>`
- `DropdownMenuTrigger` does not support `asChild`; style it directly with `className`
- Components live in `src/components/ui/` and should not be edited manually (re-run `npx shadcn@latest add <component>` to update)

**Client components** — any page using `useState`, `useEffect`, `useRouter`, `useParams`, `localStorage`, or browser-only libraries (chart.js, react-barcode) must have `'use client'` at the top.

**react-barcode** must be loaded with `dynamic(..., { ssr: false })` since it requires `window`.

### Fonts & Styling

Root layout (`src/app/layout.tsx`) loads **Prompt** (Google Fonts, Thai + Latin subsets) as `variable: '--font-sans'`, making it the default font for all shadcn components. Tailwind CSS v4 is used — no `tailwind.config.js`; theme tokens are defined in `src/app/globals.css` via `@theme inline`.
