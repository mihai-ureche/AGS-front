# Revenue groups

Implemented in AGS-backend and AGS-front. Deploy the backend before the frontend.
The backend initializes the schema at startup; this change has been tested against
an isolated PostgreSQL database, without applying it to the configured live database.

## Initial configuration

Grouping is enabled only for **Agritehnica**, using Borg's product category
(`grupa`). Green and BabyHub start with grouping disabled.

| Product category                               | Revenue group | Stable ID  |
| ---------------------------------------------- | ------------- | ---------- |
| Utilaje                                        | Utilaje       | `utilaje`  |
| Irigații                                       | Irigații      | `irigatii` |
| Alte materiale consumabile                     | Other         | `other`    |
| Cheltuieli Diverse                             | Other         | `other`    |
| Manipulare                                     | Manoperă      | `manopera` |
| Every other category, including missing values | Piese         | `piese`    |

Matching ignores case, accents, and surrounding/repeated whitespace. It matches
the entire category; for example, `Utilaje speciale` goes to Piese unless an
administrator adds a rule. Gestiune names do not determine the group.

Each line receives one group. Returns keep their signed amounts. A document can
contain lines in several groups, so distinct document counts across groups need
not add up to the overall distinct document count.

## Administration

Open **Administrare → Grupe de venit** to edit category rules, choose the group
for remaining categories, or enable/disable grouping for an entity. The five
stable group IDs are shared across entities; the current UI edits mappings, not
the group catalog. Configuration writes require an active administrator.

PostgreSQL stores:

- `revenue_groups`: stable IDs, labels, and display order.
- `revenue_configurations`: enabled state, category rules, fallback group, and
  revision for each entity.
- `revenue_configuration_changes`: before/after configuration, actor, tenant,
  and timestamp, committed in the same transaction as the change.
- `roles.sales_groups`: allowed revenue group IDs, or `NULL` for unrestricted
  group access.

Saving uses the revision last read. A stale editor receives `409` and must
reload before saving. Duplicate normalized category names are rejected.
Configuration edits survive backend restarts. Current mappings also apply to
historical sales when data is reloaded; classifications are not frozen by date.

## Role access

In **Administrare → Roluri**, create a role with sales permission and select its
allowed groups, or use **Acces la grupe** on an existing custom sales role. Assign
the role and entity access through **Utilizatori**.

Examples:

- Utilaje only: `salesGroups: ["utilaje"]`.
- Service: `salesGroups: ["piese", "manopera"]`.
- All sales groups: `salesGroups: null`.
- No sales access: `salesGroups: []`, even with `sales:read`.

A user must have `sales:read`, a grant for the requested entity, and access to the
line's group. Selected group IDs apply to every granted entity where grouping is
enabled. Entities without grouping require unrestricted group access (`null`).
A role's group scope does not itself grant any entities. Stock and support
permissions retain their existing behavior.

The upgrade preserves existing roles' access with `NULL`. Newly created roles
with omitted scopes default to `[]`. Re-running schema initialization preserves
later restrictions. Built-in role scopes cannot be edited through the API.

The backend enforces these checks for both legacy and grouped sales responses,
including when the caller omits a filter or supplies a gestiune filter. The
catalog endpoint exposes only allowed groups. Forbidden group requests return
`403`; configuration failures return an error rather than unrestricted data.

## API contract

- `GET /api/revenue-groups?targetEntity=agritehnica` returns `{ groups,
accessVersion }` for the authenticated caller.
- `GET /api/admin/revenue-groups/:entity` returns the full configuration.
- `PATCH /api/admin/revenue-groups/:entity` accepts `{ enabled, revision,
defaultGroupId, rules: [{ category, groupId }] }`.
- `POST /api/roles` accepts `salesGroups` alongside name, description, and
  permissions. `GET /api/roles` and `GET /api/me` include `salesGroups`.
- `PATCH /api/roles/:name/sales-groups` accepts `{ salesGroups }`.
- `GET /api/borg/sales` accepts optional `revenueGroupId` to narrow the authorized
  results, and `responseFormat=grouped` for the response below.

```ts
{
  lines: Array<
    BorgLine & {
      revenueGroupId: string | null;
      revenueGroupName: string | null;
      businessValueKind: "sale" | "discount" | "special" | "unclassified";
      discountInclusInLinii: boolean | null;
      // Allocated discount shares only:
      discountAllocation?: unknown;
      sourceMiscareId?: string;
    }
  >;
  possiblyTruncated: boolean;
  accessVersion: string;
}
```

Without `responseFormat`, the response remains an array of authorized lines,
with the two additional group fields. They are null when grouping is disabled.
The frontend uses the grouped response. External consumers should use that
format too: after authorization filters rows, array length alone cannot detect
upstream truncation.

`possiblyTruncated` is computed before filtering Borg's response. A request that
hits the upstream limit still shows an incomplete-data warning even if very few
authorized rows remain. Hidden group totals and counts are never returned.
The existing Borg range and line limits still apply.

## Frontend behavior

AGS assigns allocated discount shares to revenue groups; the dashboard uses
`revenueGroupId` as-is and never regroups discounts by their raw `grupa`.
The dashboard provides a **Tip venit** filter, a default breakdown by revenue
group where enabled, an optional chart split showing all revenue groups, and
revenue group fields in line CSV exports. Existing categories and gestiuni remain
available for further breakdowns.

Sales caches are bounded and keyed by the query and a backend access version.
That version includes identity, permissions, entity grants, role group grants,
entity, and configuration revision. Access is revalidated before cached reads
and again before a complete dataset is displayed. A version change during a
multi-request load fails the load instead of combining different scopes.

Logout and session refresh clear caches and cancel pending requests. A tab focus
revalidates sales access; query changes and failures hide older results. Changes
are enforced by the backend on the next API request. Data already received by a
user cannot be recalled, and an idle tab is not a real-time revocation channel.

## Validation

Backend tests cover category normalization, defaults, returns, tampered fields,
restricted responses, filtered metadata, revocation, schema upgrades, persisted
configuration, audit history, stale saves, and administrator checks. Frontend
tests cover aggregation, group filtering, cache separation, revocation,
truncation, comparison revisions, and late responses after logout.
