import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { Box, Button, Stack, Typography } from '@mui/material';

interface PlannerSandboxBarProps {
  targetPct: number;
  horizonMonths: number;
  hasAcceptedSnapshot: boolean;
  onDiscard: () => void;
  onCommitSession: () => void;
  onExportCsv: () => void;
}

/**
 * Datadog-style sticky draft bar — session Commit + Export; no DB write-back.
 * Height ~44px, amber treatment. Shown only when isDirty.
 */
export function PlannerSandboxBar({
  targetPct,
  horizonMonths,
  hasAcceptedSnapshot,
  onDiscard,
  onCommitSession,
  onExportCsv,
}: PlannerSandboxBarProps) {
  return (
    <Box
      role="status"
      data-testid="planner-sandbox-bar"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
        px: 1.5,
        py: 0.75,
        bgcolor: 'rgba(237, 108, 2, 0.10)',
        borderBottom: 1,
        borderColor: 'rgba(237, 108, 2, 0.20)',
        color: 'warning.dark',
      }}
    >
      <Typography variant="body2" sx={{ flex: 1, minWidth: 200, fontWeight: 600 }}>
        Draft Scenario (Unsaved)
        <Typography component="span" variant="body2" sx={{ fontWeight: 400, ml: 0.75 }}>
          Target {targetPct.toFixed(1)}% · {horizonMonths} mo
          {hasAcceptedSnapshot ? ' · differs from accepted' : ' · no accepted snapshot yet'}
          {' · '}
          session only (no DB)
        </Typography>
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Button color="inherit" size="small" onClick={onDiscard}>
          Discard Draft
        </Button>
        <Button color="warning" size="small" variant="contained" onClick={onCommitSession}>
          Commit to Session
        </Button>
        <Button
          color="inherit"
          size="small"
          variant="outlined"
          startIcon={<DownloadRoundedIcon />}
          onClick={onExportCsv}
        >
          Export CSV
        </Button>
      </Stack>
    </Box>
  );
}
