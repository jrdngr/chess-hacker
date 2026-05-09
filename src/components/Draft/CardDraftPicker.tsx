// Card draft picker — 10 rounds of pick-1-of-3.
//
// Round composition: 6 commons → 3 uncommons → 1 rare. Each round, three
// distinct cards of the round's rarity are drawn, animate in fanned from a
// draw anchor (mirroring Hand's deal animation), and the player clicks one.
// The picked card rises to the top and fades; the rejects slide toward a
// discard anchor and fade. After the exit completes, the next round deals.
//
// The animation re-uses Hand.tsx's primitives — same easing, same staggers,
// same two-RAF transition trick — so the picker's "deal" feels consistent
// with what cards do during a match. Cards aren't unmounted until exit
// completes; we key elements on `${round}-${i}` so each round mounts fresh
// (no leftover inline styles).

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Card, CardRarity } from "../../game/types";
import { getCardsByRarity } from "../../game/cards/library";

import styles from "./Draft.module.css";

const ENTER_DURATION_MS = 400;
const ENTER_STAGGER_MS = 64;
const REJECT_EXIT_MS = 400;
const PICK_EXIT_MS = 600;
const ENTER_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const PICK_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const REJECT_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

const ROUND_RARITY: ReadonlyArray<CardRarity> = [
  "common",
  "common",
  "common",
  "common",
  "common",
  "common",
  "uncommon",
  "uncommon",
  "uncommon",
  "rare",
];
const TOTAL_ROUNDS = ROUND_RARITY.length;

function pickThreeDistinct(rarity: CardRarity): Card[] {
  const pool = getCardsByRarity(rarity);
  if (pool.length === 0) return [];
  if (pool.length <= 3) return pool.slice();
  const indices = new Set<number>();
  while (indices.size < 3) indices.add(Math.floor(Math.random() * pool.length));
  return Array.from(indices, (i) => pool[i]);
}

type Phase = "dealing" | "ready" | "picking";

type Props = {
  onComplete: (drafted: Card[]) => void;
  onCancel: () => void;
};

export function CardDraftPicker({ onComplete, onCancel }: Props) {
  const [round, setRound] = useState(0);
  const [drafted, setDrafted] = useState<Card[]>([]);
  const [current, setCurrent] = useState<Card[]>(() => pickThreeDistinct(ROUND_RARITY[0]));
  const [phase, setPhase] = useState<Phase>("dealing");
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const drawAnchorRef = useRef<HTMLDivElement>(null);
  const discardAnchorRef = useRef<HTMLDivElement>(null);
  const cardElsRef = useRef<(HTMLButtonElement | null)[]>([null, null, null]);
  // Latest onComplete in a ref so the all-rounds-done effect doesn't fire
  // twice in strict mode.
  const completedRef = useRef(false);

  const currentRarity = ROUND_RARITY[round];

  // After the final pick, hand the drafted deck back to the parent.
  useEffect(() => {
    if (round < TOTAL_ROUNDS) return;
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete(drafted);
    // onComplete is captured intentionally; we want to fire exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, drafted]);

  // Deal animation — fires when entering a "dealing" phase with cards
  // mounted. Translates each slot from the draw anchor into place,
  // staggered. After the longest stagger + duration, transition to "ready"
  // so clicks unlock.
  useLayoutEffect(() => {
    if (phase !== "dealing") return;
    if (current.length === 0) return;
    const stageEl = stageRef.current;
    const drawEl = drawAnchorRef.current;
    if (!stageEl || !drawEl) return;

    const stageRect = stageEl.getBoundingClientRect();
    const drawRect = drawEl.getBoundingClientRect();
    const drawCx = drawRect.left + drawRect.width / 2 - stageRect.left;
    const drawCy = drawRect.top + drawRect.height / 2 - stageRect.top;

    const els: { el: HTMLButtonElement; delayMs: number }[] = [];
    for (let i = 0; i < current.length; i++) {
      const el = cardElsRef.current[i];
      if (!el) continue;
      const slotRect = el.getBoundingClientRect();
      const slotCx = slotRect.left + slotRect.width / 2 - stageRect.left;
      const slotCy = slotRect.top + slotRect.height / 2 - stageRect.top;
      el.style.transition = "none";
      el.style.transform = `translate(${drawCx - slotCx}px, ${drawCy - slotCy}px) scale(0.35)`;
      els.push({ el, delayMs: i * ENTER_STAGGER_MS });
    }

    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        for (const { el, delayMs } of els) {
          el.style.transition = `transform ${ENTER_DURATION_MS}ms ${ENTER_EASING}`;
          el.style.transitionDelay = `${delayMs}ms`;
          el.style.transform = "";
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
    // `current` change == new round; phase moves dealing→ready when done.
  }, [phase, current]);

  function onPick(idx: number) {
    if (phase !== "ready") return;
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
        // Picked: rise toward the top of the stage and fade.
        const dy = -slotCy - slotRect.height;
        el.style.transition = `transform ${PICK_EXIT_MS}ms ${PICK_EASING}, opacity ${PICK_EXIT_MS}ms ease-out`;
        el.style.transform = `translate(0px, ${dy}px) scale(0.85)`;
        el.style.opacity = "0";
      } else {
        // Reject: slide toward the discard anchor with shrink+fade.
        let endTransform = `translate(0px, ${stageRect.height - slotCy}px) scale(0.18)`;
        if (discardCx !== null && discardCy !== null) {
          endTransform = `translate(${discardCx - slotCx}px, ${discardCy - slotCy}px) scale(0.18)`;
        }
        el.style.transition = `transform ${REJECT_EXIT_MS}ms ${REJECT_EASING}, opacity ${REJECT_EXIT_MS}ms ease-out`;
        el.style.transform = endTransform;
        el.style.opacity = "0";
      }
    }

    const picked = current[idx];
    const exitMs = Math.max(PICK_EXIT_MS, REJECT_EXIT_MS);
    window.setTimeout(() => {
      setDrafted((d) => [...d, picked]);
      const nextRound = round + 1;
      setRound(nextRound);
      setPickedIdx(null);
      if (nextRound >= TOTAL_ROUNDS) {
        // Hand off via the round-watching effect; clear the picker.
        setCurrent([]);
        setPhase("dealing");
        return;
      }
      setCurrent(pickThreeDistinct(ROUND_RARITY[nextRound]));
      setPhase("dealing");
    }, exitMs + 50);
  }

  return (
    <div className={styles.flow}>
      <div className={styles.pickerArea}>
        <div className={styles.pickerHeader}>
          <span className={styles.pickerHeaderLeft}>
            ▌ROUND {Math.min(round + 1, TOTAL_ROUNDS)}/{TOTAL_ROUNDS} — PICK A{" "}
            {currentRarity ? currentRarity.toUpperCase() : "CARD"}
          </span>
          <span>
            DRAFTED {drafted.length}/{TOTAL_ROUNDS}
          </span>
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
            {current.map((card, i) => {
              const interactive = phase === "ready" && pickedIdx === null;
              const cls = [styles.card, !interactive && styles.disabled].filter(Boolean).join(" ");
              return (
                <button
                  key={`${round}-${i}`}
                  type="button"
                  className={cls}
                  ref={(el) => {
                    cardElsRef.current[i] = el;
                  }}
                  onClick={() => onPick(i)}
                  disabled={!interactive}
                  aria-label={`${card.name}, cost ${card.cost}. ${card.description}`}
                >
                  <span className={styles.cost}>{card.cost}</span>
                  <span className={styles.archetype}>{card.archetype}</span>
                  <span className={styles.name}>{card.name}</span>
                  <span className={styles.description}>{card.description}</span>
                  <span className={styles.rarity}>{card.rarity}</span>
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
