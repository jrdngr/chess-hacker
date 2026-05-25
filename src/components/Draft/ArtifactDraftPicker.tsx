// Artifact draft picker — pick 1 of 3 uncommon artifacts.
//
// Single-round flavour of CardDraftPicker. Three distinct uncommon artifacts
// are drawn, dealt fanned in, and the player clicks one. The picked artifact
// rises and fades; the rejects slide toward the discard anchor. After the
// pick animation completes, `onComplete(artifactId)` is called.
//
// Uses the same animation primitives as CardDraftPicker so the gesture
// language matches what the player just did with cards.

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Artifact } from "../../game/types";
import { allArtifacts, artifactEmoji } from "../../game/artifacts/library";
import { FormattedText } from "../FormattedText";

import styles from "./Draft.module.css";

const ENTER_DURATION_MS = 400;
const ENTER_STAGGER_MS = 64;
const REJECT_EXIT_MS = 400;
const PICK_EXIT_MS = 600;
const ENTER_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const PICK_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const REJECT_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

type Phase = "dealing" | "ready" | "picking";

function pickThreeDistinctUncommons(): Artifact[] {
  const pool = allArtifacts().filter((a) => a.rarity === "uncommon");
  if (pool.length <= 3) return pool.slice();
  const indices = new Set<number>();
  while (indices.size < 3) indices.add(Math.floor(Math.random() * pool.length));
  return Array.from(indices, (i) => pool[i]);
}

type Props = {
  onComplete: (artifactId: string) => void;
  onCancel: () => void;
};

export function ArtifactDraftPicker({ onComplete, onCancel }: Props) {
  const offers = useMemo(() => pickThreeDistinctUncommons(), []);
  const [phase, setPhase] = useState<Phase>("dealing");
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const drawAnchorRef = useRef<HTMLDivElement>(null);
  const discardAnchorRef = useRef<HTMLDivElement>(null);
  const cardElsRef = useRef<(HTMLButtonElement | null)[]>(offers.map(() => null));
  const completedRef = useRef(false);

  useLayoutEffect(() => {
    if (phase !== "dealing") return;
    const stageEl = stageRef.current;
    const drawEl = drawAnchorRef.current;
    if (!stageEl || !drawEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    const drawRect = drawEl.getBoundingClientRect();
    const drawCx = drawRect.left + drawRect.width / 2 - stageRect.left;
    const drawCy = drawRect.top + drawRect.height / 2 - stageRect.top;

    const els: { el: HTMLButtonElement; delayMs: number }[] = [];
    for (let i = 0; i < offers.length; i++) {
      const el = cardElsRef.current[i];
      if (!el) continue;
      const slotRect = el.getBoundingClientRect();
      const slotCx = slotRect.left + slotRect.width / 2 - stageRect.left;
      const slotCy = slotRect.top + slotRect.height / 2 - stageRect.top;
      el.style.transition = "none";
      el.style.transform = `translate(${drawCx - slotCx}px, ${drawCy - slotCy}px) scale(0.35)`;
      el.style.opacity = "0.4";
      els.push({ el, delayMs: i * ENTER_STAGGER_MS });
    }

    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        for (const { el, delayMs } of els) {
          el.style.transition = `transform ${ENTER_DURATION_MS}ms ${ENTER_EASING}, opacity ${ENTER_DURATION_MS}ms ease-out`;
          el.style.transitionDelay = `${delayMs}ms, ${delayMs}ms`;
          el.style.transform = "";
          el.style.opacity = "";
        }
      });
    });

    const lastDelay = (els.length - 1) * ENTER_STAGGER_MS;
    const t = window.setTimeout(
      () => {
        for (const { el } of els) {
          el.style.transition = "";
          el.style.transitionDelay = "";
        }
        setPhase("ready");
      },
      lastDelay + ENTER_DURATION_MS + 50,
    );

    return () => {
      cancelAnimationFrame(r1);
      if (r2) cancelAnimationFrame(r2);
      window.clearTimeout(t);
    };
  }, [phase, offers]);

  function onPick(idx: number) {
    if (phase !== "ready") return;
    if (completedRef.current) return;
    setPickedIdx(idx);
    setPhase("picking");

    const stageEl = stageRef.current;
    const discardEl = discardAnchorRef.current;
    if (!stageEl) return;
    const stageRect = stageEl.getBoundingClientRect();

    let discardCx: number | null = null;
    let discardCy: number | null = null;
    if (discardEl) {
      const dRect = discardEl.getBoundingClientRect();
      discardCx = dRect.left + dRect.width / 2 - stageRect.left;
      discardCy = dRect.top + dRect.height / 2 - stageRect.top;
    }

    for (let i = 0; i < cardElsRef.current.length; i++) {
      const el = cardElsRef.current[i];
      if (!el) continue;
      const slotRect = el.getBoundingClientRect();
      const slotCx = slotRect.left + slotRect.width / 2 - stageRect.left;
      const slotCy = slotRect.top + slotRect.height / 2 - stageRect.top;

      if (i === idx) {
        const dy = -slotCy - slotRect.height;
        el.style.transition = `transform ${PICK_EXIT_MS}ms ${PICK_EASING}, opacity ${PICK_EXIT_MS}ms ease-out`;
        el.style.transform = `translate(0px, ${dy}px) scale(0.85)`;
        el.style.opacity = "0";
      } else {
        let endTransform = `translate(0px, ${stageRect.height - slotCy}px) scale(0.18)`;
        if (discardCx !== null && discardCy !== null) {
          endTransform = `translate(${discardCx - slotCx}px, ${discardCy - slotCy}px) scale(0.18)`;
        }
        el.style.transition = `transform ${REJECT_EXIT_MS}ms ${REJECT_EASING}, opacity ${REJECT_EXIT_MS}ms ease-out`;
        el.style.transform = endTransform;
        el.style.opacity = "0";
      }
    }

    const picked = offers[idx];
    const exitMs = Math.max(PICK_EXIT_MS, REJECT_EXIT_MS);
    window.setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete(picked.id);
    }, exitMs + 50);
  }

  return (
    <div className={styles.flow}>
      <div className={styles.pickerArea}>
        <div className={styles.pickerHeader}>
          <span className={styles.pickerHeaderLeft}>▌DRAFT ARTIFACT — PICK 1 OF 3</span>
          <span>UNCOMMON</span>
        </div>
        <div className={styles.pickerStage} ref={stageRef}>
          <div
            ref={drawAnchorRef}
            aria-hidden="true"
            style={{ position: "absolute", left: 16, bottom: 16, width: 1, height: 1 }}
          />
          <div
            ref={discardAnchorRef}
            aria-hidden="true"
            style={{ position: "absolute", right: 16, bottom: 16, width: 1, height: 1 }}
          />
          <div className={styles.pickerRow}>
            {offers.map((artifact, i) => {
              const interactive = phase === "ready" && pickedIdx === null;
              const cls = [styles.card, styles.artifactCard, !interactive && styles.disabled]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={`${artifact.id}-${i}`}
                  type="button"
                  className={cls}
                  ref={(el) => {
                    cardElsRef.current[i] = el;
                  }}
                  onClick={() => onPick(i)}
                  disabled={!interactive}
                  aria-label={`${artifact.name} (${artifact.rarity}). ${artifact.description}`}
                >
                  <span className={styles.artifactEmoji}>{artifactEmoji(artifact.id)}</span>
                  <span className={styles.artifactName}>{artifact.name}</span>
                  <span className={styles.description}>
                    <FormattedText text={artifact.description} />
                  </span>
                  <span className={styles.rarity}>{artifact.rarity}</span>
                </button>
              );
            })}
          </div>
        </div>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          Back
        </button>
      </div>
    </div>
  );
}
