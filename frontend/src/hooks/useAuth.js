/**
 * Re-export so the hook can be imported from `@/hooks/useAuth`
 * (which matches the folder structure laid out in PHASE_1_ARCHITECTURE.md)
 * OR from `@/context/AuthContext` — both work, pick whichever reads better
 * at the call site.
 */
export { useAuth } from "@/context/AuthContext";
