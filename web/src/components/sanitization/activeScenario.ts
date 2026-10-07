/** Session label for which question/path produced the current canvas result. */

import type { MessageKey } from '../../i18n';
import type { SanitizationScenarioPackId } from '../../schemas/sanitizationScenarioPacks';

export type ActiveScenario =
  | { kind: 'pack'; id: SanitizationScenarioPackId }
  | { kind: 'manual' };

const PACK_SCENARIO_KEYS: Record<SanitizationScenarioPackId, MessageKey> = {
  standard_spec: 'sanitization.answer.standard',
  with_store_month: 'sanitization.answer.withStoreMonth',
  core_only: 'sanitization.answer.coreOnly',
};

export function activeScenarioLabelKey(scenario: ActiveScenario): MessageKey {
  if (scenario.kind === 'pack') {
    return PACK_SCENARIO_KEYS[scenario.id];
  }
  return 'sanitization.answer.manual';
}
