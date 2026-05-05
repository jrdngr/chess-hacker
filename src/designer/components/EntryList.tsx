import { useState, type ReactNode } from "react";

export type ListItem = {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  modified?: boolean;
  source?: "library" | "user";
};

/**
 * Generic searchable list (left pane). Filters by label/id substring.
 */
export function EntryList({
  items,
  selectedId,
  onSelect,
  onCreate,
  createLabel = "+ New",
  emptyMessage,
  filters,
}: {
  items: ListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate?: () => void;
  createLabel?: string;
  emptyMessage?: string;
  filters?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
    : items;

  return (
    <>
      <div style={{ padding: 8, borderBottom: "1px solid #2a2d33" }}>
        <input
          type="text"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: "100%" }}
        />
        {filters && <div style={{ marginTop: 6 }}>{filters}</div>}
        {onCreate && (
          <button onClick={onCreate} style={{ marginTop: 6, width: "100%" }}>
            {createLabel}
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {filtered.length === 0 && (
          <div style={{ padding: 12, opacity: 0.6, fontSize: 12 }}>
            {emptyMessage ?? "No items."}
          </div>
        )}
        {filtered.map((item) => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 10px",
                background: active ? "#1f2329" : "transparent",
                border: "none",
                borderBottom: "1px solid #1a1d22",
                borderRadius: 0,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.label}
                </span>
                {item.modified && (
                  <span title="modified" style={{ color: "#e2b34a", fontSize: 11 }}>
                    ●
                  </span>
                )}
                {item.source === "user" && <span style={{ fontSize: 10, opacity: 0.6 }}>USER</span>}
                {item.badge && <span style={{ fontSize: 10, opacity: 0.6 }}>{item.badge}</span>}
              </div>
              {item.sublabel && (
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{item.sublabel}</div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
