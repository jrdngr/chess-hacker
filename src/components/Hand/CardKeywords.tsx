import type { Card } from "../../game/types";

import styles from "./Hand.module.css";

type Props = {
  card: Card;
  /**
   * When supplied, overrides the card's built-in `retain` flag — used by Hand
   * to surface a Bookmark-applied retain on a slot whose card definition
   * doesn't have `retain: true` itself.
   */
  retained?: boolean;
};

export function CardKeywords({ card, retained }: Props) {
  const showRetain = retained ?? card.retain === true;
  const keywords: string[] = [];
  if (showRetain) keywords.push("Retain");
  if (card.consume) keywords.push("Consume");
  if (keywords.length === 0) return null;
  return (
    <span className={styles.keywords}>
      {keywords.map((kw) => (
        <span
          key={kw}
          className={`${styles.keyword} ${styles[`keyword_${kw.toLowerCase()}`] ?? ""}`}
        >
          {kw}
        </span>
      ))}
    </span>
  );
}
