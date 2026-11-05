// Move focus only after an explicit workflow transition or actionable feedback.
export function focusClientAction(element) {
  if (!element) return;
  element.focus({preventScroll: true});
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView?.({block: 'start', behavior: reduced ? 'instant' : 'smooth'});
}
