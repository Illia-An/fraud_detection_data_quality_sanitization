import { describe, expect, it } from 'vitest';

import { activeScenarioLabelKey } from './activeScenario';

describe('activeScenarioLabelKey', () => {
  it('maps pack and manual scenarios to i18n keys', () => {
    expect(activeScenarioLabelKey({ kind: 'pack', id: 'standard_spec' })).toBe(
      'sanitization.answer.standard',
    );
    expect(activeScenarioLabelKey({ kind: 'pack', id: 'with_store_month' })).toBe(
      'sanitization.answer.withStoreMonth',
    );
    expect(activeScenarioLabelKey({ kind: 'pack', id: 'core_only' })).toBe(
      'sanitization.answer.coreOnly',
    );
    expect(activeScenarioLabelKey({ kind: 'manual' })).toBe('sanitization.answer.manual');
  });
});
