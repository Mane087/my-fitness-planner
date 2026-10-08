import { DestroyRef, inject, signal, type Signal } from '@angular/core';

/**
 * Signal that follows a CSS media query, for layouts that render a different template instead of
 * hiding one with CSS (so the page does not hold two copies of the same content). It must run in
 * an injection context. Without `matchMedia` (unit tests) it keeps `fallback`.
 */
export function injectMediaQuery(query: string, fallback: boolean): Signal<boolean> {
  const destroyRef = inject(DestroyRef);
  const list = typeof window !== 'undefined' ? window.matchMedia?.(query) : undefined;
  const matches = signal(list?.matches ?? fallback);

  if (list) {
    const onChange = (event: MediaQueryListEvent): void => matches.set(event.matches);
    list.addEventListener('change', onChange);
    destroyRef.onDestroy(() => list.removeEventListener('change', onChange));
  }

  return matches.asReadonly();
}
