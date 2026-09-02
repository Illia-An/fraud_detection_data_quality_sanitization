import { useState } from 'react';

import { ConfigForm } from '../components/ConfigForm';
import { HowItWorksCard } from '../components/HowItWorksCard';
import { PipelineRunPanel } from '../components/PipelineRunPanel';
import { SampleDataPanel } from '../components/SampleDataPanel';
import { defaultPipelineConfig, type PipelineConfig } from '../schemas/api';

export function SanitizationPage() {
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>(defaultPipelineConfig);

  return (
    <>
      <HowItWorksCard />
      <SampleDataPanel />
      <ConfigForm onValidConfigChange={setPipelineConfig} />
      <PipelineRunPanel config={pipelineConfig} />
    </>
  );
}
