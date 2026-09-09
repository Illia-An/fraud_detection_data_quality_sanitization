import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Link,
  Stack,
  Typography,
} from '@mui/material';

import { API_BASE_URL } from '../api/config';

const API_DOCS_URL = `${API_BASE_URL}/docs`;

export function DocumentationPage() {
  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader title="Overview" subheader="Fraud Guard sanitization PoC" />
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="body1">
            This UI is a what-if demo for the batch data-quality pipeline. It estimates how the{' '}
            <strong>5% KPI</strong> (share of top-box scores on question Q10012) changes when
            suspicious survey answers are removed.
          </Typography>
          <Typography variant="body1">
            Use the <strong>Sanitization</strong> page to review Q10012 from 2026-01-01 through
            latest (synthetic presets if the DB is unavailable), tune tier thresholds, and
            inspect KPI, chart, and flagged store×month cells.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Pipeline tiers" subheader="Rules promoted from notebooks into fraud_guard" />
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>Tier 1 — deterministic filters</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography component="ul" sx={{ m: 0, pl: 2.5 }}>
                <li>BlackList filter — keep regular customers (`BlackList == לא`).</li>
                <li>Freq ≥ N per store×day — repeat answers from the same entity.</li>
                <li>Optional always top-box rule for long histories.</li>
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>Tier 2 — store×month outliers</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                Flags cells with unusually high 5% vs the network (z-score and minimum volume /
                five-percent thresholds). Flagged cells appear in the results table after a run.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Research reports" subheader="Markdown notes in the repo docs/ folder" />
        <CardContent>
          <Stack component="ul" spacing={1} sx={{ m: 0, pl: 2.5 }}>
            <Typography component="li" variant="body2">
              <code>docs/report_exploration_00.md</code> — schema exploration
            </Typography>
            <Typography component="li" variant="body2">
              <code>docs/report_tier1.md</code> — Tier 1 rules and KPI impact
            </Typography>
            <Typography component="li" variant="body2">
              <code>docs/report_tier2.md</code> — store×month outliers
            </Typography>
            <Typography component="li" variant="body2">
              <code>docs/report_tier3.md</code> — IsolationForest research (not in PoC UI)
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="API & local setup" />
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Backend default: <code>{API_BASE_URL}</code> · UI dev server:{' '}
              <code>http://localhost:5173</code>
            </Typography>
            <Box>
              <Button
                component="a"
                href={API_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                endIcon={<OpenInNewRoundedIcon />}
              >
                Open FastAPI docs
              </Button>
            </Box>
            <Typography variant="body2">
              Repo README covers <code>uv run uvicorn backend.main:app --port 8001</code> and{' '}
              <code>npm run dev</code> in <code>web/</code>.
            </Typography>
            <Link href="https://mui.com/material-ui/getting-started/templates/dashboard/" target="_blank" rel="noopener noreferrer">
              MUI dashboard template reference
            </Link>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
