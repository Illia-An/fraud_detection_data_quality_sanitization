/** One-level undo for the last canvas scenario (pack / manual run). */

import type { PipelineConfig, ProcessResponse } from '../../schemas/api';
import type { ActiveScenario } from './activeScenario';

export interface ScenarioUndoSnapshot {
  processResult: ProcessResponse | null;
  activeScenario: ActiveScenario | null;
  config: PipelineConfig;
}

export function createScenarioUndoSnapshot(input: {
  processResult: ProcessResponse | null;
  activeScenario: ActiveScenario | null;
  config: PipelineConfig;
}): ScenarioUndoSnapshot {
  return {
    processResult: input.processResult,
    activeScenario: input.activeScenario,
    config: { ...input.config },
  };
}
