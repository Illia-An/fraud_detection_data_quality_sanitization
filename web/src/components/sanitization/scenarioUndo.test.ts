import { describe, expect, it } from 'vitest';

import { defaultPipelineConfig } from '../../schemas/api';
import { createScenarioUndoSnapshot } from './scenarioUndo';

describe('createScenarioUndoSnapshot', () => {
  it('copies config so later tier edits do not mutate the snapshot', () => {
    const config = { ...defaultPipelineConfig, tier4_enabled: true };
    const snap = createScenarioUndoSnapshot({
      processResult: null,
      activeScenario: { kind: 'pack', id: 'with_store_month' },
      config,
    });
    config.tier4_enabled = false;
    expect(snap.config.tier4_enabled).toBe(true);
    expect(snap.activeScenario).toEqual({ kind: 'pack', id: 'with_store_month' });
  });
});
