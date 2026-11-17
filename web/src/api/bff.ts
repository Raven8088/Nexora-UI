import { json, send } from './http';

export interface Permissions {
  chat: boolean;
  catalogRead: boolean;
  proposalWrite: boolean;
  approve: boolean;
  audit: boolean;
  diagnostics: boolean;
}

export interface SourceView {
  alias: string;
  label: string;
  dataSourceId: string;
}

export interface SessionView {
  name: string;
  username?: string | null;
  /**
   * The token subject: the identifier Semantic records as author, editor, approver and audit actor. Only used to
   * recognise the user's own changes (self-approval notice, «you» in histories); never displayed, never a permission.
   */
  subject?: string | null;
  tenant?: string | null;
  roles: string[];
  permissions: Permissions;
  sources: SourceView[];
}

export const LOGIN_URL = '/oauth2/authorization/keycloak';

export async function fetchSession(): Promise<SessionView> {
  return (await json<SessionView>('/bff/session')).data;
}

/** Ends the console session; the browser then goes to the identity provider to end its session too. */
export async function logout(): Promise<string> {
  const response = await send('/bff/logout', { method: 'POST' });
  if (!response.ok) return '/';
  const body = (await response.json()) as { logoutUrl?: string };
  return body.logoutUrl ?? '/';
}
