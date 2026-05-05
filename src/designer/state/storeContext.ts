import { createContext } from "react";

import type { useDesignerStore } from "./store";

export type StoreApi = ReturnType<typeof useDesignerStore>;

export const StoreContext = createContext<StoreApi | null>(null);
