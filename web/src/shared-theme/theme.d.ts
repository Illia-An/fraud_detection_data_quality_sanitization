import 'react';

declare module '@mui/material/styles' {
  interface Theme {
    vars?: Record<string, unknown>;
  }
}
