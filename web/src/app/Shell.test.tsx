import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { session, sessionHandler } from '@/test/fixtures';
import { renderConsole } from '@/test/render';
import { server } from '@/test/server';

describe('console frame and permissions', () => {
  it('shows only what the account may use; diagnostics are hidden without PLATFORM_ADMIN (D9)', async () => {
    server.use(
      sessionHandler(session({ roles: ['VIEWER'] }, { chat: false, proposalWrite: false, approve: false, audit: false, diagnostics: false })),
      http.get('/bff/api/semantic/data-sources/:ds/definitions', () => HttpResponse.json({ items: [], page: 0, size: 1, totalItems: 0 })),
    );
    renderConsole('/chat');
    expect(await screen.findByText('No tienes permiso para usar esta sección.')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(nav).toHaveTextContent('Diccionario semántico');
    expect(nav).not.toHaveTextContent('Chat de Nexora');
    expect(nav).not.toHaveTextContent('Sugerencias');
    expect(nav).not.toHaveTextContent('Administración');
    expect(screen.queryByText(/diagnóstico/i)).toBeNull();
  });

  it('asks to sign in when there is no session', async () => {
    server.use(http.get('/bff/session', () => new HttpResponse(null, { status: 401 })));
    renderConsole('/');
    expect(await screen.findByRole('link', { name: /Iniciar sesión/ })).toHaveAttribute('href', '/oauth2/authorization/keycloak');
  });
});

describe('session end', () => {
  it('a 401 after signing in shows the «session ended» page once, without looping', async () => {
    let calls = 0;
    server.use(
      http.get('/bff/api/semantic/data-sources/:ds/definitions', () => {
        calls += 1;
        return new HttpResponse(null, { status: 401 });
      }),
    );
    renderConsole('/diccionario');
    expect(await screen.findByText('Tu sesión terminó')).toBeInTheDocument();
    expect(calls).toBeLessThanOrEqual(2);
  });
});
