/** Ephemeral Planner runtime (not session-persisted) — shared with store Inspect page. */

import { create } from 'zustand';

import type { ImpliedAdjustment } from '../components/planner/impliedAdjustments';
import type { SimulationResponse } from '../schemas/cumulativePlan';
import { DEFAULT_PLAN_PARAMS } from '../schemas/plan';

interface PlannerRuntimeState {
  slopeSimulation: SimulationResponse | null;
  maxMonthlyImprove: number;
  impliedAdjustments: ImpliedAdjustment[];
  setSlopeSimulation: (sim: SimulationResponse | null) => void;
  setMaxMonthlyImprove: (value: number) => void;
  setImpliedAdjustments: (next: ImpliedAdjustment[]) => void;
  clear: () => void;
}

export const usePlannerRuntimeStore = create<PlannerRuntimeState>((set) => ({
  slopeSimulation: null,
  maxMonthlyImprove: DEFAULT_PLAN_PARAMS.max_monthly_improve,
  impliedAdjustments: [],
  setSlopeSimulation: (sim) => set({ slopeSimulation: sim }),
  setMaxMonthlyImprove: (value) => set({ maxMonthlyImprove: value }),
  setImpliedAdjustments: (next) => set({ impliedAdjustments: next }),
  clear: () =>
    set({
      slopeSimulation: null,
      maxMonthlyImprove: DEFAULT_PLAN_PARAMS.max_monthly_improve,
      impliedAdjustments: [],
    }),
}));
