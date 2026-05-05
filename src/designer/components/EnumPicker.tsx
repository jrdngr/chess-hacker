import { useState } from "react";

import type {
  NewPropertyAnnotation,
  NewPropertyPath,
  NewPropertyPayloadField,
} from "../state/types";

const ADD_NEW_TOKEN = "__add_new__";

/**
 * Dropdown that knows about both the canonical valid values and the
 * user's previously-added "new" values. Selecting "+ Add new value…"
 * opens an inline modal that asks the user for an identifier, a
 * description, and an optional payload schema. The new annotation is
 * passed back via `onAddNew`; the parent is responsible for storing it
 * on the entry's `newProperties` and using `value` as if it were valid.
 */
export function EnumPicker({
  label,
  value,
  validValues,
  newValues,
  path,
  onChange,
  onAddNew,
  /** Whether the picker is allowed to introduce new values (default: true). */
  allowAddNew = true,
}: {
  label?: string;
  value: string;
  validValues: readonly string[];
  /** Previously-added values for this picker; rendered in a separate group. */
  newValues?: string[];
  path: NewPropertyPath;
  onChange: (next: string) => void;
  onAddNew?: (annotation: NewPropertyAnnotation) => void;
  allowAddNew?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === ADD_NEW_TOKEN) {
      setModalOpen(true);
      return;
    }
    onChange(next);
  };

  const knownNew = (newValues ?? []).filter((v) => !validValues.includes(v));

  return (
    <>
      <select value={value} onChange={handleChange} style={{ minWidth: 200 }}>
        {!validValues.includes(value) && !knownNew.includes(value) && value !== "" && (
          <option value={value}>{value} (unknown)</option>
        )}
        <optgroup label="known">
          {validValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </optgroup>
        {knownNew.length > 0 && (
          <optgroup label="new (this designer state)">
            {knownNew.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </optgroup>
        )}
        {allowAddNew && onAddNew && <option value={ADD_NEW_TOKEN}>+ Add new value…</option>}
      </select>
      {label && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>{label}</span>}
      {modalOpen && onAddNew && (
        <NewValueModal
          path={path}
          onCancel={() => setModalOpen(false)}
          onSubmit={(annotation) => {
            onAddNew(annotation);
            onChange(annotation.value);
            setModalOpen(false);
          }}
        />
      )}
    </>
  );
}

function NewValueModal({
  path,
  onSubmit,
  onCancel,
}: {
  path: NewPropertyPath;
  onSubmit: (a: NewPropertyAnnotation) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<NewPropertyPayloadField[]>([]);

  const addField = () => setFields((p) => [...p, { name: "", type: "string" }]);
  const updateField = (i: number, patch: Partial<NewPropertyPayloadField>) => {
    setFields((p) => p.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const removeField = (i: number) => setFields((p) => p.filter((_, idx) => idx !== i));

  const submit = () => {
    const trimmedValue = value.trim();
    const trimmedDesc = description.trim();
    if (!trimmedValue) {
      alert("Identifier is required.");
      return;
    }
    if (!trimmedDesc) {
      alert("Description is required so the implementing agent has context.");
      return;
    }
    const cleaned = fields
      .filter((f) => f.name.trim().length > 0)
      .map((f) => ({ name: f.name.trim(), type: f.type, description: f.description?.trim() }));
    onSubmit({
      path,
      value: trimmedValue,
      description: trimmedDesc,
      payloadFields: cleaned.length > 0 ? cleaned : undefined,
    });
  };

  return (
    <div
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: 520,
          background: "#15171a",
          border: "1px solid #2a2d33",
          borderRadius: 6,
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Add new value to {path}</h3>
        <p style={{ marginTop: 0, fontSize: 12, opacity: 0.7 }}>
          The exported JSON will include a <code>__designerNew</code> annotation so a downstream
          agent can wire up the engine support.
        </p>
        <label style={{ display: "block", marginBottom: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>Identifier</div>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. freeze-and-burn"
            style={{ width: "100%" }}
            autoFocus
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>Description</div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Freezes target and applies burn damage for N turns"
            rows={3}
            style={{ width: "100%" }}
          />
        </label>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
            Payload fields (optional) — declare additional properties the new kind expects
          </div>
          {fields.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <input
                type="text"
                placeholder="field name"
                value={f.name}
                onChange={(e) => updateField(i, { name: e.target.value })}
                style={{ flex: 1 }}
              />
              <select
                value={f.type}
                onChange={(e) =>
                  updateField(i, { type: e.target.value as NewPropertyPayloadField["type"] })
                }
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="string[]">string[]</option>
              </select>
              <input
                type="text"
                placeholder="(optional) description"
                value={f.description ?? ""}
                onChange={(e) => updateField(i, { description: e.target.value })}
                style={{ flex: 1 }}
              />
              <button onClick={() => removeField(i)}>✕</button>
            </div>
          ))}
          <button onClick={addField}>+ Add payload field</button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 12 }}>
          <button onClick={onCancel}>Cancel</button>
          <button
            onClick={submit}
            style={{ background: "#4a90e2", borderColor: "#4a90e2", color: "#0e1013" }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
