# AGS Insights

Web frontend for [AGS-backend](../AGS-backend). The interface is in Romanian and uses the Agritehnica brand greens and mark from [agritehnica.ro](https://www.agritehnica.ro/). Users sign in with their Microsoft work account. What they see depends on the role and entity grants stored in the backend:

| Page      | Shown with   | What it does                                                                                                                                |
| --------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sales** | `sales:read` | Agritehnica sales from Borg's accounting ledger (accounts 707 and 709), grouped by gestiune: KPIs, trend, per-gestiune table and CSV export |
| **Users** | `users:read` | Assign roles and entity access, activate/deactivate and soft-delete users (`admin` only)                                                    |
| **Roles** | `roles:read` | Inspect roles and their permissions; create and delete custom roles (`admin` only)                                                          |

Users and Roles sit under the **Administrare** menu in the sidebar. Navigation mirrors the permissions from `GET /api/me`. The backend enforces every permission independently. Signed-in users whose role grants none of these see a "waiting for access" screen with their AGS user ID.

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

Sign-in uses MSAL's authorization code flow with PKCE, with the cache in local storage so every tab shares the session. MSAL encrypts that cache with a key that lasts until the browser closes; when nothing usable is cached, the app tries a silent sign-in (`ssoSilent`) with the Microsoft session before showing the login screen. That runs in a hidden same-origin iframe, so the site must not send `X-Frame-Options: DENY`. The app acquires a Graph `User.Read` token and sends it to the backend as a bearer token. The backend validates it with Graph and loads the role, permissions and entity grants from PostgreSQL. After sign-in the app calls `POST /api/users` to create or refresh the user row, then `GET /api/me`. A `401` triggers one silent token refresh and a retry.

### First administrator

Every new user starts with the `user` role and no entity grants. To bootstrap:

1. Sign in once; the waiting screen shows **Your AGS user ID**.
2. In AGS-backend run `npm run user:role -- <that-id> admin`.
3. Select **Check again**. Admins still need entity grants to read sales: open **Users**, select yourself and tick the entities. The Sales page links there when you have none.

## Sales dashboard

The dashboard shows **Agritehnica** only, grouped by gestiune. It reads
`GET /api/borg/sales`, which returns Borg's accounting ledger entries
(`{ meta, entries }`) rather than product lines, so there are no products,
categories, clients, operators, VAT or margin to break sales down by.

- **Query:** date range (presets or custom, up to 366 days) and a comparison with the previous period of equal length. These settings live in the URL hash, so views can be bookmarked and shared. The entity is fixed; other entities' ledgers are not shown.
- **What counts as a sale** (`src/lib/sales.ts`), by the account an entry is posted to, excluding VAT:
  - **Vânzări:** the credit leg on `707.G.*`. Credit notes (`FCS`) and delivery-note reversals (`AIMS`) are negative amounts and reduce sales; they are also shown as **Stornări**.
  - **Discounturi:** the credit leg on `707.Discount.*` (booked as negative amounts) plus the debit leg on `709`. A reversal reduces the discount.
  - **Vânzări după discounturi** is sales minus discounts.
  - Only these natural sides count. A document's total line (`tipCompunere` 10, no credit account), the VAT legs (`4427`, `4428`), services (`704`), other revenue (`7588`), stock cost (`607`/`371`) and the opposite side of 707/709 (such as a month-end closing) are not sales. Entries that touch 707/709 but cannot count are reported in a note under the cards.
- **Requests:** each 30-day chunk makes two requests, `account=707` and `account=709`, merged and de-duplicated by the entry `id`. Long ranges are loaded one request after another with a progress bar, at the backend's maximum `limit` of 50,000. `meta.truncated` is exact; a truncated chunk marks the totals as partial and withholds the previous-period comparison. A 502/503 from Borg is retried once. A bad `account` or any filter the backend does not know returns `400`, so the page sends only `targetEntity`, `from`, `to`, `account` and `limit`.
- **Gestiune groups:** the gestiuni are split into **Piese** (IDs 1, 2, 6, 9, 10, 14: the six depots), **Utilaje** (8, 16, 17, 18, 19, 20) and **Irigații** (15). A gestiune in no list, and an entry without a gestiune, is **Nealocate**; that tab appears only when it has sales, so the groups always add up to the total and a new or forgotten gestiune shows up instead of being filed under a group. Tabs above the cards switch between Toate and each group, and every figure, the trend, the table and the CSV follow the tab; each tab shows its sales after discounts. The group is a view over the loaded period, so switching does not reload, and it is kept in the URL (`group=piese|utilaje|irigatii|unassigned`). The membership is a fixed list in `src/lib/sales.ts` (`salesGroups`, one list of `[id, name]` per group); changing it means editing that list.
- **Gestiuni:** entries are grouped by `gestiuneId` and named by their `depozit`. An entry without a gestiune lands in **Fără gestiune** so the rows add up to the total. The account suffix is not the gestiune (`707.G.15` is booked in gestiune 16), so the entry's own `gestiuneId` is used. The panel shows the share strip (top three in color, the rest as "Altele") and a table with sales, discounts, sales after discounts, documents and share, with a total row and a CSV export.
- **Measure:** sales after discounts, sales, discounts or documents. The choice drives the trend and the gestiune share. The trend can be split by gestiune (top three).
- **Documents** counts distinct `documentId` of sale entries. A document can have entries in several gestiuni, so the rows may add up to more than the total.

**Accuracy:** the dashboard uses live accounting ledger entries. The saved September 2026 Piese sales report covers **September 1–29**, rather than the full month, and uses a different document set. Its CSV exports sum to 5,387,882.17 lei in sales and 227,735.06 lei in discounts; the supplied business figures are 5,387,882.07 and 227,735.00. These are report references, not expected totals for the live full-month ledger.

Verified against live Borg on October 5, 2026, through the frontend loader, normalization and Piese warehouse filter (IDs 1, 2, 6, 9, 10, 14):

| Period | Sales (lei) | Discounts (lei) | Sales after discounts (lei) |
| --- | ---: | ---: | ---: |
| September 1–29, 2026 | 5,419,073.77 | 228,921.11 | 5,190,152.66 |
| September 1–30, 2026 | 6,045,987.05 | 229,545.15 | 5,816,441.90 |

Both full-month account responses reported `meta.truncated: false`, and the frontend ignored no entries. **Luna trecută**, when selected in October 2026, requests September 1–30. The heading identifies the accounting ledger as the source; no report snapshot or adjustment is substituted for live data. Live values can change when ledger entries are added or corrected.

**Access:** the backend needs `sales:read`, a grant for Agritehnica and a role with access to all revenue groups (`salesGroups: null`). Ledger entries have no category, so roles limited to some groups get `403`; the page explains this instead of requesting data.

**Currency:** Borg returns lei (`suma` is already converted for foreign-currency entries). The **Lei / Euro** switch at the top right shows every amount, chart and CSV export in euro at an editable rate (default 5,10 lei per euro, `DEFAULT_EUR_RATE` in `src/lib/currency.ts`). Euro exports are rounded to cents.

Loaded entries stay in a bounded memory cache for the browser tab. Cached chunks are reused only while the user's role, permissions and entity grants (from `GET /api/me`) are unchanged, checked before reuse, again before a result is shown, and when the tab gains focus; **Reload** fetches fresh data. Logout and session refresh clear cached sales. Sales data is never written to browser storage; only the currency choice and rate are remembered there, per browser.

## Revenue groups and scoped roles

The backend still classifies Borg's former product lines into revenue groups
with persisted product-category rules (Utilaje, Irigații, Piese, Manoperă,
Other), but the ledger that now backs the Sales page has no categories, so the
dashboard no longer uses them (it has its own fixed split of gestiuni, described above). They remain in two places:

- **Administrare → Grupe de venit** edits the category rules per entity.
- **Roluri** lets a custom sales role be limited to some groups, assigned in
  **Utilizatori**. Such a role cannot read the ledger at all (`403`), so only
  roles with **Toate grupele** see sales.

See [revenue group details](docs/revenue-groups.md) for the API contract and
access rules.

## Deploy on Render

`render.yaml` defines a **Static Site**: build `npm ci && npm run build`, publish `dist`, rewrite `/*` to `/index.html`. Set `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_TENANT_ID` and `VITE_API_URL` in Render, then register the Render URL as an Entra SPA redirect URI and add it to the backend's `FRONTEND_ORIGINS`. Rebuild after changing any `VITE_` value.

## Checks and layout

```bash
npm run lint
npm test         # unit tests: date chunking, ledger classification, grouping, loader, CSV, URL params, currency
npm run build    # type-checks, then builds
```

- `src/auth/`: MSAL sign-in (`msal.ts`) and the backend session (`AuthProvider.tsx`)
- `src/api/`: fetch client, endpoint wrappers and backend types
- `src/admin/`: shared users/roles state for the admin pages
- `src/lib/sales.ts`: ledger entry classification (707/709), metrics, gestiune grouping, time series
- `src/lib/dates.ts`: presets, 30-day request chunking, previous period
- `src/lib/currency.ts`: lei/euro preference, rate parsing and conversion
- `src/lib/format.ts`: Romanian number, date and plural formatting
- `src/pages/`: Sales (`sales/` holds its panels and loader), Users, Roles, Grupe de venit and the sign-in/access screens
- `src/styles.css`: tokens (light and dark, Agritehnica greens) and layout
