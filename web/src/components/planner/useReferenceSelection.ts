import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { pickReference, type PlannerReference } from './plannerShell';

interface ReferenceSelection {
  referenceYear: number | null;
  referenceMonth: number | null;
  setReferenceYear: Dispatch<SetStateAction<number | null>>;
  setReferenceMonth: Dispatch<SetStateAction<number | null>>;
}

/**
 * Plan-controls reference month: keeps a valid selection, otherwise falls back to
 * the preferred month or the latest one (see `pickReference`).
 *
 * @param refs available reference months of the loaded panel
 * @param initial starting selection (`null` = wait for the panel)
 */
export function useReferenceSelection(
  refs: readonly PlannerReference[],
  initial: PlannerReference | null = null,
): ReferenceSelection {
  const [referenceYear, setReferenceYear] = useState<number | null>(initial?.year ?? null);
  const [referenceMonth, setReferenceMonth] = useState<number | null>(initial?.month ?? null);

  useEffect(() => {
    const next = pickReference(refs, referenceYear, referenceMonth);
    if (next == null || (next.year === referenceYear && next.month === referenceMonth)) {
      return;
    }
    setReferenceYear(next.year);
    setReferenceMonth(next.month);
  }, [refs, referenceYear, referenceMonth]);

  return { referenceYear, referenceMonth, setReferenceYear, setReferenceMonth };
}
