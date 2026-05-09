// Shared framed-surface helper. Mirrors the Panel() component in
// chess-game/project/mockups/amber-page.jsx — 1px border with a double
// inset stripe, optional left/right title chips that punch through the
// border line.

import type { ReactNode } from "react";

import styles from "./Panel.module.css";

type Props = {
  /** Left-aligned title chip ("▌SESSION"). */
  title?: ReactNode;
  /** Right-aligned ticker chip ("E3/3▐"). */
  ticker?: ReactNode;
  /** Accent colour token name. Default `--p-primary`; pass `--p-opp` for the
   * THREAT panel red variant. */
  accentVar?: string;
  className?: string;
  /** Allow callers to override flex/grid sizing without re-authoring chrome. */
  style?: React.CSSProperties;
  children?: ReactNode;
  /** Marks the panel as a popover anchor for inline children that need to
   * position themselves below it. */
  asAnchor?: boolean;
};

export function Panel({ title, ticker, accentVar, className, style, children, asAnchor }: Props) {
  const cs: React.CSSProperties = {
    ...style,
    // Default to primary; ThreatPanel passes --p-opp.
    ["--panel-accent" as string]: `var(${accentVar ?? "--p-primary"})`,
  };
  return (
    <section
      className={`${styles.panel} ${asAnchor ? styles.anchor : ""} ${className ?? ""}`}
      style={cs}
    >
      {title && <span className={styles.title}>▌{title}</span>}
      {ticker && <span className={styles.ticker}>{ticker}▐</span>}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
