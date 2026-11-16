import { setupServer } from 'msw/node';

import { defaultHandlers } from './handlers';

/** Shared MSW server for unit tests — start/stop in the suite that needs it. */
export const mswServer = setupServer(...defaultHandlers);
