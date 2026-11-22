import SendRoundedIcon from '@mui/icons-material/SendRounded';
import {
  Box,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState, type FormEvent, type KeyboardEvent } from 'react';

import { useT } from '../../i18n';

interface ChatLine {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Placeholder AI chat for the At-risk screen.
 * Local transcript only — swap `onSend` / reply for a real model later.
 */
export function AtRiskAiChatPanel() {
  const t = useT();
  const [draft, setDraft] = useState('');
  const [lines, setLines] = useState<ChatLine[]>([]);

  const submit = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    const userLine: ChatLine = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };
    const assistantLine: ChatLine = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      text: t('planner.atRisk.chat.stubReply'),
    };
    setLines((prev) => [...prev, userLine, assistantLine]);
    setDraft('');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <Box
      data-testid="atrisk-ai-chat-panel"
      sx={{
        flex: '1 1 50%',
        minWidth: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Typography
        variant="caption"
        fontWeight={700}
        color="text.secondary"
        sx={{ px: 1.25, py: 0.5, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}
      >
        {t('planner.atRisk.chat.title')}
      </Typography>

      <Box
        data-testid="atrisk-ai-chat-transcript"
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: 1.25,
          py: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {lines.length === 0 ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ m: 'auto', textAlign: 'center', px: 1, maxWidth: 280 }}
          >
            {t('planner.atRisk.chat.empty')}
          </Typography>
        ) : (
          lines.map((line) => (
            <Box
              key={line.id}
              data-testid={`atrisk-ai-chat-${line.role}`}
              sx={{
                alignSelf: line.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                px: 1,
                py: 0.75,
                borderRadius: 1,
                bgcolor: line.role === 'user' ? 'primary.main' : 'action.hover',
                color: line.role === 'user' ? 'primary.contrastText' : 'text.primary',
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
                {line.text}
              </Typography>
            </Box>
          ))
        )}
      </Box>

      <Box
        component="form"
        onSubmit={onSubmit}
        sx={{
          flexShrink: 0,
          borderTop: 1,
          borderColor: 'divider',
          px: 1,
          py: 0.75,
        }}
      >
        <Stack direction="row" spacing={0.5} alignItems="flex-end">
          <TextField
            size="small"
            fullWidth
            multiline
            maxRows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('planner.atRisk.chat.placeholder')}
            inputProps={{ 'aria-label': t('planner.atRisk.chat.placeholder') }}
            data-testid="atrisk-ai-chat-input"
          />
          <IconButton
            type="submit"
            color="primary"
            size="small"
            disabled={!draft.trim()}
            aria-label={t('planner.atRisk.chat.send')}
            data-testid="atrisk-ai-chat-send"
            sx={{ mb: 0.25 }}
          >
            <SendRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Box>
  );
}
