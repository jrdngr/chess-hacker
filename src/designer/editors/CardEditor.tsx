import { useMemo, useState } from "react";

import type {
  Card,
  CardArchetype,
  CardCost,
  CardEffect,
  CardId,
  CardRarity,
} from "../../game/types";

import { EntryList, type ListItem } from "../components/EntryList";
import { EnumPicker } from "../components/EnumPicker";
import { FieldRenderer } from "../components/FieldRenderer";
import { Field, Row, Section, TwoPane } from "../components/Layout";
import {
  CARD_EFFECT_FIELDS,
  VALID_ARCHETYPES,
  VALID_COSTS,
  VALID_EFFECT_KINDS,
  VALID_RARITIES,
  VALID_TARGET_KINDS,
  VALID_ZONE_BUFF_EFFECT_KINDS,
  VALID_ZONE_BUFF_PATTERNS,
  defaultCardEffectPayload,
} from "../schemas";
import { useStore } from "../state/useStore";
import { downloadJson, exportCardEntry } from "../state/exporters";
import type { DesignerCardEntry, NewPropertyAnnotation } from "../state/types";

export function CardEditor() {
  const { state, update } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const ids = Object.keys(state.cards).sort();
    return ids[0] ?? null;
  });

  const items: ListItem[] = useMemo(() => {
    return Object.values(state.cards)
      .map((e) => ({
        id: e.data.id,
        label: e.data.name,
        sublabel: `${e.data.archetype} · ${e.data.rarity} · cost ${e.data.cost}`,
        modified: e.modified,
        source: e.source,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [state.cards]);

  const entry = selectedId ? state.cards[selectedId] : null;

  const onCreate = () => {
    const id = prompt("New card id (lowercase-with-dashes):")?.trim();
    if (!id) return;
    if (state.cards[id]) {
      alert("A card with that id already exists.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      alert("ids must be lowercase letters, digits, and dashes only.");
      return;
    }
    const newCard: Card = {
      id: id as CardId,
      name: id
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" "),
      cost: 1,
      rarity: "common",
      archetype: "resource",
      description: "",
      target: { kind: "none" },
      effect: { kind: "draw", count: 1 },
    };
    update((s) => ({
      ...s,
      cards: {
        ...s.cards,
        [id]: { data: newCard, source: "user", modified: true },
      },
    }));
    setSelectedId(id);
  };

  const onUpdate = (next: DesignerCardEntry) => {
    update((s) => ({
      ...s,
      cards: { ...s.cards, [next.data.id]: next },
    }));
  };

  const onDelete = (id: string) => {
    if (!confirm(`Delete card '${id}' from the designer state?`)) return;
    update((s) => {
      const { [id]: _drop, ...rest } = s.cards;
      void _drop;
      return { ...s, cards: rest };
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
          createLabel="+ New card"
          emptyMessage="No cards. Click + New card to create one."
        />
      }
      right={
        entry ? (
          <CardForm key={entry.data.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
        ) : (
          <div style={{ opacity: 0.6 }}>Select a card on the left to edit.</div>
        )
      }
    />
  );
}

function CardForm({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: DesignerCardEntry;
  onUpdate: (next: DesignerCardEntry) => void;
  onDelete: (id: string) => void;
}) {
  const card = entry.data;
  const newProps = entry.newProperties ?? [];

  // helpers ----------------------------------------------------------------

  const setCard = (patch: Partial<Card>) => {
    onUpdate({ ...entry, data: { ...card, ...patch } as Card, modified: true });
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

  const newArchetypes = newProps.filter((p) => p.path === "card.archetype").map((p) => p.value);
  const newTargetKinds = newProps.filter((p) => p.path === "card.target.kind").map((p) => p.value);
  const newEffectKinds = newProps.filter((p) => p.path === "card.effect.kind").map((p) => p.value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 720 }}>
      <Row>
        <h2 style={{ margin: 0 }}>{card.name || card.id}</h2>
        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>{card.id}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => downloadJson(`${card.id}.json`, exportCardEntry(entry))}>
          Export JSON
        </button>
        <button onClick={() => onDelete(card.id)} style={{ color: "#e57373" }}>
          Delete
        </button>
      </Row>

      <Section title="Identity">
        <Field label="id">
          <input
            type="text"
            value={card.id}
            onChange={(e) => setCard({ id: e.target.value as CardId })}
            style={{ width: 280 }}
          />
        </Field>
        <Field label="name">
          <input
            type="text"
            value={card.name}
            onChange={(e) => setCard({ name: e.target.value })}
            style={{ width: 320 }}
          />
        </Field>
        <Field label="description">
          <textarea
            value={card.description}
            onChange={(e) => setCard({ description: e.target.value })}
            rows={2}
            style={{ width: "100%" }}
          />
        </Field>
      </Section>

      <Section title="Categorisation">
        <Field label="cost">
          <select
            value={card.cost}
            onChange={(e) => setCard({ cost: Number(e.target.value) as CardCost })}
          >
            {VALID_COSTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="rarity">
          <select
            value={card.rarity}
            onChange={(e) => setCard({ rarity: e.target.value as CardRarity })}
          >
            {VALID_RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="archetype">
          <EnumPicker
            value={card.archetype}
            validValues={VALID_ARCHETYPES}
            newValues={newArchetypes}
            path="card.archetype"
            onChange={(v) => setCard({ archetype: v as CardArchetype })}
            onAddNew={addNewProperty}
          />
        </Field>

        <Row>
          <label>
            <input
              type="checkbox"
              checked={card.curse === true}
              onChange={(e) => setCard({ curse: e.target.checked || undefined })}
            />{" "}
            curse
          </label>
          <label>
            <input
              type="checkbox"
              checked={card.consume === true}
              onChange={(e) => setCard({ consume: e.target.checked || undefined })}
            />{" "}
            consume
          </label>
          <label>
            <input
              type="checkbox"
              checked={card.retain === true}
              onChange={(e) => setCard({ retain: e.target.checked || undefined })}
            />{" "}
            retain
          </label>
        </Row>
      </Section>

      <Section title="Target">
        <Row>
          <span style={{ fontSize: 11, opacity: 0.7, minWidth: 120 }}>target.kind</span>
          <EnumPicker
            value={card.target.kind}
            validValues={VALID_TARGET_KINDS}
            newValues={newTargetKinds}
            path="card.target.kind"
            onChange={(v) => setCard({ target: { kind: v } as Card["target"] })}
            onAddNew={addNewProperty}
          />
        </Row>
      </Section>

      <Section title="Effect">
        <Row>
          <span style={{ fontSize: 11, opacity: 0.7, minWidth: 120 }}>effect.kind</span>
          <EnumPicker
            value={card.effect.kind}
            validValues={VALID_EFFECT_KINDS}
            newValues={newEffectKinds}
            path="card.effect.kind"
            onChange={(v) => {
              const known = defaultCardEffectPayload(v);
              if (known) {
                setCard({ effect: { ...(known as object), kind: v } as CardEffect });
              } else {
                // Unknown kind: rely on the user's payloadFields (filled below).
                setCard({ effect: { kind: v } as CardEffect });
              }
            }}
            onAddNew={addNewProperty}
          />
        </Row>
        <div style={{ marginTop: 8 }}>
          <CardEffectFields
            effect={card.effect}
            onChange={(next) => setCard({ effect: next })}
            newProps={newProps}
          />
        </div>
      </Section>

      {newProps.length > 0 && (
        <Section title={`__designerNew (${newProps.length})`}>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
            {newProps.map((p, i) => (
              <li key={`${p.path}:${p.value}:${i}`} style={{ marginBottom: 4 }}>
                <code>{p.path}</code> = <code>{p.value}</code> — {p.description}
                {p.payloadFields && p.payloadFields.length > 0 && (
                  <span style={{ opacity: 0.7 }}>
                    {" "}
                    (fields: {p.payloadFields.map((f) => `${f.name}:${f.type}`).join(", ")})
                  </span>
                )}
                <button
                  onClick={() => {
                    onUpdate({
                      ...entry,
                      newProperties: newProps.filter((_, j) => j !== i),
                      modified: true,
                    });
                  }}
                  style={{ marginLeft: 6, padding: "0 6px" }}
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function CardEffectFields({
  effect,
  onChange,
  newProps,
}: {
  effect: CardEffect;
  onChange: (next: CardEffect) => void;
  newProps: NewPropertyAnnotation[];
}) {
  const kind = effect.kind;

  // Special-case: place-zone-buff (nested object).
  if (kind === "place-zone-buff") {
    const e = effect as Extract<CardEffect, { kind: "place-zone-buff" }>;
    return (
      <div>
        <Row>
          <span style={{ fontSize: 11, opacity: 0.7, minWidth: 120 }}>pattern</span>
          <select
            value={e.pattern}
            onChange={(ev) => onChange({ ...e, pattern: ev.target.value as typeof e.pattern })}
          >
            {VALID_ZONE_BUFF_PATTERNS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Row>
        <FieldRenderer
          field={{ name: "durationTurns", type: "number", min: 1 }}
          value={e as unknown as Record<string, unknown>}
          onChange={(next) => onChange({ ...e, durationTurns: next.durationTurns as number })}
        />
        <Row>
          <span style={{ fontSize: 11, opacity: 0.7, minWidth: 120 }}>buff.kind</span>
          <select
            value={e.buff.kind}
            onChange={(ev) =>
              onChange({
                ...e,
                buff: { ...e.buff, kind: ev.target.value as typeof e.buff.kind },
              })
            }
          >
            {VALID_ZONE_BUFF_EFFECT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </Row>
        <FieldRenderer
          field={{ name: "buff.amount", type: "number", min: 1 }}
          value={{ "buff.amount": e.buff.amount }}
          onChange={(next) =>
            onChange({
              ...e,
              buff: { ...e.buff, amount: next["buff.amount"] as number },
            })
          }
        />
        <FieldRenderer
          field={{ name: "sourceLabel", type: "string" }}
          value={e as unknown as Record<string, unknown>}
          onChange={(next) => onChange({ ...e, sourceLabel: next.sourceLabel as string })}
        />
      </div>
    );
  }

  // Special-case: compound (nested effect array).
  if (kind === "compound") {
    const e = effect as Extract<CardEffect, { kind: "compound" }>;
    const children = (e.effects ?? []) as CardEffect[];

    const addChild = () => {
      const next: CardEffect = { kind: "draw", count: 1 };
      onChange({ kind: "compound", effects: [...children, next] });
    };

    const updateChild = (i: number, next: CardEffect) => {
      const arr = children.slice();
      arr[i] = next;
      onChange({ kind: "compound", effects: arr });
    };

    const removeChild = (i: number) => {
      onChange({ kind: "compound", effects: children.filter((_, j) => j !== i) });
    };

    return (
      <div>
        {children.map((child, i) => (
          <fieldset
            key={i}
            style={{
              border: "1px solid #2a2d33",
              padding: 8,
              borderRadius: 4,
              marginBottom: 6,
            }}
          >
            <Row>
              <span style={{ fontSize: 11, opacity: 0.7 }}>child {i} kind</span>
              <select
                value={child.kind}
                onChange={(ev) => {
                  const k = ev.target.value;
                  const known = defaultCardEffectPayload(k);
                  if (k === "compound") {
                    alert("Compound effects cannot nest compounds.");
                    return;
                  }
                  if (known) updateChild(i, { ...(known as object), kind: k } as CardEffect);
                  else updateChild(i, { kind: k } as CardEffect);
                }}
              >
                {VALID_EFFECT_KINDS.filter((k) => k !== "compound").map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <button onClick={() => removeChild(i)}>remove</button>
            </Row>
            <div style={{ marginTop: 6 }}>
              <CardEffectFields
                effect={child}
                onChange={(c) => updateChild(i, c)}
                newProps={newProps}
              />
            </div>
          </fieldset>
        ))}
        <button onClick={addChild}>+ Add child effect</button>
      </div>
    );
  }

  // Known simple kinds — render via field schema.
  const fields = CARD_EFFECT_FIELDS[kind];
  if (fields) {
    if (fields.length === 0) {
      return <div style={{ fontSize: 11, opacity: 0.6 }}>(no payload)</div>;
    }
    return (
      <>
        {fields.map((f) => (
          <FieldRenderer
            key={f.name}
            field={f}
            value={effect as unknown as Record<string, unknown>}
            onChange={(next) => onChange({ ...next, kind } as unknown as CardEffect)}
          />
        ))}
      </>
    );
  }

  // Unknown kind (introduced via "+ Add new value…"). Find the matching
  // newProperty annotation and render its declared payload fields.
  const annotation = newProps.find((p) => p.path === "card.effect.kind" && p.value === kind);
  if (!annotation) {
    return (
      <div style={{ fontSize: 12, opacity: 0.6 }}>
        Unknown effect kind <code>{kind}</code> — payload editing not supported.
      </div>
    );
  }
  return (
    <>
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>{annotation.description}</div>
      {(annotation.payloadFields ?? []).map((f) => (
        <FieldRenderer
          key={f.name}
          field={
            f.type === "string[]"
              ? { name: f.name, type: "string" }
              : { name: f.name, type: f.type, optional: true }
          }
          value={effect as unknown as Record<string, unknown>}
          onChange={(next) => onChange({ ...next, kind } as unknown as CardEffect)}
        />
      ))}
    </>
  );
}
