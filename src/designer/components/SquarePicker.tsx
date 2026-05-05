import type { AlgebraicSquare } from "../../game/types";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

/**
 * 8×8 click-to-toggle grid. `selected` is the set of currently-selected
 * squares; clicking a square adds/removes it from the set via `onToggle`.
 *
 * `accent` colours the selected squares — the boss editor uses two
 * SquarePickers side by side (hazardWalls + voidSquares) with different
 * accents so the user can tell them apart at a glance.
 */
export function SquarePicker({
  selected,
  onToggle,
  accent = "#4a90e2",
  size = 28,
}: {
  selected: ReadonlyArray<AlgebraicSquare>;
  onToggle: (square: AlgebraicSquare) => void;
  accent?: string;
  size?: number;
}) {
  const set = new Set(selected);
  return (
    <div style={{ display: "inline-block", border: "1px solid #2a2d33" }}>
      {RANKS.map((rank) => (
        <div key={rank} style={{ display: "flex" }}>
          {FILES.map((file) => {
            const sq = `${file}${rank}` as AlgebraicSquare;
            const isLight = (FILES.indexOf(file) + rank) % 2 === 0;
            const active = set.has(sq);
            return (
              <button
                key={sq}
                onClick={() => onToggle(sq)}
                title={sq}
                style={{
                  width: size,
                  height: size,
                  background: active ? accent : isLight ? "#3a3f48" : "#23262c",
                  color: active ? "#0e1013" : "#aaa",
                  border: "none",
                  borderRadius: 0,
                  fontSize: 10,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {sq}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
