import type { FieldSpec } from "../schemas";

/**
 * Render a primitive field (string / number / boolean / enum) bound to
 * `value[name]`. Used for known and ad-hoc payload fields. Fully
 * uncontrolled-style — calls `onChange` with a new container object.
 */
export function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const v = value[field.name];

  const set = (next: unknown) => {
    if (next === undefined) {
      const { [field.name]: _drop, ...rest } = value;
      void _drop;
      onChange(rest);
      return;
    }
    onChange({ ...value, [field.name]: next });
  };

  if (field.type === "number") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ minWidth: 120, fontSize: 11, opacity: 0.7 }}>
          {field.name}
          {field.optional && " (opt)"}
        </span>
        <input
          type="number"
          value={typeof v === "number" ? v : ""}
          onChange={(e) => {
            const text = e.target.value;
            if (text === "") {
              if (field.optional) set(undefined);
              return;
            }
            const n = Number(text);
            if (Number.isFinite(n)) set(n);
          }}
          style={{ width: 100 }}
        />
      </label>
    );
  }

  if (field.type === "string") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ minWidth: 120, fontSize: 11, opacity: 0.7 }}>
          {field.name}
          {field.optional && " (opt)"}
        </span>
        <input
          type="text"
          value={typeof v === "string" ? v : ""}
          onChange={(e) => {
            const text = e.target.value;
            if (text === "" && field.optional) set(undefined);
            else set(text);
          }}
          style={{ flex: 1 }}
        />
      </label>
    );
  }

  if (field.type === "boolean") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <input
          type="checkbox"
          checked={v === true}
          onChange={(e) => set(e.target.checked ? true : field.optional ? undefined : false)}
        />
        <span style={{ fontSize: 11, opacity: 0.8 }}>{field.name}</span>
      </label>
    );
  }

  if (field.type === "enum") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ minWidth: 120, fontSize: 11, opacity: 0.7 }}>
          {field.name}
          {field.optional && " (opt)"}
        </span>
        <select
          value={typeof v === "string" ? v : ""}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "" && field.optional) set(undefined);
            else set(next);
          }}
        >
          {field.optional && <option value="">(none)</option>}
          {field.enumValues.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return null;
}
