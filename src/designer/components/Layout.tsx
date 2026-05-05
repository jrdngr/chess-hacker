import type { ReactNode } from "react";

/**
 * Standard left-list / right-detail layout used by every editor.
 */
export function TwoPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
      <aside
        style={{
          width: 280,
          borderRight: "1px solid #2a2d33",
          background: "#0e1013",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {left}
      </aside>
      <section
        style={{
          flex: 1,
          padding: 16,
          overflow: "auto",
          minHeight: 0,
        }}
      >
        {right}
      </section>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 3 }}>
        {label}
        {hint && <span style={{ marginLeft: 8, opacity: 0.6 }}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}

export function Row({ children, gap = 6 }: { children: ReactNode; gap?: number }) {
  return <div style={{ display: "flex", gap, alignItems: "center" }}>{children}</div>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset
      style={{
        border: "1px solid #2a2d33",
        borderRadius: 4,
        padding: 10,
        marginBottom: 10,
      }}
    >
      <legend style={{ padding: "0 6px", fontSize: 11, opacity: 0.7 }}>{title}</legend>
      {children}
    </fieldset>
  );
}
