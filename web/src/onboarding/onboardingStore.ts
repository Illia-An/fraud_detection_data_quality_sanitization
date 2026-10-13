import { create } from 'zustand';
import { z } from 'zod';

import { trackOnboarding } from './analytics';
import {
  nextEligibleStepId,
  prevEligibleStepId,
  type OnboardingProductState,
} from './eligibility';
import {
  ONBOARDING_TOUR_ID,
  ONBOARDING_TOUR_VERSION,
  TOUR_STEPS,
  type OnboardingStepId,
} from './tourConfig';

export const ONBOARDING_STORAGE_KEY = 'fraud-guard-onboarding-v1';

const statusSchema = z.enum(['idle', 'active', 'completed', 'dismissed']);

const persistedSchema = z.object({
  tourId: z.string(),
  version: z.number().int().positive(),
  status: statusSchema,
  stepId: z.string().nullable(),
  completedStepIds: z.array(z.string()),
  updatedAt: z.string(),
});

export type OnboardingStatus = z.infer<typeof statusSchema>;

interface PersistedOnboarding {
  tourId: string;
  version: number;
  status: OnboardingStatus;
  stepId: string | null;
  completedStepIds: string[];
  updatedAt: string;
}

function defaultPersisted(): PersistedOnboarding {
  return {
    tourId: ONBOARDING_TOUR_ID,
    version: ONBOARDING_TOUR_VERSION,
    status: 'idle',
    stepId: null,
    completedStepIds: [],
    updatedAt: new Date(0).toISOString(),
  };
}

function readLocalJson(key: string): unknown | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null || raw === '') {
      return null;
    }
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

function removeLocalKey(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function loadOnboardingPersisted(): PersistedOnboarding {
  const raw = readLocalJson(ONBOARDING_STORAGE_KEY);
  if (raw == null) {
    return defaultPersisted();
  }
  const parsed = persistedSchema.safeParse(raw);
  if (!parsed.success) {
    removeLocalKey(ONBOARDING_STORAGE_KEY);
    return defaultPersisted();
  }
  if (
    parsed.data.tourId !== ONBOARDING_TOUR_ID ||
    parsed.data.version !== ONBOARDING_TOUR_VERSION
  ) {
    // Schema / tour version change — reset so users are not stuck on obsolete steps.
    removeLocalKey(ONBOARDING_STORAGE_KEY);
    return defaultPersisted();
  }
  return parsed.data;
}

interface OnboardingState {
  status: OnboardingStatus;
  stepId: OnboardingStepId | null;
  completedStepIds: string[];
  /** True after host mounts and decides auto-start / resume. */
  bootstrapped: boolean;
  start: (product: OnboardingProductState) => void;
  restart: (product: OnboardingProductState) => void;
  next: (product: OnboardingProductState) => void;
  back: (product: OnboardingProductState) => void;
  dismiss: () => void;
  complete: () => void;
  bootstrap: (product: OnboardingProductState) => void;
  markBootstrapped: () => void;
}

function persistSlice(state: {
  status: OnboardingStatus;
  stepId: string | null;
  completedStepIds: string[];
}): void {
  const slice: PersistedOnboarding = {
    tourId: ONBOARDING_TOUR_ID,
    version: ONBOARDING_TOUR_VERSION,
    status: state.status,
    stepId: state.stepId,
    completedStepIds: state.completedStepIds,
    updatedAt: new Date().toISOString(),
  };
  writeLocalJson(ONBOARDING_STORAGE_KEY, slice);
}

const hydrated = loadOnboardingPersisted();

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  status: hydrated.status,
  stepId: (hydrated.stepId as OnboardingStepId | null) ?? null,
  completedStepIds: hydrated.completedStepIds,
  bootstrapped: false,

  markBootstrapped: () => set({ bootstrapped: true }),

  bootstrap: (product) => {
    const { status, stepId, bootstrapped } = get();
    if (bootstrapped) {
      return;
    }
    if (status === 'idle') {
      get().start(product);
      set({ bootstrapped: true });
      return;
    }
    if (status === 'active' && stepId != null) {
      trackOnboarding('onboarding_step_viewed', {
        tourId: ONBOARDING_TOUR_ID,
        version: ONBOARDING_TOUR_VERSION,
        stepId,
        resumed: true,
      });
    }
    set({ bootstrapped: true });
  },

  start: (product) => {
    const firstId = nextEligibleStepId(TOUR_STEPS, null, product) as OnboardingStepId | null;
    const nextState = {
      status: 'active' as const,
      stepId: firstId,
      completedStepIds: [] as string[],
    };
    set(nextState);
    persistSlice(nextState);
    trackOnboarding('onboarding_started', {
      tourId: ONBOARDING_TOUR_ID,
      version: ONBOARDING_TOUR_VERSION,
      stepId: firstId ?? undefined,
    });
    if (firstId) {
      trackOnboarding('onboarding_step_viewed', {
        tourId: ONBOARDING_TOUR_ID,
        version: ONBOARDING_TOUR_VERSION,
        stepId: firstId,
      });
    }
  },

  restart: (product) => {
    get().start(product);
  },

  next: (product) => {
    const { stepId, completedStepIds, status } = get();
    if (status !== 'active' || stepId == null) {
      return;
    }
    trackOnboarding('onboarding_step_completed', {
      tourId: ONBOARDING_TOUR_ID,
      version: ONBOARDING_TOUR_VERSION,
      stepId,
    });
    if (stepId === 'complete') {
      get().complete();
      return;
    }
    const acknowledged = completedStepIds.includes(stepId)
      ? completedStepIds
      : [...completedStepIds, stepId];
    const nextId = nextEligibleStepId(TOUR_STEPS, stepId, product) as OnboardingStepId | null;
    if (nextId == null) {
      get().complete();
      return;
    }
    const nextState = {
      status: 'active' as const,
      stepId: nextId,
      completedStepIds: acknowledged,
    };
    set(nextState);
    persistSlice(nextState);
    trackOnboarding('onboarding_step_viewed', {
      tourId: ONBOARDING_TOUR_ID,
      version: ONBOARDING_TOUR_VERSION,
      stepId: nextId,
    });
  },

  back: (product) => {
    const { stepId, status, completedStepIds } = get();
    if (status !== 'active' || stepId == null) {
      return;
    }
    const prevId = prevEligibleStepId(TOUR_STEPS, stepId, product) as OnboardingStepId | null;
    if (prevId == null) {
      return;
    }
    const nextState = {
      status: 'active' as const,
      stepId: prevId,
      completedStepIds,
    };
    set(nextState);
    persistSlice(nextState);
    trackOnboarding('onboarding_step_viewed', {
      tourId: ONBOARDING_TOUR_ID,
      version: ONBOARDING_TOUR_VERSION,
      stepId: prevId,
    });
  },

  dismiss: () => {
    const { stepId } = get();
    const nextState = {
      status: 'dismissed' as const,
      stepId: null as OnboardingStepId | null,
      completedStepIds: get().completedStepIds,
    };
    set(nextState);
    persistSlice(nextState);
    trackOnboarding('onboarding_dismissed', {
      tourId: ONBOARDING_TOUR_ID,
      version: ONBOARDING_TOUR_VERSION,
      stepId: stepId ?? undefined,
    });
  },

  complete: () => {
    const nextState = {
      status: 'completed' as const,
      stepId: null as OnboardingStepId | null,
      completedStepIds: get().completedStepIds,
    };
    set(nextState);
    persistSlice(nextState);
    trackOnboarding('onboarding_completed', {
      tourId: ONBOARDING_TOUR_ID,
      version: ONBOARDING_TOUR_VERSION,
    });
  },
}));

/** Test helper — clear store + storage. */
export function resetOnboardingStoreForTests(): void {
  removeLocalKey(ONBOARDING_STORAGE_KEY);
  useOnboardingStore.setState({
    status: 'idle',
    stepId: null,
    completedStepIds: [],
    bootstrapped: false,
  });
}
