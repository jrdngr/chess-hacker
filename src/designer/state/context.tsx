import type { ReactNode } from "react";

import { useDesignerStore } from "./store";
import { StoreContext } from "./storeContext";

export function DesignerStoreProvider({ children }: { children: ReactNode }) {
  const api = useDesignerStore();
  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}
