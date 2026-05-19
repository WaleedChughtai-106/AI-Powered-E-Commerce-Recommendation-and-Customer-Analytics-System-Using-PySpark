import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — Shadcn UI's class merge helper.
 * Combines clsx (conditional classes) with tailwind-merge
 * (de-duplicates conflicting Tailwind utilities).
 *
 * Example:
 *   cn("p-2 bg-red-500", isActive && "bg-emerald-500")
 *   // → "p-2 bg-emerald-500"  (when isActive is true)
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
