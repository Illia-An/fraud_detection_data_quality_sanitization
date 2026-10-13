import type { OnboardingAnchorId } from './tourConfig';

export function onboardingSelector(anchor: OnboardingAnchorId): string {
  return `[data-onboarding="${anchor}"]`;
}

export function queryOnboardingTarget(
  anchor: OnboardingAnchorId,
  root: ParentNode = document,
): HTMLElement | null {
  return root.querySelector<HTMLElement>(onboardingSelector(anchor));
}

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export function readTargetRect(el: HTMLElement): TargetRect {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    right: rect.right,
  };
}

function rectArea(rect: Pick<DOMRect, 'width' | 'height'>): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function intersectsViewport(rect: DOMRect): boolean {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw;
}

/** Hidden via CSS / aria — not a scroll-into-view candidate (e.g. closed mobile drawer). */
export function isDomRenderable(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) {
    return false;
  }

  let node: HTMLElement | null = el;
  while (node) {
    if (node.getAttribute('aria-hidden') === 'true' || node.hasAttribute('hidden')) {
      return false;
    }
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    node = node.parentElement;
  }

  return true;
}

/**
 * True when the node is painted on-screen and not inside a hidden / aria-hidden tree
 * (e.g. closed MUI temporary Drawer still mounted with non-zero layout box).
 */
export function isEffectivelyVisible(el: HTMLElement): boolean {
  if (!isDomRenderable(el)) {
    return false;
  }
  return intersectsViewport(el.getBoundingClientRect());
}

function pickPreferredTarget(nodes: HTMLElement[]): HTMLElement | null {
  if (nodes.length === 0) {
    return null;
  }

  const desktop = nodes.find(
    (node) => node.getAttribute('data-onboarding-surface') === 'desktop',
  );
  if (desktop) {
    return desktop;
  }

  return nodes.reduce((best, node) => {
    const bestRect = best.getBoundingClientRect();
    const nextRect = node.getBoundingClientRect();
    return rectArea(nextRect) > rectArea(bestRect) ? node : best;
  });
}

/**
 * Prefer a truly visible target when duplicates exist (desktop + mobile nav).
 * Prefers `data-onboarding-surface="desktop"`, then the largest on-screen rect.
 */
export function queryVisibleOnboardingTarget(
  anchor: OnboardingAnchorId,
  root: ParentNode = document,
): HTMLElement | null {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(onboardingSelector(anchor)));
  return pickPreferredTarget(nodes.filter(isEffectivelyVisible));
}

/**
 * Target that exists in the layout tree but may be scrolled out of view.
 * Used to scrollIntoView before requiring viewport intersection.
 */
export function queryScrollableOnboardingTarget(
  anchor: OnboardingAnchorId,
  root: ParentNode = document,
): HTMLElement | null {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(onboardingSelector(anchor)));
  return pickPreferredTarget(nodes.filter(isDomRenderable));
}

/** Visible first; otherwise any renderable (off-screen) candidate to scroll into place. */
export function queryOnboardingTargetForTour(
  anchor: OnboardingAnchorId,
  root: ParentNode = document,
): HTMLElement | null {
  return (
    queryVisibleOnboardingTarget(anchor, root) ?? queryScrollableOnboardingTarget(anchor, root)
  );
}
