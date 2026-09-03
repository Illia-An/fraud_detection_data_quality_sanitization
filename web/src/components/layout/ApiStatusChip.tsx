import { Chip } from '@mui/material';

import { useHealth } from '../../api/hooks';

export function ApiStatusChip() {
  const { data, isLoading, isError } = useHealth();

  if (isLoading) {
    return <Chip label="API: checking…" size="small" variant="outlined" />;
  }

  if (isError || !data) {
    return <Chip label="API: offline" size="small" color="error" variant="outlined" />;
  }

  return (
    <Chip
      label={`API: ${data.status}`}
      size="small"
      color={data.status === 'ok' ? 'success' : 'warning'}
      variant={data.status === 'ok' ? 'filled' : 'outlined'}
    />
  );
}
