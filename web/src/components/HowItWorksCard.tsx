import { Card, CardContent, CardHeader, Typography } from '@mui/material';

export function HowItWorksCard() {
  return (
    <Card sx={{ mb: 3 }}>
      <CardHeader title="How it works" />
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
          <li>
            <strong>Tier 3</strong> — optional ML (IsolationForest) on entity behaviour.
          </li>
        </Typography>
        <Typography variant="body1">
          Load a <strong>synthetic preset</strong> (scenario-based fake data from research), adjust
          filters, then click <strong>Run pipeline</strong>. Pick a store in the chart to compare
          actual vs sanitized 5% by month.
        </Typography>
      </CardContent>
    </Card>
  );
}
