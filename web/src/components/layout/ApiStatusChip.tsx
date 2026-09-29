import { Chip } from '@mui/material';

import { useHealth } from '../../api/hooks';
import { useT } from '../../i18n';

export function ApiStatusChip() {
  const t = useT();
  const { data, isLoading, isError } = useHealth();

  if (isLoading) {
    return <Chip label={t('api.checking')} size="small" variant="outlined" />;
  }

  if (isError || !data) {
    return <Chip label={t('api.offline')} size="small" color="error" variant="outlined" />;
  }

  return (
    <Chip
      label={t('api.status', { status: data.status })}
      size="small"
      color={data.status === 'ok' ? 'success' : 'warning'}
      variant={data.status === 'ok' ? 'filled' : 'outlined'}
    />
  );
}
