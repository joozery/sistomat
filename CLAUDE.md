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
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<key>
R2_SECRET_ACCESS_KEY=<secret>
R2_BUCKET_NAME=<bucket>
R2_PUBLIC_URL=https://<custom-domain>
```

## Architecture

**Next.js 16 App Router** — full-stack, no separate backend server.

### Auth Flow

1. `middleware.ts` — reads `auth_token` cookie; redirects unauthenticated requests from `/dashboard/*` to `/login`
2. Login calls `POST /api/users/login`, receives JWT, stores in **both** `document.cookie` (for middleware) and `localStorage` (for `Authorization: Bearer` headers in client components)
3. JWT payload: `{ id, username, role }`

### Database (`sistomat` on MongoDB)

Two main collections with overlapping data — this is intentional:

**`projects`** — one document per job/sub-job. Source of truth for process tracking.
```
{
  project_id,       // e.g. "JA-2881-001-01"
  dwg_name,
  received_date, due_date, status,
  level1, level2,   // hierarchy fields (JA-2881, JA-2881-001)
  type,             // "job" when created via /api/jobs POST
  processes: [{
    id, process, target_time, skill,
    workers: [{ worker_id, start_time, stop_time }],  // max 4 workers per process
    elapsed_time, remark
  }],
  file_url, file_name, attachments,  // Cloudflare R2 links
  qc                // QC data object
}
```

**`jobs`** — flattened job list used for hierarchical browsing (`/dashboard/job-list`). Mirrors `projects` but has `job_code`, `drawing_name`, `quantity`, `completed`, `remaining`, `sheet_name` fields. Created simultaneously with `projects` upsert via `POST /api/jobs`.

**`users`** — `{ username, password (bcrypt), role, created_at }`

**`activity_logs`** — `{ username, role, action, target, detail, created_at }`

Job code hierarchy: `JA-2881` (level1) → `JA-2881-001` (level2) → `JA-2881-001-01` (level3 = project_id)

### API Routes (`src/app/api/`)

All routes verify JWT from `Authorization: Bearer` header or `auth_token` cookie.

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/users/login` | POST | Public auth |
| `/api/projects` | GET | List projects with pagination/search |
| `/api/projects/add` | POST | Create project (legacy path) |
| `/api/projects/[id]` | GET/PUT/DELETE | Get, update processes/status/qc, delete with cascade |
| `/api/jobs` | GET/POST | List jobs (with level/search filters), create job + upsert project |
| `/api/jobs/import` | POST | Bulk import from Excel (JSON payload) |
| `/api/jobs/process-summary` | GET | Aggregated process stats |
| `/api/realtime` | GET | All active/completed/idle worker sessions across all projects |
| `/api/upload` | POST | Upload file to Cloudflare R2 (PDF, STL, STEP, OBJ, 3MF, GLB) |
| `/api/file-proxy` | GET | Proxy R2 files for CORS-restricted viewers |
| `/api/activity` | GET/POST | Activity log read/write |
| `/api/notifications` | GET | Notifications |
| `/api/quotations/[code]` | GET | Quotation data |
| `/api/convert-step` | POST | STEP→GLB conversion via occt-import-js |

DELETE `/api/projects/[id]` cascades: deletes the project document plus all `projects` and `jobs` where `level1` matches (cleans up the whole job tree).

### UI Layout

Dashboard: `dashboard/layout.tsx` → `SidebarProvider` → `AppSidebar` + `SidebarInset` → `AppNavbar` + `<main>` + `GlobalBarcodeScanner`

Page components with significant logic live in `src/components/pages/<page-name>/` — pages themselves are thin wrappers that import from there.

### Barcode Scanner System

`GlobalBarcodeScanner` (rendered in dashboard layout) captures all keystrokes globally using `document.addEventListener('keydown', handler, { capture: true })`. Capture phase is required — element-level handlers in some pages call `stopPropagation`.

Key design decisions:
- Uses `e.code` (physical key position) + `codeToChar()` instead of `e.key` — bypasses Thai keyboard layout remapping
- Skips capture when `document.activeElement` is INPUT/TEXTAREA/SELECT
- Dispatches `CustomEvent('onBarcodeScan', { cancelable: true })` on Enter after buffer builds
- Job QR codes encode `JOB_ID|DWG_NAME`; navigation uppercases the job ID before routing (scanner sends lowercase)
- Pages that handle scans locally call `e.preventDefault()` on the CustomEvent to suppress navigation

In `process-details/[id]/page.tsx`, scan logic:
1. If scanned value matches current job ID (case-insensitive) → use logged-in user's identity (decoded from JWT in localStorage) to auto-START or auto-STOP timer
2. If a row is selected (`activeRowIndex`) → treat scan as a worker code lookup

Worker permissions live in `src/lib/workers.ts` — hardcoded list mapping worker codes to machine types. `canWorkerDoProcess()` checks process name against machine permissions.

### File Handling

Files upload to Cloudflare R2 via `POST /api/upload`. Supported: PDF, STL, STEP/STP, OBJ, 3MF, GLB/GLTF.

3D viewing: `Viewer3D.tsx` uses `@react-three/fiber` + `@react-three/drei`. STEP files are converted server-side via `occt-import-js` (`/api/convert-step`). All 3D viewers must use `dynamic(..., { ssr: false })`.

### shadcn/ui — Base UI, not Radix

This project uses `@base-ui/react`, not Radix UI. Critical differences:
- Use `render` prop instead of `asChild`: `<SidebarMenuButton render={<Link href="..." />}>`
- `DropdownMenuTrigger` does not support `asChild`
- Re-add components via `npx shadcn@latest add <component>`, never edit `src/components/ui/` manually

### Other UI Notes

- **Fonts**: Prompt (Google Fonts, Thai + Latin) loaded as `--font-sans` in root layout
- **Tailwind v4**: no `tailwind.config.js`; theme tokens in `src/app/globals.css` via `@theme inline`
- **SSR-unsafe libs**: `react-barcode`, `qrcode.react` (`QRCodeSVG`), chart.js, Three.js — all must use `dynamic(..., { ssr: false })`
- **Toast keys**: use a `useRef` counter, not `Date.now()` — toasts created in the same millisecond cause duplicate key errors

### Seed a User

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
