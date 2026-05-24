import type { AlgebraicSquare } from "../../game/types";
import { squareCoords } from "../../game/chess/engine";
import styles from "./MoveArrow.module.css";

type Props = {
  from: AlgebraicSquare;
  to: AlgebraicSquare;
  files: number;
  ranks: number;
};

export function MoveArrow({ from, to, files, ranks }: Props) {
  const fc = squareCoords(from);
  const tc = squareCoords(to);
  const x1 = fc.file + 0.5;
  const y1 = ranks - 1 - fc.rank + 0.5;
  const x2 = tc.file + 0.5;
  const y2 = ranks - 1 - tc.rank + 0.5;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return null;

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const headWidth = 0.8;
  const bodyWidth = headWidth / 3;
  const headLength = headWidth * 0.9;

  const hx = x2 - ux * headLength;
  const hy = y2 - uy * headLength;
  const bw = bodyWidth / 2;
  const hw = headWidth / 2;

  const points = [
    `${x1 + px * bw},${y1 + py * bw}`,
    `${hx + px * bw},${hy + py * bw}`,
    `${hx + px * hw},${hy + py * hw}`,
    `${x2},${y2}`,
    `${hx - px * hw},${hy - py * hw}`,
    `${hx - px * bw},${hy - py * bw}`,
    `${x1 - px * bw},${y1 - py * bw}`,
  ].join(" ");

  return (
    <svg
      className={styles.arrowOverlay}
      viewBox={`0 0 ${files} ${ranks}`}
      preserveAspectRatio="none"
    >
      <polygon points={points} fill="rgba(0, 210, 180, 0.6)" />
    </svg>
  );
}
