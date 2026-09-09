import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export function HowItWorksCard() {
  return (
    <Accordion disableGutters sx={{ mb: 2, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" fontWeight={600}>
          How it works ? 🤔
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant="body1">
          This tool estimates how the <strong>5% KPI</strong> (share of top-box scores) changes when
          suspicious survey answers are removed.
        </Typography>
        <Typography component="ul" sx={{ m: 0, pl: 2.5 }}>
          <li>
            <strong>Tier 1</strong> — staff/non-customer rows and repeat answers (same person, same
            store, same day).
          </li>
          <li>
            <strong>Tier 2</strong> — store×month cells with unusually high scores vs the network.
          </li>
        </Typography>
        <Typography variant="body1">
          On start the tool loads <strong>Q10012 from 2026-01-01 through latest</strong> and
          runs Tier 1/2. If the database is unavailable, it falls back to a{' '}
          <strong>synthetic preset</strong>. Adjust filters and click <strong>Run pipeline</strong>{' '}
          again to recompute. Pick a store in the chart to compare actual vs sanitized 5% by month.
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}
