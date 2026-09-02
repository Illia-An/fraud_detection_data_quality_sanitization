import { Typography } from '@mui/material';

import { HowItWorksCard } from '../components/HowItWorksCard';

export function SanitizationPage() {
  return (
    <>
      <HowItWorksCard />
      <Typography variant="body2" color="text.secondary">
        Pipeline controls and results will appear here in upcoming phases.
      </Typography>
    </>
  );
}
