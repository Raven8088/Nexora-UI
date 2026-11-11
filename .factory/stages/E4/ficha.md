# Ficha de etapa E4 · Autenticación con Keycloak

## Objetivo
Nadie ve la aplicación sin sesión de Keycloak, y las peticiones a las API de Nexora llevan el token del usuario (D-003).

## Alcance
- Arranque con keycloak-js (login-required, PKCE) en main.ts.
- Página estática «servicio de acceso no disponible».
- shared/auth: Session, permission.guard y el interceptor limitado a environment.apis.
- Menú de usuario con «Cerrar sesión».
- Tratamiento de 401.
- Un inquilino por sesión (respuesta del responsable).

## Fuera de alcance
- Configuración del realm en Keycloak: el alta del cliente nexora-ui y de los datos de los tokens la hace el responsable antes de esta etapa.
- Permisos por acción dentro de los módulos.

## Prioridades
- Respetar las decisiones aprobadas D-001 a D-006 y las enmiendas que indica esta ficha.
- Corrección comprobada con pruebas antes que rapidez.
- Simplicidad: nada que esta etapa no necesite.

## Criterios de aceptación
- [ ] Sin sesión, ninguna ruta renderiza componentes de la aplicación; el navegador acaba en la URL de autorización de Keycloak con code_challenge_method=S256. Se prueba con un keycloak-js sustituido en las pruebas.
- [ ] El interceptor añade Authorization solo a URL bajo environment.apis.*.baseUrl; una prueba lo verifica con una URL externa.
- [ ] Ningún archivo del repositorio guarda tokens en localStorage o sessionStorage ni contiene secretos; lo comprueba una búsqueda en la revisión.
- [ ] El guard redirige a /sin-permiso cuando falta el permiso; probado.
- [ ] Con Keycloak caído aparece la página estática con «Reintentar».

## Decisiones vigentes que aplican
D-001 a D-006 de E1, en .factory/decisions/.
