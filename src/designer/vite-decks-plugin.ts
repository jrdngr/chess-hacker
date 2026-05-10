import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

/**
 * Designer-only Vite middleware. Exposes:
 *
 *   POST /__designer/decks   — body: { name, deck }
 *
 * where `deck` matches the existing `DeckJson` shape
 * (`{ name, description?, cards: [{ id, count }] }`). Writes the JSON to
 * `src/game/cards/decks/named/<slug>.json`. The slug is the deck name
 * lowercased, with non-alphanumerics collapsed to `-`.
 *
 * The plugin is registered ONLY in `vite.designer.config.ts`, so the game's
 * dev server has no write endpoint.
 */
export function decksWriter(): Plugin {
  return {
    name: "chess-hacker-designer-decks-writer",
    configureServer(server) {
      server.middlewares.use("/__designer/decks", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body) as { name?: unknown; deck?: unknown };
            if (typeof parsed.name !== "string" || parsed.name.trim().length === 0) {
              respond(res, 400, { ok: false, error: "missing or empty 'name'" });
              return;
            }
            const deck = parsed.deck;
            if (
              typeof deck !== "object" ||
              deck === null ||
              !Array.isArray((deck as { cards?: unknown }).cards)
            ) {
              respond(res, 400, { ok: false, error: "'deck' must be a DeckJson object" });
              return;
            }
            const slug = parsed.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");
            if (slug.length === 0) {
              respond(res, 400, { ok: false, error: "name has no alphanumeric characters" });
              return;
            }
            const here = dirname(fileURLToPath(import.meta.url));
            const outDir = resolve(here, "..", "game", "cards", "decks", "named");
            mkdirSync(outDir, { recursive: true });
            const outPath = resolve(outDir, `${slug}.json`);
            writeFileSync(outPath, JSON.stringify(deck, null, 2) + "\n", "utf8");
            respond(res, 200, {
              ok: true,
              path: `src/game/cards/decks/named/${slug}.json`,
            });
          } catch (err) {
            respond(res, 400, {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        });
      });
    },
  };
}

function respond(
  res: { setHeader: (k: string, v: string) => void; statusCode: number; end: (s: string) => void },
  status: number,
  body: unknown,
): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}
