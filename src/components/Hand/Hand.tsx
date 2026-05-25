// The player's hand of cards. Click a card to play it; cards that need a
// target enter "targeting" mode and the next eligible board click resolves
// the play.
//
// The hand is dumb: it renders the cards passed in and reports clicks back.
// All state (energy gating, targeting, draw pile) lives in the Match. The
// piles themselves now live in the side panel's PILES section — the Hand
// only renders cards (plus a header strip for hotkey hints).
//
// Draw / discard animation: the Hand still owns the entry / exit motion of
// each HandCard. Slots get a stable id via a WeakMap so we can tell new
// slots (slide in from the side panel's draw pile if it's mounted, otherwise
// from the screen edge) and removed slots (slide out toward the discard
// pile if mounted, otherwise fade in place).

import { useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Card, CardTarget, HandCard } from "../../game/types";

import { CardKeywords } from "./CardKeywords";
import styles from "./Hand.module.css";

// Two-step targeting cards (pick A, then pick B) don't fit a single drag-and-
// drop gesture; they must be played via click. Hand-card targets (Bookmark) also
// click-only — the second click lands on another card in the hand. Everything
// else — single-square targets and no-target cards — is draggable from the
// hand.
const NON_DRAGGABLE_TARGETS: ReadonlySet<CardTarget["kind"]> = new Set([
  "two-own-pieces",
  "two-enemy-non-king-pieces",
  "own-piece-then-adjacent-empty",
  "marionette",
  "hand-card",
]);

// Each card's slide from draw pile → hand slot lasts this long.
const ENTER_DURATION_MS = 400;
// Each card's slide from hand → discard pile lasts this long.
const EXIT_DURATION_MS = 400;
// Time between successive cards starting their enter animation. Cards leave
// the pile in slot order (slot 0 first, slot N-1 last) so the swarm fans out
// across the hand area instead of arriving as a single rigid line.
const ENTER_STAGGER_MS = 64;
// Mirror of ENTER_STAGGER_MS for the exit. Cards leave hand in reverse slot
// order — slot N-1 (closest to the discard pile) goes first, slot 0 last —
// so the discard plays as a time-reverse of the draw fan.
const EXIT_STAGGER_MS = 64;
const ENTER_EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const ENTER_TRANSITION = `transform ${ENTER_DURATION_MS}ms ${ENTER_EASING}, opacity ${ENTER_DURATION_MS}ms ease-out`;

/** Module-scoped id allocators — stable across remounts within a session. */
let nextSlotId = 1;
let nextGhostId = 1;

type Rect = { left: number; top: number; width: number; height: number };

type ExitGhost = {
  ghostId: number;
  card: Card;
  retained: boolean;
  startRect: Rect;
  // Center offset to translate to (relative to startRect's top-left) plus the
  // shrink scale. Computed once when the ghost is created so it survives even
  // if the destination pile DOM moves slightly mid-animation.
  endTransform: string;
  fadeOnly: boolean;
  /** ms to wait before kicking off this ghost's slide. Mirrors the draw fan. */
  delayMs: number;
};

type Props = {
  hand: ReadonlyArray<HandCard>;
  energy: number;
  energyMax: number;
  /** Hand index that is currently "in flight" waiting for a target, if any. */
  targetingIndex: number | null;
  /** Whether the player is allowed to interact with their hand right now. */
  enabled: boolean;
  /**
   * Hand indexes the active boss modifier forbids playing (e.g. Boss A's
   * "no walls" rule disables every place-wall card). Greys out the card and
   * blocks click + drag.
   */
  forbiddenIndexes?: ReadonlySet<number>;
  onCardClick: (index: number) => void;
  /** Drag a targeted card from the hand onto a board square to play it. */
  onCardDragStart?: (index: number) => void;
  onCardDragEnd?: () => void;
  /** How many voluntary discards the player has remaining this turn. */
  discardsRemaining?: number;
  /** Called when the player drags a card to the discard zone. */
  onVoluntaryDiscard?: (index: number) => void;
};

export function Hand({
  hand,
  energy,
  energyMax,
  targetingIndex,
  enabled,
  forbiddenIndexes,
  onCardClick,
  onCardDragStart,
  onCardDragEnd,
  discardsRemaining = 0,
  onVoluntaryDiscard,
}: Props) {
  const [discardDragOver, setDiscardDragOver] = useState(false);

  // When the active targeting card asks for a hand-card target (Bookmark),
  // every hand slot except the playing one becomes a click target. We
  // surface that mode so the slots can be highlighted.
  const targetingHandCard =
    targetingIndex !== null && hand[targetingIndex]?.card.target.kind === "hand-card";

  // ---- Animation bookkeeping ------------------------------------------------

  const handAreaRef = useRef<HTMLDivElement>(null);
  const drawPileRef = useRef<HTMLButtonElement>(null);
  const discardPileRef = useRef<HTMLButtonElement>(null);

  // HandCard reference → stable slot id. WeakMap keeps the per-slot identity
  // alive only as long as the HandCard is reachable from the parent; once it's
  // discarded it can be GCed. A second WeakMap fallback (handled inline below)
  // recovers the id when retain mints a fresh HandCard for the same Card.
  const slotIdMapRef = useRef<WeakMap<HandCard, number>>(new WeakMap());
  // Last hand prop seen. Used to compute exits.
  const prevHandRef = useRef<ReadonlyArray<HandCard>>([]);
  // slotId → DOM node, populated by ref callbacks during render.
  const slotElementsRef = useRef<Map<number, HTMLButtonElement>>(new Map());
  // slotId → last-known rect (relative to handArea). Updated every render so
  // that when a slot disappears we know where to spawn its exit ghost.
  const slotRectsRef = useRef<Map<number, Rect>>(new Map());
  // slotIds we've already kicked off the enter animation for — prevents the
  // animation from re-running on every render of the same card.
  const seenIdsRef = useRef<Set<number>>(new Set());

  // Compute stable slot ids for the current hand prop. Three passes:
  //  1. Reference identity via the WeakMap (the common case).
  //  2. Fallback by `.card` reference for retain transitions (the slot wrapper
  //     gets re-allocated by Bookmark, but the inner Card reference is the same).
  //  3. Allocate fresh ids for anything still unmatched (i.e., truly new).
  const slotIds = useMemo(() => {
    const prev = prevHandRef.current;
    const map = slotIdMapRef.current;
    const result: number[] = new Array(hand.length).fill(0);
    const taken = new Set<number>();

    for (let i = 0; i < hand.length; i++) {
      const id = map.get(hand[i]);
      if (id !== undefined && !taken.has(id)) {
        taken.add(id);
        result[i] = id;
      }
    }

    for (let i = 0; i < hand.length; i++) {
      if (result[i] !== 0) continue;
      for (let j = 0; j < prev.length; j++) {
        if (prev[j].card !== hand[i].card) continue;
        const id = map.get(prev[j]);
        if (id !== undefined && !taken.has(id)) {
          taken.add(id);
          result[i] = id;
          map.set(hand[i], id);
          break;
        }
      }
    }

    for (let i = 0; i < hand.length; i++) {
      if (result[i] !== 0) continue;
      const id = nextSlotId++;
      result[i] = id;
      map.set(hand[i], id);
    }

    return result;
    // hand identity is the input; prevHandRef and slotIdMapRef are intentionally
    // not deps — they're refs, and we only diff them inside the body.
  }, [hand]);

  const [ghosts, setGhosts] = useState<ExitGhost[]>([]);

  useLayoutEffect(() => {
    const handAreaEl = handAreaRef.current;
    if (!handAreaEl) {
      prevHandRef.current = hand;
      return;
    }
    const handAreaRect = handAreaEl.getBoundingClientRect();

    // 1. Refresh the cached rect for every currently-rendered slot. Done
    //    before kicking off any animations so exits can read fresh positions.
    const freshRects = new Map<number, Rect>();
    for (const id of slotIds) {
      const el = slotElementsRef.current.get(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      freshRects.set(id, {
        left: r.left - handAreaRect.left,
        top: r.top - handAreaRect.top,
        width: r.width,
        height: r.height,
      });
    }
    for (const [id, rect] of freshRects) slotRectsRef.current.set(id, rect);

    // 2. Build exit ghosts for slots that disappeared between renders. We use
    //    the last-known rect (captured on the previous render) as the start
    //    position, and the appropriate pile's center as the end position.
    //    Stagger order is the reverse of the draw fan — the rightmost card
    //    (closest to the discard pile) leaves first, the leftmost last.
    const prevHand = prevHandRef.current;
    const currentIdSet = new Set(slotIds);
    const exitingIndices: number[] = [];
    for (let j = 0; j < prevHand.length; j++) {
      const id = slotIdMapRef.current.get(prevHand[j]);
      if (id === undefined || currentIdSet.has(id)) continue;
      if (!slotRectsRef.current.has(id)) continue;
      exitingIndices.push(j);
    }
    // Highest hand-index goes first → reverse-sort.
    exitingIndices.sort((a, b) => b - a);
    const newGhosts: ExitGhost[] = [];
    for (let k = 0; k < exitingIndices.length; k++) {
      const j = exitingIndices[k];
      const slot = prevHand[j];
      const id = slotIdMapRef.current.get(slot)!;
      const startRect = slotRectsRef.current.get(id)!;
      const isConsume = !!slot.card.consume;
      // Consume cards vanish in place — they don't go to the discard pile.
      // Everything else flies toward the discard pile.
      const pileEl = !isConsume ? discardPileRef.current : null;
      let endTransform = "scale(0.7)";
      if (pileEl) {
        const pileRect = pileEl.getBoundingClientRect();
        const endCx = pileRect.left + pileRect.width / 2 - handAreaRect.left;
        const endCy = pileRect.top + pileRect.height / 2 - handAreaRect.top;
        const startCx = startRect.left + startRect.width / 2;
        const startCy = startRect.top + startRect.height / 2;
        endTransform = `translate(${endCx - startCx}px, ${endCy - startCy}px) scale(0.18)`;
      }
      newGhosts.push({
        ghostId: nextGhostId++,
        card: slot.card,
        retained: slot.retained,
        startRect,
        endTransform,
        fadeOnly: isConsume,
        delayMs: k * EXIT_STAGGER_MS,
      });
      // The slot will never render again — drop its bookkeeping.
      slotElementsRef.current.delete(id);
      slotRectsRef.current.delete(id);
      seenIdsRef.current.delete(id);
    }
    if (newGhosts.length > 0) setGhosts((g) => [...g, ...newGhosts]);

    // 3. Kick off the enter animation for slots we haven't seen before. All
    //    new cards plant themselves at the draw pile (inline transform, no
    //    transition) so they fully overlap there. Then on the next frame we
    //    add the transition with a per-card `transition-delay` (slot 0 starts
    //    immediately, slot N-1 waits the longest) and clear the transform —
    //    the cards glide home in sequence, fanning across the hand area as
    //    each one peels off the stack. After the longest combined delay we
    //    strip the inline transition so the idle hover behaviour returns.
    const newlyEntered: number[] = [];
    for (const id of slotIds) {
      if (seenIdsRef.current.has(id)) continue;
      newlyEntered.push(id);
      seenIdsRef.current.add(id);
    }
    if (newlyEntered.length > 0) {
      const drawEl = drawPileRef.current;
      let drawCx = 0;
      let drawCy = 0;
      if (drawEl) {
        const drawRect = drawEl.getBoundingClientRect();
        drawCx = drawRect.left + drawRect.width / 2 - handAreaRect.left;
        drawCy = drawRect.top + drawRect.height / 2 - handAreaRect.top;
      }
      type EnterEntry = { el: HTMLButtonElement; delayMs: number };
      const enteringEls: EnterEntry[] = [];
      for (let k = 0; k < newlyEntered.length; k++) {
        const id = newlyEntered[k];
        const el = slotElementsRef.current.get(id);
        const slotRect = slotRectsRef.current.get(id);
        if (!el || !slotRect) continue;
        const slotCx = slotRect.left + slotRect.width / 2;
        const slotCy = slotRect.top + slotRect.height / 2;
        el.style.transition = "none";
        el.style.transform = `translate(${drawCx - slotCx}px, ${drawCy - slotCy}px) scale(0.35)`;
        el.style.opacity = "0.4";
        enteringEls.push({ el, delayMs: k * ENTER_STAGGER_MS });
      }
      // Two RAFs ensures the browser paints the start frame before we swap
      // in the transition and clear the transform.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          for (const { el, delayMs } of enteringEls) {
            el.style.transition = ENTER_TRANSITION;
            el.style.transitionDelay = `${delayMs}ms, ${delayMs}ms`;
            el.style.transform = "";
            el.style.opacity = "";
          }
        });
      });
      // Strip the inline transition once the slide finishes so the idle
      // hover transition (.card's 80ms transform) takes over again.
      const lastDelay = (newlyEntered.length - 1) * ENTER_STAGGER_MS;
      window.setTimeout(
        () => {
          for (const { el } of enteringEls) {
            el.style.transition = "";
            el.style.transitionDelay = "";
          }
        },
        lastDelay + ENTER_DURATION_MS + 50,
      );
    }

    prevHandRef.current = hand;
  }, [slotIds, hand]);

  return (
    <div className={styles.handArea} ref={handAreaRef}>
      <div className={styles.energyRow} aria-label={`Energy: ${energy}`}>
        <span className={styles.energyLabel}>ENERGY</span>
        <span className={styles.energyValue}>
          {energy}/{energyMax}
        </span>
        <div className={styles.energyBar}>
          {Array.from({ length: Math.max(1, energyMax) }).map((_, i) => (
            <span key={i} className={`${styles.energySeg} ${i < energy ? styles.energyLit : ""}`} />
          ))}
        </div>
      </div>
      <div className={styles.hand} role="list" aria-label="Hand">
        {hand.length === 0 ? (
          <div className={styles.emptyHand}>Hand is empty</div>
        ) : (
          hand.map((slot, i) => {
            const card = slot.card;
            const slotId = slotIds[i];
            const affordable = energy >= card.cost;
            const isTargeting = targetingIndex === i;
            const forbidden = forbiddenIndexes?.has(i) ?? false;
            const playable = enabled && affordable && !forbidden;
            // When Bookmark is asking for a hand-card target, the slot is
            // clickable as a target if it isn't the playing slot and isn't
            // already retained.
            const isBookmarkTarget = targetingHandCard && !isTargeting && !slot.retained;
            const clickable = playable || isBookmarkTarget;
            // Two-step cards (Switch Files, Remote Access) and hand-card targets
            // (Bookmark) still resolve via click; everything else can be dragged
            // onto the board. Cards are also draggable for discard if discards remain.
            const draggableToPlay = playable && !NON_DRAGGABLE_TARGETS.has(card.target.kind);
            const draggableToDiscard = enabled && discardsRemaining > 0;
            const draggable = draggableToPlay || draggableToDiscard;
            const retained = slot.retained || card.retain === true;
            // Visually dim only for intrinsic, card-specific reasons (cost or
            // a boss/forbid rule). Turn-state reasons (AI thinking, AI's turn,
            // match over) leave the card looking normal — clicks/drag are
            // still blocked via the button's disabled attribute.
            const visuallyDisabled = !affordable || forbidden;
            const cls = [
              styles.card,
              visuallyDisabled && styles.disabled,
              isTargeting && styles.targeting,
              isBookmarkTarget && styles.stashTarget,
              retained && styles.retained,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={slotId}
                type="button"
                role="listitem"
                ref={(el) => {
                  if (el) slotElementsRef.current.set(slotId, el);
                  else slotElementsRef.current.delete(slotId);
                }}
                className={cls}
                onClick={() => clickable && onCardClick(i)}
                disabled={!clickable}
                draggable={draggable}
                onDragStart={(e) => {
                  if (!draggable || !onCardDragStart) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                  // Anchor the drag preview at its top-left so the card
                  // hangs down-right from the cursor instead of trailing
                  // wherever the user grabbed it. (setDragImage is missing
                  // under jsdom — guard for tests.)
                  if (typeof e.dataTransfer.setDragImage === "function") {
                    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
                  }
                  onCardDragStart(i);
                }}
                onDragEnd={() => onCardDragEnd?.()}
                aria-label={`${card.name}, cost ${card.cost}. ${card.description}${forbidden ? " — forbidden by boss modifier." : ""}${retained ? " — retained." : ""}`}
                data-card-id={card.id}
                title={`${card.name} (${card.cost}E)\n${card.description}${forbidden ? "\n\nForbidden by the active boss modifier" : ""}`}
              >
                <span className={styles.cost}>{card.cost}</span>
                <span className={styles.name}>{card.name}</span>
                <span className={styles.archetype}>{card.archetype}</span>
                <CardKeywords card={card} retained={retained} />
                <span className={styles.description}>{card.description}</span>
              </button>
            );
          })
        )}
      </div>

      {enabled && discardsRemaining > 0 && (
        <div
          className={`${styles.discardZone} ${discardDragOver ? styles.discardZoneActive : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDiscardDragOver(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDiscardDragOver(true);
          }}
          onDragLeave={() => setDiscardDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDiscardDragOver(false);
            const idx = parseInt(e.dataTransfer.getData("text/plain"), 10);
            if (!isNaN(idx)) onVoluntaryDiscard?.(idx);
          }}
          aria-label={`Discard zone, ${discardsRemaining} discards remaining`}
        >
          <span className={styles.discardZoneText}>
            {discardsRemaining} {discardsRemaining === 1 ? "discard" : "discards"} remaining
          </span>
        </div>
      )}

      {ghosts.length > 0 && (
        <div className={styles.ghostLayer} aria-hidden="true">
          {ghosts.map((g) => (
            <ExitGhostCard
              key={g.ghostId}
              ghost={g}
              onDone={() => setGhosts((cur) => cur.filter((x) => x.ghostId !== g.ghostId))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One card animating from its last hand slot toward the discard / consumed
 * pile (or fading in place for Consume cards). On mount, applies an inline
 * `transform` that translates + shrinks toward the pile centre — the CSS
 * transition on `.ghost` runs the motion. After EXIT_DURATION_MS the parent
 * removes us from state and we unmount.
 */
function ExitGhostCard({ ghost, onDone }: { ghost: ExitGhost; onDone: () => void }) {
  const [moving, setMoving] = useState(false);
  // Latest onDone in a ref so the mount effect's empty-deps array doesn't
  // capture a stale callback and so a re-render of the parent doesn't
  // reschedule the timeout.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useLayoutEffect(() => {
    // The ghost stays at its start position until its stagger delay elapses,
    // then runs the 500ms slide. The unmount timer must include both.
    const timer = window.setTimeout(
      () => onDoneRef.current(),
      ghost.delayMs + EXIT_DURATION_MS + 50,
    );
    // Two RAFs gives the start frame a chance to paint before we kick the
    // transition off — otherwise the browser may collapse the two states
    // and skip the animation. The CSS transition-delay (set inline below)
    // handles the per-card stagger relative to that paint.
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMoving(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      if (r2) cancelAnimationFrame(r2);
      clearTimeout(timer);
    };
    // Mount-only — onDone is read via the ref so it doesn't need to be a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = ghost.card;
  const retained = ghost.retained || card.retain === true;
  const cls = [styles.card, styles.ghost, moving && styles.ghostMoving, retained && styles.retained]
    .filter(Boolean)
    .join(" ");
  const style: React.CSSProperties = {
    left: ghost.startRect.left,
    top: ghost.startRect.top,
    width: ghost.startRect.width,
    height: ghost.startRect.height,
    transform: moving && !ghost.fadeOnly ? ghost.endTransform : "none",
    // transform + opacity transitions are declared on `.card.ghost`; the
    // delay (one value per property) staggers each ghost's launch.
    transitionDelay: `${ghost.delayMs}ms, ${ghost.delayMs}ms`,
  };

  return (
    <div className={cls} style={style}>
      <span className={styles.cost}>{card.cost}</span>
      <span className={styles.name}>{card.name}</span>
      <span className={styles.archetype}>{card.archetype}</span>
      <CardKeywords card={card} retained={retained} />
      <span className={styles.description}>{card.description}</span>
    </div>
  );
}
