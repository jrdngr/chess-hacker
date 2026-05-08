import { useMemo, useState } from "react";

import type {
  AlgebraicSquare,
  BossDef,
  BossId,
  BossModifier,
  StatusEffectId,
  ZoneRegion,
} from "../../game/types";

import { EntryList, type ListItem } from "../components/EntryList";
import { EnumPicker } from "../components/EnumPicker";
import { FieldRenderer } from "../components/FieldRenderer";
import { Field, Row, Section, TwoPane } from "../components/Layout";
import { SquarePicker } from "../components/SquarePicker";
import { VALID_BOSS_MODIFIER_KINDS, VALID_ZONE_BUFF_EFFECT_KINDS } from "../schemas";
import { useStore } from "../state/useStore";
import { downloadJson, exportBossEntry } from "../state/exporters";
import type { DesignerBossEntry, NewPropertyAnnotation } from "../state/types";

export function BossEditor() {
  const { state, update } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const ids = Object.keys(state.bosses).sort();
    return ids[0] ?? null;
  });

  const items: ListItem[] = useMemo(
    () =>
      Object.values(state.bosses)
        .map((e) => ({
          id: e.data.id,
          label: e.data.name,
          sublabel: `match ${e.data.matchNumber} · ${e.data.modifier.kind}`,
          modified: e.modified,
          source: e.source,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [state.bosses],
  );

  const entry = selectedId ? state.bosses[selectedId] : null;

  const onCreate = () => {
    const id = prompt("New boss id (lowercase-with-dashes):")?.trim();
    if (!id) return;
    if (state.bosses[id]) {
      alert("A boss with that id already exists.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      alert("ids must be lowercase letters, digits, and dashes only.");
      return;
    }
    const newBoss: BossDef = {
      id: id as BossId,
      name: id
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" "),
      matchNumber: 3,
      modifier: { kind: "no-player-walls" },
      modifierDescription: "",
      hazardWalls: [],
      statusEffects: [],
      description: "",
    };
    update((s) => ({
      ...s,
      bosses: { ...s.bosses, [id]: { data: newBoss, source: "user", modified: true } },
    }));
    setSelectedId(id);
  };

  const onUpdate = (next: DesignerBossEntry) => {
    update((s) => ({ ...s, bosses: { ...s.bosses, [next.data.id]: next } }));
  };

  const onDelete = (id: string) => {
    if (!confirm(`Delete boss '${id}' from the designer state?`)) return;
    update((s) => {
      const { [id]: _drop, ...rest } = s.bosses;
      void _drop;
      return { ...s, bosses: rest };
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
          createLabel="+ New boss"
          emptyMessage="No bosses."
        />
      }
      right={
        entry ? (
          <BossForm key={entry.data.id} entry={entry} onUpdate={onUpdate} onDelete={onDelete} />
        ) : (
          <div style={{ opacity: 0.6 }}>Select a boss on the left to edit.</div>
        )
      }
    />
  );
}

function BossForm({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: DesignerBossEntry;
  onUpdate: (next: DesignerBossEntry) => void;
  onDelete: (id: string) => void;
}) {
  const { state } = useStore();
  const b = entry.data;
  const newProps = entry.newProperties ?? [];

  const setData = (patch: Partial<BossDef>) => {
    onUpdate({ ...entry, data: { ...b, ...patch } as BossDef, modified: true });
  };

  const addNewProperty = (annotation: NewPropertyAnnotation) => {
    const cleaned = newProps.filter(
      (p) => !(p.path === annotation.path && p.value === annotation.value),
    );
    onUpdate({ ...entry, newProperties: [...cleaned, annotation], modified: true });
  };

  const newModifierKinds = newProps
    .filter((p) => p.path === "boss.modifier.kind")
    .map((p) => p.value);

  const toggleSquare = (
    list: AlgebraicSquare[],
    sq: AlgebraicSquare,
    write: (next: AlgebraicSquare[]) => void,
  ) => {
    if (list.includes(sq)) write(list.filter((s) => s !== sq));
    else write([...list, sq]);
  };

  const statusEffectIds = Object.values(state.statusEffects).map((e) => e.data.id);

  const setStatusEffect = (i: number, next: StatusEffectId) => {
    const arr = [...b.statusEffects];
    arr[i] = next;
    setData({ statusEffects: arr });
  };
  const addStatusEffect = () => {
    setData({
      statusEffects: [...b.statusEffects, (statusEffectIds[0] ?? "") as StatusEffectId],
    });
  };
  const removeStatusEffect = (i: number) => {
    setData({ statusEffects: b.statusEffects.filter((_, j) => j !== i) });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 820 }}>
      <Row>
        <h2 style={{ margin: 0 }}>{b.name || b.id}</h2>
        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>{b.id}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => downloadJson(`${b.id}.json`, exportBossEntry(entry))}>
          Export JSON
        </button>
        <button onClick={() => onDelete(b.id)} style={{ color: "#e57373" }}>
          Delete
        </button>
      </Row>

      <Section title="Identity">
        <Field label="id">
          <input
            type="text"
            value={b.id}
            onChange={(e) => setData({ id: e.target.value as BossId })}
            style={{ width: 280 }}
          />
        </Field>
        <Field label="name">
          <input
            type="text"
            value={b.name}
            onChange={(e) => setData({ name: e.target.value })}
            style={{ width: 320 }}
          />
        </Field>
        <Field label="matchNumber" hint="3, 6, or 9 (act endings)">
          <select
            value={b.matchNumber}
            onChange={(e) => setData({ matchNumber: Number(e.target.value) as 3 | 6 | 9 })}
          >
            <option value={3}>3</option>
            <option value={6}>6</option>
            <option value={9}>9</option>
          </select>
        </Field>
        <Field label="description (preview tag-line)">
          <textarea
            value={b.description}
            onChange={(e) => setData({ description: e.target.value })}
            rows={2}
            style={{ width: "100%" }}
          />
        </Field>
      </Section>

      <Section title="Modifier">
        <Row>
          <span style={{ fontSize: 11, opacity: 0.7, minWidth: 120 }}>modifier.kind</span>
          <EnumPicker
            value={b.modifier.kind}
            validValues={VALID_BOSS_MODIFIER_KINDS}
            newValues={newModifierKinds}
            path="boss.modifier.kind"
            onChange={(k) => setData({ modifier: { kind: k } as BossModifier })}
            onAddNew={addNewProperty}
          />
        </Row>
        <Field label="modifierDescription">
          <textarea
            value={b.modifierDescription}
            onChange={(e) => setData({ modifierDescription: e.target.value })}
            rows={2}
            style={{ width: "100%" }}
          />
        </Field>
      </Section>

      <Section title={`Hazard walls (${b.hazardWalls.length})`}>
        <SquarePicker
          selected={b.hazardWalls}
          onToggle={(sq) =>
            toggleSquare(b.hazardWalls.slice(), sq, (next) => setData({ hazardWalls: next }))
          }
          accent="#a08054"
        />
      </Section>

      <Section title={`Void squares (${b.voidSquares?.length ?? 0})`}>
        <SquarePicker
          selected={b.voidSquares ?? []}
          onToggle={(sq) => {
            const cur = b.voidSquares ?? [];
            const next = cur.includes(sq) ? cur.filter((s) => s !== sq) : [...cur, sq];
            setData({ voidSquares: next.length === 0 ? undefined : next });
          }}
          accent="#9b59b6"
        />
      </Section>

      <Section title={`Zone buffs (${b.zoneBuffs?.length ?? 0})`}>
        {(b.zoneBuffs ?? []).map((zb, i) => (
          <fieldset
            key={i}
            style={{
              border: "1px solid #2a2d33",
              padding: 8,
              borderRadius: 4,
              marginBottom: 6,
            }}
          >
            <BossZoneBuffFields
              entry={zb}
              onChange={(next) => {
                const arr = (b.zoneBuffs ?? []).slice();
                arr[i] = next;
                setData({ zoneBuffs: arr });
              }}
              onRemove={() => {
                const arr = (b.zoneBuffs ?? []).filter((_, j) => j !== i);
                setData({ zoneBuffs: arr.length === 0 ? undefined : arr });
              }}
            />
          </fieldset>
        ))}
        <button
          onClick={() =>
            setData({
              zoneBuffs: [
                ...(b.zoneBuffs ?? []),
                {
                  region: { kind: "square", anchor: "d1" },
                  buff: { kind: "energy-per-turn", amount: 1 },
                  sourceLabel: "",
                },
              ],
            })
          }
        >
          + Add zone buff
        </button>
      </Section>

      <Section title={`Status effects (${b.statusEffects.length})`}>
        {b.statusEffects.map((id, i) => {
          const def = state.statusEffects[id]?.data;
          return (
            <Row key={i}>
              <span style={{ fontSize: 11, opacity: 0.7, minWidth: 80 }}>statusEffectId</span>
              <select
                value={id}
                onChange={(e) => setStatusEffect(i, e.target.value as StatusEffectId)}
              >
                {!statusEffectIds.includes(id) && id && <option value={id}>{id} (unknown)</option>}
                {statusEffectIds.map((sid) => (
                  <option key={sid} value={sid}>
                    {sid}
                  </option>
                ))}
              </select>
              {def && (
                <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 8 }}>
                  {def.trigger.kind} → {def.effect.kind}
                </span>
              )}
              <button onClick={() => removeStatusEffect(i)}>remove</button>
            </Row>
          );
        })}
        <button onClick={addStatusEffect} disabled={statusEffectIds.length === 0}>
          + Add status effect
        </button>
        {statusEffectIds.length === 0 && (
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            No status effects exist in the designer state — create one in the Status Effects tab to
            populate this list.
          </div>
        )}
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

function BossZoneBuffFields({
  entry,
  onChange,
  onRemove,
}: {
  entry: { region: ZoneRegion; buff: { kind: string; amount: number }; sourceLabel: string };
  onChange: (next: {
    region: ZoneRegion;
    buff: { kind: "energy-per-turn" | "hand-size"; amount: number };
    sourceLabel: string;
  }) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <Row>
        <span style={{ fontSize: 11, opacity: 0.7, minWidth: 100 }}>region.kind</span>
        <select
          value={entry.region.kind}
          onChange={(e) => {
            const k = e.target.value as ZoneRegion["kind"];
            const next: ZoneRegion =
              k === "rank"
                ? { kind: "rank", rank: 4 }
                : k === "center"
                  ? { kind: "center" }
                  : ({ kind: k, anchor: "d4" } as ZoneRegion);
            onChange({
              ...entry,
              region: next,
              buff: entry.buff as { kind: "energy-per-turn" | "hand-size"; amount: number },
            });
          }}
        >
          <option value="square">square</option>
          <option value="square-orthogonal-1">square-orthogonal-1</option>
          <option value="square-radius-1">square-radius-1</option>
          <option value="rank">rank</option>
          <option value="center">center</option>
        </select>
      </Row>
      {entry.region.kind === "rank" ? (
        <FieldRenderer
          field={{ name: "rank", type: "number", min: 1 }}
          value={{ rank: entry.region.rank }}
          onChange={(next) =>
            onChange({
              ...entry,
              region: { kind: "rank", rank: next.rank as number },
              buff: entry.buff as { kind: "energy-per-turn" | "hand-size"; amount: number },
            })
          }
        />
      ) : entry.region.kind === "center" ? null : (
        <FieldRenderer
          field={{ name: "anchor", type: "string" }}
          value={{ anchor: entry.region.anchor }}
          onChange={(next) =>
            onChange({
              ...entry,
              region: {
                kind: entry.region.kind,
                anchor: next.anchor as string,
              } as ZoneRegion,
              buff: entry.buff as { kind: "energy-per-turn" | "hand-size"; amount: number },
            })
          }
        />
      )}
      <Row>
        <span style={{ fontSize: 11, opacity: 0.7, minWidth: 100 }}>buff.kind</span>
        <select
          value={entry.buff.kind}
          onChange={(e) =>
            onChange({
              ...entry,
              buff: {
                kind: e.target.value as "energy-per-turn" | "hand-size",
                amount: entry.buff.amount,
              },
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
        field={{ name: "amount", type: "number", min: 1 }}
        value={{ amount: entry.buff.amount }}
        onChange={(next) =>
          onChange({
            ...entry,
            buff: {
              kind: entry.buff.kind as "energy-per-turn" | "hand-size",
              amount: next.amount as number,
            },
          })
        }
      />
      <FieldRenderer
        field={{ name: "sourceLabel", type: "string" }}
        value={{ sourceLabel: entry.sourceLabel }}
        onChange={(next) =>
          onChange({
            ...entry,
            sourceLabel: next.sourceLabel as string,
            buff: entry.buff as { kind: "energy-per-turn" | "hand-size"; amount: number },
          })
        }
      />
      <button onClick={onRemove}>remove</button>
    </div>
  );
}
