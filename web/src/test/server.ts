import { setupServer } from 'msw/node';
import { sessionHandler } from './fixtures';

/** MSW server for automated tests only: every response is synthetic (D11). */
export const server = setupServer(sessionHandler());
