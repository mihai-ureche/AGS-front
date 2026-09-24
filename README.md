# AGS Insights

Web frontend for [AGS-backend](../AGS-backend). Users sign in with their Microsoft work account. What they see depends on the role and entity grants stored in the backend:

| Page      | Shown with   | What it does                                                                                                                                                           |
| --------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sales** | `sales:read` | Dashboard over Borg product lines for the entities granted to you: KPIs, trend, breakdowns with two-level grouping, weekday × hour heatmap, line detail and CSV export |
| **Users** | `users:read` | Assign roles and entity access, activate/deactivate and soft-delete users (`admin` only)                                                                               |
| **Roles** | `roles:read` | Inspect roles and their permissions; create and delete custom roles (`admin` only)                                                                                     |

Navigation mirrors the permissions from `GET /api/me`. The backend enforces every permission independently. Signed-in users whose role grants none of these see a "waiting for access" screen with their AGS user ID.

Built with React, TypeScript, Vite, MSAL Browser and Recharts. There is no sample or demo data.

## Run locally

Use Node.js 22.12+ and a running AGS-backend.

```bash
npm ci
cp .env.example .env   # fill in the values below
npm run dev
```

Open <http://localhost:5173>.

| Variable                      | Value                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| `VITE_MICROSOFT_CLIENT_ID`    | Application (client) ID of the Entra SPA registration                 |
| `VITE_MICROSOFT_TENANT_ID`    | Directory (tenant) ID; must match the backend's `MICROSOFT_TENANT_ID` |
| `VITE_API_URL`                | Backend origin without a trailing slash, e.g. `http://localhost:3000` |
| `VITE_MICROSOFT_REDIRECT_URI` | Optional; defaults to the current origin followed by `/`              |

All `VITE_` values are public build-time configuration; never put secrets in them. The app shows a configuration screen when a required value is missing.

The backend must allow this origin in `FRONTEND_ORIGINS` (e.g. `http://localhost:5173`).

## Microsoft Entra setup

1. Register a single-tenant application (accounts in your organizational directory only).
2. Under **Authentication → Single-page application**, add `http://localhost:5173/` and your production URL, including the trailing slash.
3. Add Microsoft Graph delegated permission **User.Read** (your tenant may require admin consent).
4. Don't create a client secret or enable implicit grants.

Sign-in uses MSAL's authorization code flow with PKCE, with the cache in session storage. The app acquires a Graph `User.Read` token and sends it to the backend as a bearer token. The backend validates it with Graph and loads the role, permissions and entity grants from PostgreSQL. After sign-in the app calls `POST /api/users` to create or refresh the user row, then `GET /api/me`. A `401` triggers one silent token refresh and a retry.

### First administrator

Every new user starts with the `user` role and no entity grants. To bootstrap:

1. Sign in once; the waiting screen shows **Your AGS user ID**.
2. In AGS-backend run `npm run user:role -- <that-id> admin`.
3. Select **Check again**. Admins still need entity grants to read sales: open **Users**, select yourself and tick the entities. The Sales page links there when you have none.

## Sales dashboard

The query bar at the top loads data from `GET /api/borg/sales`. The refine bar below it filters the loaded lines in the browser.

- **Query:** entity (only granted ones), date range (presets or custom, up to 366 days), document type (BFD receipts / AIM delivery notes), warehouse ID (`gestiune`), include transfers, and compare with the previous period of equal length. These settings live in the URL hash, so views can be bookmarked and shared.
- **Long ranges:** the backend accepts at most 30 days within one calendar year per request. Longer ranges are split into consecutive requests and loaded one after another with a progress bar. Each request uses the backend's maximum `limit` of 50,000 lines. A request that returns exactly the limit shows a "may be incomplete" warning. A 502/503 from Borg is retried once.
- **Refine:** search (product, code, client, document, invoice), sales vs returns, and filters on product, category, warehouse, document type, channel, client, operator, agent and VAT rate.
- **Measure:** net sales, gross sales (incl. VAT), gross margin, quantity or documents. The choice drives the trend, breakdown bars and heatmap.
- **Breakdown:** group by any dimension (including day, week, month, weekday, hour), optionally "then by" a second one. Rows expand, columns sort, and the result exports to CSV. The line table exports every refined line with all fields.

Metric definitions: **documents** counts distinct `documentId`. **Margin %** is margin ÷ net, computed only over lines where Borg supplies a margin or cost; the KPI shows how much of net sales that covers. **Returns** are lines with a negative value or quantity. Values are shown in RON exactly as Borg returns them.

Loaded lines stay in memory for the browser tab only: switching pages doesn't refetch, and **Reload** fetches fresh data. Sales data is never written to browser storage.

## Deploy on Render

`render.yaml` defines a **Static Site**: build `npm ci && npm run build`, publish `dist`, rewrite `/*` to `/index.html`. Set `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_TENANT_ID` and `VITE_API_URL` in Render, then register the Render URL as an Entra SPA redirect URI and add it to the backend's `FRONTEND_ORIGINS`. Rebuild after changing any `VITE_` value.

## Checks and layout

```bash
npm run lint
npm test         # unit tests: date chunking, aggregation, filters, CSV, URL params
npm run build    # type-checks, then builds
```

- `src/auth/`: MSAL sign-in (`msal.ts`) and the backend session (`AuthProvider.tsx`)
- `src/api/`: fetch client, endpoint wrappers and backend types
- `src/admin/`: shared users/roles state for the admin pages
- `src/lib/sales.ts`: Borg line normalization, dimensions, metrics, grouping, time series
- `src/lib/dates.ts`: presets, 30-day request chunking, previous period
- `src/pages/`: Sales (`sales/` holds its panels), Users, Roles and the sign-in/access screens
- `src/styles.css`: tokens (light and dark) and layout
