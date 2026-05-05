import type { Artifact, BossDef, Card } from "../../game/types";

export type DesignerSource = "library" | "user";

/**
 * Where a "new" property value can sit. Limited on purpose: the designer
 * only annotates extension points the engine actually grows along, so
 * exports stay shaped predictably for the implementing agent.
 */
export type NewPropertyPath =
  | "card.archetype"
  | "card.target.kind"
  | "card.effect.kind"
  | "artifact.effect.kind"
  | "boss.modifier.kind";

export type NewPropertyPayloadField = {
  name: string;
  type: "string" | "number" | "boolean" | "string[]";
  description?: string;
};

export type NewPropertyAnnotation = {
  path: NewPropertyPath;
  /** The new identifier the user picked (the value of `kind`/`archetype`). */
  value: string;
  /** Free-text description for the implementing agent. */
  description: string;
  /** Optional payload schema the agent should wire up alongside the new kind. */
  payloadFields?: NewPropertyPayloadField[];
};

export type DesignerCardEntry = {
  data: Card;
  source: DesignerSource;
  modified: boolean;
  newProperties?: NewPropertyAnnotation[];
};

export type DesignerArtifactEntry = {
  data: Artifact;
  source: DesignerSource;
  modified: boolean;
  newProperties?: NewPropertyAnnotation[];
};

export type DesignerBossEntry = {
  data: BossDef;
  source: DesignerSource;
  modified: boolean;
  newProperties?: NewPropertyAnnotation[];
};

export type DesignerDeckEntry = {
  /** Deck name; doubles as the slug seed and identifier. */
  name: string;
  description?: string;
  cards: { id: string; count: number }[];
};

export type DesignerState = {
  version: 1;
  cards: Record<string, DesignerCardEntry>;
  artifacts: Record<string, DesignerArtifactEntry>;
  bosses: Record<string, DesignerBossEntry>;
  decks: Record<string, DesignerDeckEntry>;
};
