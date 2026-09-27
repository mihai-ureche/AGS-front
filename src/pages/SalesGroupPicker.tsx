import type { RevenueGroup } from "../api/types";

export function SalesGroupPicker({
  groups,
  value,
  onChange,
}: {
  groups: RevenueGroup[];
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}) {
  return (
    <fieldset className="permission-picker">
      <legend>Acces la grupele de venit</legend>
      <label className="check-row">
        <input
          type="checkbox"
          checked={value === null}
          onChange={(event) => onChange(event.target.checked ? null : [])}
        />
        <span>Toate grupele și entitățile fără grupare</span>
      </label>
      {value !== null &&
        groups.map((group) => (
          <label className="check-row" key={group.id}>
            <input
              type="checkbox"
              checked={value.includes(group.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, group.id]
                    : value.filter((id) => id !== group.id),
                )
              }
            />
            <span>{group.name}</span>
          </label>
        ))}
      <p className="muted">
        Utilizatorii au nevoie și de acces la entitate. Fără nicio grupă
        selectată, rolul nu poate citi vânzările.
      </p>
    </fieldset>
  );
}
