import { useMemo, useState } from "react";

import type { CardEffect, StatusEffectDef, StatusTrigger } from "../../game/types";

import { EntryList, type ListItem } from "../components/EntryList";
import { EnumPicker } from "../components/EnumPicker";
import { FieldRenderer } from "../components/FieldRenderer";
import { Field, Row, Section, TwoPane } from "../components/Layout";
import {
  CARD_EFFECT_FIELDS,
  STATUS_EFFECT_TRIGGER_FIELDS,
  VALID_EFFECT_KINDS,
  VALID_STATUS_EFFECT_FLAVORS,
  VALID_STATUS_EFFECT_TRIGGER_KINDS,
  defaultCardEffectPayload,
  defaultStatusEffectTriggerPayload,
} from "../schemas";
import { useStore } from "../state/useStore";
import { downloadJson, exportStatusEffectEntry } from "../state/exporters";
import type { DesignerStatusEffectEntry, NewPropertyAnnotation } from "../state/types";

export function StatusEffectEditor() {
  const { state, update } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const ids = Object.keys(state.statusEffects).sort();
    return ids[0] ?? null;
  });

  const items: ListItem[] = useMemo(() => {
    return Object.values(state.statusEffects)
      .map((e) => ({
        id: e.data.id,
        label: e.data.name,
        sublabel: `${e.data.trigger.kind} · ${e.data.effect.kind}`,
        modified: e.modified,
        source: e.source,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [state.statusEffects]);

  const entry = selectedId ? state.statusEffects[selectedId] : null;

  const onCreate = () => {
    const id = prompt("New status effect id (lowercase-with-dashes):")?.trim();
    if (!id) return;
    if (state.statusEffects[id]) {
      alert("A status effect with that id already exists.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      alert("ids must be lowercase letters, digits, and dashes only.");
      return;
    }
    const newDef: StatusEffectDef = {
      id,
      name: id
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" "),
      description: "",
      trigger: { kind: "turn-start" },
      effect: { kind: "draw", count: 1 },
      flavor: "curse",
    };
    update((s) => ({
      ...s,
      statusEffects: {
        ...s.statusEffects,
        [id]: { data: newDef, source: "user", modified: true },
      },
    }));
    setSelectedId(id);
  };

  const onUpdate = (next: DesignerStatusEffectEntry) => {
    update((s) => ({ ...s, statusEffects: { ...s.statusEffects, [next.data.id]: next } }));
  };

  const onDelete = (id: string) => {
    if (!confirm(`Delete status effect '${id}' from the designer state?`)) return;
    update((s) => {
      const { [id]: _drop, ...rest } = s.statusEffects;
      void _drop;
      return { ...s, statusEffects: rest };
    });
    setSelectedId(null);
  };

  return (
    <TwoPane
      left={
        <EntryList
          items={items}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={onCreate}
          createLabel="+ New status effect"
          emptyMessage="No status effects. Click + New status effect to create one."
        />
      }
      right={
        entry ? (
          <StatusEffectForm
            key={entry.data.id}
            entry={entry}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ) : (
          <div style={{ opacity: 0.6 }}>Select a status effect on the left to edit.</div>
        )
      }
    />
  );
}

function StatusEffectForm({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: DesignerStatusEffectEntry;
  onUpdate: (next: DesignerStatusEffectEntry) => void;
  onDelete: (id: string) => void;
}) {
  const def = entry.data;
  const newProps = entry.newProperties ?? [];

  const setDef = (patch: Partial<StatusEffectDef>) => {
    onUpdate({ ...entry, data: { ...def, ...patch } as StatusEffectDef, modified: true });
  };

  const addNewProperty = (annotation: NewPropertyAnnotation) => {
    const cleaned = newProps.filter(
      (p) => !(p.path === annotation.path && p.value === annotation.value),
    );
    onUpdate({
      ...entry,
      newProperties: [...cleaned, annotation],
      modified: true,
    });
  };

  const newTriggerKinds = newProps
    .filter((p) => p.path === "statusEffect.trigger.kind")
    .map((p) => p.value);
  const newEffectKinds = newProps.filter((p) => p.path === "card.effect.kind").map((p) => p.value);

  const triggerFields = STATUS_EFFECT_TRIGGER_FIELDS[def.trigger.kind] ?? [];
  const effectFields = CARD_EFFECT_FIELDS[def.effect.kind];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 720 }}>
      <Row>
        <h2 style={{ margin: 0 }}>{def.name || def.id}</h2>
        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>{def.id}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => downloadJson(`${def.id}.json`, exportStatusEffectEntry(entry))}>
          Export JSON
        </button>
        <button onClick={() => onDelete(def.id)} style={{ color: "#e57373" }}>
          Delete
        </button>
      </Row>

      <Section title="Identity">
        <Field label="id">
          <input type="text" value={def.id} readOnly style={{ width: 280, opacity: 0.6 }} />
        </Field>
        <Field label="name">
          <input
            type="text"
            value={def.name}
            onChange={(e) => setDef({ name: e.target.value })}
            style={{ width: 320 }}
          />
        </Field>
        <Field label="description">
          <textarea
            value={def.description}
            onChange={(e) => setDef({ description: e.target.value })}
            rows={2}
            style={{ width: "100%" }}
          />
        </Field>
        <Field label="flavor">
          <select
            value={def.flavor ?? "curse"}
            onChange={(e) => setDef({ flavor: e.target.value as StatusEffectDef["flavor"] })}
          >
            {VALID_STATUS_EFFECT_FLAVORS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Trigger">
        <Row>
          <span style={{ fontSize: 11, opacity: 0.7, minWidth: 120 }}>trigger.kind</span>
          <EnumPicker
            value={def.trigger.kind}
            validValues={VALID_STATUS_EFFECT_TRIGGER_KINDS}
            newValues={newTriggerKinds}
            path="statusEffect.trigger.kind"
            onChange={(v) => {
              const known = defaultStatusEffectTriggerPayload(v);
              if (known) {
                setDef({ trigger: { ...(known as object), kind: v } as StatusTrigger });
              } else {
                setDef({ trigger: { kind: v } as StatusTrigger });
              }
            }}
            onAddNew={addNewProperty}
          />
        </Row>
        <div style={{ marginTop: 8 }}>
          {triggerFields.map((field) => (
            <FieldRenderer
              key={field.name}
              field={field}
              value={def.trigger as unknown as Record<string, unknown>}
              onChange={(next) =>
                setDef({ trigger: { ...next, kind: def.trigger.kind } as StatusTrigger })
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Effect">
        <Row>
          <span style={{ fontSize: 11, opacity: 0.7, minWidth: 120 }}>effect.kind</span>
          <EnumPicker
            value={def.effect.kind}
            validValues={VALID_EFFECT_KINDS}
            newValues={newEffectKinds}
            path="card.effect.kind"
            onChange={(v) => {
              const known = defaultCardEffectPayload(v);
              if (known) {
                setDef({ effect: { ...(known as object), kind: v } as CardEffect });
              } else {
                setDef({ effect: { kind: v } as CardEffect });
              }
            }}
            onAddNew={addNewProperty}
          />
        </Row>
        <div style={{ marginTop: 8 }}>
          {effectFields ? (
            effectFields.map((field) => (
              <FieldRenderer
                key={field.name}
                field={field}
                value={def.effect as unknown as Record<string, unknown>}
                onChange={(next) =>
                  setDef({ effect: { ...next, kind: def.effect.kind } as CardEffect })
                }
              />
            ))
          ) : (
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              {def.effect.kind === "compound" || def.effect.kind === "place-zone-buff"
                ? "Nested-payload effects (compound, place-zone-buff) are author-edit-only — edit the JSON directly."
                : "No payload fields for this effect kind."}
            </div>
          )}
        </div>
      </Section>

      {newProps.length > 0 && (
        <Section title="New properties (annotations)">
          <ul style={{ paddingLeft: 16, margin: 0 }}>
            {newProps.map((p, i) => (
              <li key={i} style={{ fontSize: 12 }}>
                <code>{p.path}</code> → <code>{p.value}</code>: {p.description}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
