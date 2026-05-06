import { useMemo, useState } from "react";

import type { Artifact, ArtifactEffect, ArtifactRarity, ZoneRegion } from "../../game/types";

import { EntryList, type ListItem } from "../components/EntryList";
import { EnumPicker } from "../components/EnumPicker";
import { FieldRenderer } from "../components/FieldRenderer";
import { Field, Row, Section, TwoPane } from "../components/Layout";
import {
  ARTIFACT_EFFECT_FIELDS,
  VALID_ARTIFACT_EFFECT_KINDS,
  VALID_ARTIFACT_RARITIES,
  VALID_ZONE_BUFF_EFFECT_KINDS,
  defaultArtifactEffectPayload,
} from "../schemas";
import { useStore } from "../state/useStore";
import { downloadJson, exportArtifactEntry } from "../state/exporters";
import type { DesignerArtifactEntry, NewPropertyAnnotation } from "../state/types";

export function ArtifactEditor() {
  const { state, update } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const ids = Object.keys(state.artifacts).sort();
    return ids[0] ?? null;
  });

  const items: ListItem[] = useMemo(
    () =>
      Object.values(state.artifacts)
        .map((e) => ({
          id: e.data.id,
          label: e.data.name,
          sublabel: `${e.data.rarity} · ${e.data.effects.length} effect${e.data.effects.length === 1 ? "" : "s"}`,
          modified: e.modified,
          source: e.source,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [state.artifacts],
  );

  const entry = selectedId ? state.artifacts[selectedId] : null;

  const onCreate = () => {
    const id = prompt("New artifact id (lowercase-with-dashes):")?.trim();
    if (!id) return;
    if (state.artifacts[id]) {
      alert("An artifact with that id already exists.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      alert("ids must be lowercase letters, digits, and dashes only.");
      return;
    }
    const newArtifact: Artifact = {
      id,
      name: id
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" "),
      rarity: "common",
      description: "",
      effects: [{ kind: "hand-size-bonus", amount: 1 }],
    };
    update((s) => ({
      ...s,
      artifacts: {
        ...s.artifacts,
        [id]: { data: newArtifact, source: "user", modified: true },
      },
    }));
    setSelectedId(id);
  };

  const onUpdate = (next: DesignerArtifactEntry) => {
    update((s) => ({ ...s, artifacts: { ...s.artifacts, [next.data.id]: next } }));
  };

  const onDelete = (id: string) => {
    if (!confirm(`Delete artifact '${id}' from the designer state?`)) return;
    update((s) => {
      const { [id]: _drop, ...rest } = s.artifacts;
      void _drop;
      return { ...s, artifacts: rest };
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
          createLabel="+ New artifact"
          emptyMessage="No artifacts."
        />
      }
      right={
        entry ? (
          <ArtifactForm key={entry.data.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
        ) : (
          <div style={{ opacity: 0.6 }}>Select an artifact on the left to edit.</div>
        )
      }
    />
  );
}

function ArtifactForm({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: DesignerArtifactEntry;
  onUpdate: (next: DesignerArtifactEntry) => void;
  onDelete: (id: string) => void;
}) {
  const a = entry.data;
  const newProps = entry.newProperties ?? [];

  const setData = (patch: Partial<Artifact>) => {
    onUpdate({ ...entry, data: { ...a, ...patch }, modified: true });
  };

  const addNewProperty = (annotation: NewPropertyAnnotation) => {
    const cleaned = newProps.filter(
      (p) => !(p.path === annotation.path && p.value === annotation.value),
    );
    onUpdate({ ...entry, newProperties: [...cleaned, annotation], modified: true });
  };

  const newEffectKinds = newProps
    .filter((p) => p.path === "artifact.effect.kind")
    .map((p) => p.value);

  const setEffect = (i: number, next: ArtifactEffect) => {
    const arr = a.effects.slice();
    arr[i] = next;
    setData({ effects: arr });
  };

  const addEffect = () => {
    const next: ArtifactEffect = { kind: "hand-size-bonus", amount: 1 };
    setData({ effects: [...a.effects, next] });
  };

  const removeEffect = (i: number) => {
    setData({ effects: a.effects.filter((_, j) => j !== i) });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 720 }}>
      <Row>
        <h2 style={{ margin: 0 }}>{a.name || a.id}</h2>
        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>{a.id}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => downloadJson(`${a.id}.json`, exportArtifactEntry(entry))}>
          Export JSON
        </button>
        <button onClick={() => onDelete(a.id)} style={{ color: "#e57373" }}>
          Delete
        </button>
      </Row>

      <Section title="Identity">
        <Field label="id">
          <input
            type="text"
            value={a.id}
            onChange={(e) => setData({ id: e.target.value })}
            style={{ width: 280 }}
          />
        </Field>
        <Field label="name">
          <input
            type="text"
            value={a.name}
            onChange={(e) => setData({ name: e.target.value })}
            style={{ width: 320 }}
          />
        </Field>
        <Field label="rarity">
          <select
            value={a.rarity}
            onChange={(e) => setData({ rarity: e.target.value as ArtifactRarity })}
          >
            {VALID_ARTIFACT_RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="emoji" hint="display glyph (single character/emoji)">
          <input
            type="text"
            value={a.emoji ?? ""}
            onChange={(e) => setData({ emoji: e.target.value || undefined })}
            style={{ width: 80 }}
          />
        </Field>
        <Field label="description">
          <textarea
            value={a.description}
            onChange={(e) => setData({ description: e.target.value })}
            rows={2}
            style={{ width: "100%" }}
          />
        </Field>
      </Section>

      <Section title={`Effects (${a.effects.length})`}>
        {a.effects.map((effect, i) => (
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
              <span style={{ fontSize: 11, opacity: 0.7 }}>effect[{i}].kind</span>
              <EnumPicker
                value={effect.kind}
                validValues={VALID_ARTIFACT_EFFECT_KINDS}
                newValues={newEffectKinds}
                path="artifact.effect.kind"
                onChange={(k) => {
                  const known = defaultArtifactEffectPayload(k);
                  if (known) {
                    setEffect(i, { ...(known as object), kind: k } as ArtifactEffect);
                  } else {
                    setEffect(i, { kind: k } as ArtifactEffect);
                  }
                }}
                onAddNew={addNewProperty}
              />
              <button onClick={() => removeEffect(i)}>remove</button>
            </Row>
            <div style={{ marginTop: 6 }}>
              <ArtifactEffectFields
                effect={effect}
                onChange={(next) => setEffect(i, next)}
                newProps={newProps}
              />
            </div>
          </fieldset>
        ))}
        <button onClick={addEffect}>+ Add effect</button>
      </Section>

      {newProps.length > 0 && (
        <Section title={`__designerNew (${newProps.length})`}>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
            {newProps.map((p, i) => (
              <li key={`${p.path}:${p.value}:${i}`} style={{ marginBottom: 4 }}>
                <code>{p.path}</code> = <code>{p.value}</code> — {p.description}
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

function ArtifactEffectFields({
  effect,
  onChange,
  newProps,
}: {
  effect: ArtifactEffect;
  onChange: (next: ArtifactEffect) => void;
  newProps: NewPropertyAnnotation[];
}) {
  const kind = effect.kind;

  if (kind === "zone-buff") {
    const e = effect as Extract<ArtifactEffect, { kind: "zone-buff" }>;
    return (
      <div>
        <ZoneRegionFields region={e.region} onChange={(r) => onChange({ ...e, region: r })} />
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
            onChange({ ...e, buff: { ...e.buff, amount: next["buff.amount"] as number } })
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

  const fields = ARTIFACT_EFFECT_FIELDS[kind];
  if (fields) {
    if (fields.length === 0) return <div style={{ fontSize: 11, opacity: 0.6 }}>(no payload)</div>;
    return (
      <>
        {fields.map((f) => (
          <FieldRenderer
            key={f.name}
            field={f}
            value={effect as unknown as Record<string, unknown>}
            onChange={(next) => onChange({ ...next, kind } as unknown as ArtifactEffect)}
          />
        ))}
      </>
    );
  }

  // Unknown kind — defer to the user-declared payload schema in newProps.
  const annotation = newProps.find((p) => p.path === "artifact.effect.kind" && p.value === kind);
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
          onChange={(next) => onChange({ ...next, kind } as unknown as ArtifactEffect)}
        />
      ))}
    </>
  );
}

function ZoneRegionFields({
  region,
  onChange,
}: {
  region: ZoneRegion;
  onChange: (next: ZoneRegion) => void;
}) {
  return (
    <div>
      <Row>
        <span style={{ fontSize: 11, opacity: 0.7, minWidth: 120 }}>region.kind</span>
        <select
          value={region.kind}
          onChange={(e) => {
            const k = e.target.value as ZoneRegion["kind"];
            if (k === "rank") onChange({ kind: "rank", rank: 4 });
            else if (k === "center") onChange({ kind: "center" });
            else onChange({ kind: k, anchor: "d4" } as ZoneRegion);
          }}
        >
          <option value="square">square</option>
          <option value="square-orthogonal-1">square-orthogonal-1</option>
          <option value="square-radius-1">square-radius-1</option>
          <option value="rank">rank</option>
          <option value="center">center</option>
        </select>
      </Row>
      {region.kind === "rank" ? (
        <FieldRenderer
          field={{ name: "rank", type: "number", min: 1 }}
          value={{ rank: region.rank }}
          onChange={(next) => onChange({ kind: "rank", rank: next.rank as number })}
        />
      ) : region.kind === "center" ? null : (
        <FieldRenderer
          field={{ name: "anchor", type: "string" }}
          value={{ anchor: region.anchor }}
          onChange={(next) =>
            onChange({ kind: region.kind, anchor: next.anchor as string } as ZoneRegion)
          }
        />
      )}
    </div>
  );
}
