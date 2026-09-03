import { useState } from 'react';

import { ConfigForm } from '../components/ConfigForm';
import { HowItWorksCard } from '../components/HowItWorksCard';
import { PipelineRunPanel } from '../components/PipelineRunPanel';
import { SampleDataPanel } from '../components/SampleDataPanel';
import { defaultPipelineConfig, type PipelineConfig } from '../schemas/api';
import Grid from '@mui/material/Grid2';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

export function SanitizationPage() {
  const [pipelineConfig, setPipelineConfig] = useState<PipelineConfig>(defaultPipelineConfig);

  return (
    <>
      <HowItWorksCard />
      <Grid container spacing={3}>

        <Grid size={{ xs: 12, md: 4 }}>
          <Box
            sx={{
              position: { xs: 'static', md: 'sticky' },
              top: { md: 24 },
              alignSelf: 'flex-start',
              overflow: { md: 'auto' },
            }}
          >
            <Stack spacing={2}>
              <SampleDataPanel />
              <ConfigForm onValidConfigChange={setPipelineConfig} />
            </Stack>
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <PipelineRunPanel config={pipelineConfig} />
        </Grid>
      </Grid>
    </>
  );
}
