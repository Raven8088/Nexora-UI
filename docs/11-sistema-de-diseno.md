# 11. Sistema de diseño

Colores oficiales (blanco y burdeos), definidos **solo** en `web/src/app/theme/tokens.ts`:

| Token | Valor | Uso |
|---|---|---|
| Burdeos principal | `#800020` | Barra lateral, botones primarios, selección, acentos |
| Burdeos oscuro | `#5C0018` | Elemento activo de la barra lateral, hover |
| Burdeos claro | `#A63A56` | Primario del tema oscuro, burbuja del usuario (oscuro) |
| Blanco | `#FFFFFF` | Área principal, tarjetas, formularios, texto sobre burdeos |
| Fondo secundario | `#F8F6F7` | Superficies alternativas, burbuja de Nexora |
| Texto secundario | `#667085` | Descripciones y metadatos |

Además: escala de 10 tonos `nexora` para Mantine (índice 6 = `#800020`), tokens semánticos por esquema claro/oscuro
(`--nexora-sidebar-bg`, `--nexora-surface`, `--nexora-accent`, `--nexora-status-draft-*`, …) generados como
variables CSS por `cssVariablesResolver`.

Reglas:

- Los componentes usan `color="nexora"` o `var(--nexora-*)`; **nunca** hexadecimales ni `rgb()` (lo comprueba
  `noHardcodedColors.test.ts`).
- Contraste WCAG AA ≥ 4.5:1 en todos los pares de texto (lo comprueba `contrast.test.ts`); foco visible burdeos.
- El color «dimmed» de Mantine (textos de ayuda de campos, casillas e interruptores) es `var(--nexora-text-secondary)`
  en ambos temas (B3: el valor por defecto de Mantine no alcanzaba AA según axe).
- Estados del ciclo de vida: Aprobada = burdeos relleno; Borrador = ámbar legible; Inactiva = neutro.
- Acciones de retirada o rechazo: botón con contorno burdeos (sin rojo de bajo contraste) y confirmación con motivo.

## Pantalla de inicio de sesión de Keycloak (DEC-FE-LOGIN-1)

El tema `nexora-login` de Keycloak (`nexora-deploy/keycloak/themes/nexora-login`) **copia** los colores de
`web/src/app/theme/tokens.ts` y la marca de `web/public/favicon.svg`. No puede importarlos: Keycloak sirve el tema por su
cuenta. Si cambian los tokens o la marca, hay que actualizar también el tema y subir su versión (regla en
`nexora-deploy/keycloak/themes/README.md`).
