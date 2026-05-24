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
  const fromCoords = squareCoords(from);
  const toCoords = squareCoords(to);
  const x1 = ((fromCoords.file + 0.5) / files) * 100;
  const y1 = ((ranks - 1 - fromCoords.rank + 0.5) / ranks) * 100;
  const x2 = ((toCoords.file + 0.5) / files) * 100;
  const y2 = ((ranks - 1 - toCoords.rank + 0.5) / ranks) * 100;

  const markerId = "probe-arrowhead";

  return (
    <svg className={styles.arrowOverlay} viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <marker id={markerId} markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
          <polygon points="0 0, 4 1.5, 0 3" fill="rgba(0, 210, 180, 0.8)" />
        </marker>
      </defs>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="rgba(0, 210, 180, 0.6)"
        strokeWidth="1.2"
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
