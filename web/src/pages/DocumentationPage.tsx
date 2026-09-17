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
    <Stack
      spacing={3}
      sx={{
        height: { xs: 'auto', md: '100%' },
        overflow: { xs: 'visible', md: 'auto' },
        minHeight: 0,
        pb: 2,
      }}
    >
      <Card>
        <CardHeader title="Overview" subheader="Survey sanitization PoC" />
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="body1">
            This UI is a what-if demo for the batch data-quality pipeline. It estimates how the{' '}
            <strong>5% KPI</strong> (share of top-box scores on question Q10012) changes when
            suspicious survey answers are removed.
          </Typography>
          <Typography variant="body1">
            Use the <strong>Sanitization</strong> page to review Q10012 from 2026-01-01 through
            latest (synthetic presets if the DB is unavailable), enable/disable each tier, tune
            thresholds, and inspect KPI, chart, and flagged store×month cells.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Pipeline tiers"
          subheader="Four independent filters — toggle each and re-run to see cumulative impact"
        />
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>Tier 1 — BlackList</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                Keep regular customers only (`BlackList == לא`). Staff / non-customer segments are
                excluded.
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>Tier 2 — Frequency</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                High frequency on entity×store×day (same person answering too often at the same
                store on the same day). Threshold defaults to ≥ 3.
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>Tier 3 — Always top-box (optional)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                Entities with enough history that are 100% top-box (Answer_Value = 5). Off by
                default — enable for a stricter what-if.
              </Typography>
            </AccordionDetails>
          </Accordion>
          <Accordion disableGutters sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography fontWeight={600}>Tier 4 — Store×month outliers</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>
                Flags store×month cells with unusually high 5% vs the network (z-score and/or five %
                floor, with a minimum volume). Flagged cells appear in the results table after a
                run.
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
              <code>docs/report_tier1.md</code> — respondent-quality rules (now Tiers 1–3)
            </Typography>
            <Typography component="li" variant="body2">
              <code>docs/report_tier2.md</code> — store×month outliers (now Tier 4)
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
