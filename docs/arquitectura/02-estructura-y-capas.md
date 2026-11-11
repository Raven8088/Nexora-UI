# D-002 · Estructura de carpetas, capas y reglas de dependencia

> Fuente canónica: `.factory/decisions/E1-D-002.md`. Este documento es su transcripción literal y no se edita a mano: solo cambia con una decisión nueva.

**Etapa:** E1 · **Estado:** aprobada en la puerta «arquitectura» de E1, 2026-11-11, huella `88155078cf9020fc`

## Contexto
Los criterios de `.factory/criteria.md` que fijan esta decisión son:
- **Estructura:** organización por funcionalidades. Cada módulo tiene su propia presentación, aplicación y datos, y ningún módulo importa de otro salvo de la carpeta compartida.
- **Limpio:** las dependencias van en un solo sentido y se comprueban con una herramienta automática.
- **Componentes:** los componentes de presentación solo reciben datos y emiten eventos. Solo los contenedores acceden al estado.
- **Estado:** una fachada por módulo. Las pantallas no llaman a la API.
- **Escalable / Eficiente:** un módulo nuevo no modifica los existentes, y la carga inicial no incluye módulos sin abrir.

La tecnología es la de [D-001](./01-tecnologia.md) (Angular *standalone* y `eslint-plugin-boundaries`).

## Decisión

### Idioma
- Los identificadores, archivos y carpetas del código van **en inglés**, igual que el backend de Nexora y la API que consume.
- Todo texto visible para el usuario va **en español**.

### Árbol
```
src/
  main.ts                      arranque: inicia Keycloak (D-003) y después la aplicación
  styles.scss                  importa el tema (D-005); no lleva reglas de pantalla
  styles/                      _theme.scss, _tokens.scss (paleta, espaciado, tipografía)
  environments/                environment.ts, environment.development.ts (D-004)
  app/
    app.ts                     componente raíz: solo <router-outlet>
    app.config.ts              proveedores globales: router, HttpClient con interceptores, sesión
    app.routes.ts              rutas raíz: el shell y un loadChildren por módulo
    shell/                     marco de la aplicación: barra superior, menú lateral, menú de usuario,
                               páginas «sin permiso» y «servicio no disponible»
    shared/
      auth/                    sesión de Keycloak: Session, guard, interceptor (D-003)
      data/                    NexoraError, mapeo de problem+json, Page<T>, utilidades de URL de API (D-004)
      ui/                      componentes de presentación genéricos: page-header, loading-state,
                               error-state, empty-state, simulated-data-notice, confirm-dialog
      util/                    funciones puras sin dependencias de Angular
    features/
      <module>/                p. ej. rules, dictionary, test-chat
        <module>.routes.ts     ÚNICO punto de entrada del módulo; declara rutas y proveedores
        presentation/
          containers/          páginas: inyectan la fachada y pasan datos a los componentes
          components/          componentes de presentación: solo input()/output()
        application/
          <module>.models.ts   tipos del módulo (en el lenguaje de la interfaz, no DTO)
          <module>.repository.ts   clase abstracta: el contrato de datos del módulo
          <module>.facade.ts   única fachada: signals de solo lectura + métodos de caso de uso
        data/
          http-<module>.repository.ts       implementación real (HttpClient, DTO → modelo)
          simulated-<module>.repository.ts  implementación simulada en memoria
          <module>.dtos.ts                  formas JSON de la API de Nexora
```

### Capas y sentido de las dependencias
Dentro de cada módulo las dependencias van así (no se admite ninguna otra):

```
<module>.routes.ts ──▶ presentation ──▶ application ◀── data
         └──────────────────────────────────────────────▶ data (solo para elegir la implementación)
```

- `application` define el contrato (`<Module>Repository`, una clase abstracta) y la fachada. **No importa** de `presentation` ni de `data`.
- `data` implementa el contrato. Importa de `application` (modelos y contrato) y de `shared/data`.
- `presentation/containers` importa la fachada y los modelos de `application`, y los componentes de `presentation/components` y `shared/ui`.
- `presentation/components` solo importa **tipos** de `application` (`import type`) y componentes de `shared/ui`. No inyecta la fachada ni ningún servicio.
- `<module>.routes.ts` es la raíz de composición del módulo. Allí se registran, como `providers` de la ruta, la fachada y el repositorio elegido según `environment` ([D-004](./04-consumo-de-api.md)). Así la fachada y el repositorio solo existen mientras el módulo está cargado.

### Reglas entre carpetas de primer nivel
| Desde | Puede importar de |
|---|---|
| `app.*`, `shell/` | `shared/**` y `environments/`. Los módulos de `features/` solo se referencian con `import()` dinámico dentro de `loadChildren`. |
| `features/<m>/**` | Su propio módulo `<m>` (respetando las capas), `shared/**` y `environments/` (este último solo desde `<m>.routes.ts`). **Nunca** de otro `features/<x>`, ni de `shell/`, ni de `app.*`. |
| `shared/auth`, `shared/data` | `shared/util` y `environments/` |
| `shared/ui` | `shared/util`. No inyecta servicios. |
| `shared/util` | Nada del proyecto |
| `shared/**` | Nunca de `features/`, `shell/` ni `app.*` |

Si dos módulos llegan a necesitar lo mismo, eso se mueve a `shared/` con una decisión escrita. Mientras lo use un solo módulo, se queda dentro de ese módulo. Por ejemplo, el selector de fuente de datos vive en `dictionary` hasta que otro módulo lo necesite.

### Comprobación automática
Todo se comprueba con `ng lint` (ESLint, `--max-warnings=0`, [D-001](./01-tecnologia.md)):
1. **`eslint-plugin-boundaries`**:
   - Declara los tipos de elemento `app`, `shell`, `shared-auth`, `shared-data`, `shared-ui`, `shared-util`, `feature-routes`, `feature-containers`, `feature-components`, `feature-application` y `feature-data`. Los de *feature* capturan el nombre del módulo.
   - Con `boundaries/element-types` en modo `disallow` por defecto, permite solo las flechas de las tablas de arriba.
   - Exige que el módulo de origen sea igual al de destino (`${from.module}` = `${target.module}`) en las dependencias entre elementos de *feature*.
   - Restringe `feature-components → feature-application` a `importKind: "type"`.
   - Activa `boundaries/no-unknown-files`, para que ningún archivo quede fuera de la clasificación.
2. **`no-restricted-imports`** en `app.*` y `shell/**`: prohíbe las importaciones estáticas de `**/features/**`. Solo queda la vía `import()` de `loadChildren`, y así ningún módulo entra en la carga inicial.
3. **Presupuesto de compilación** en `angular.json`: el *bundle* inicial avisa a partir de 500 kB y falla a partir de 700 kB (sin comprimir). Si alguien rompe la carga bajo demanda, la compilación lo detecta.

E2 añade una prueba de la configuración: un archivo de ejemplo, fuera de `src/` y solo para el test, que importa de otro módulo, y la ejecución de ESLint sobre él debe fallar.

### Añadir un módulo nuevo
Se crea `features/<nuevo>/` con su `<nuevo>.routes.ts` y se añade **una línea** `loadChildren` en `app.routes.ts` y **una entrada** en el menú del shell. Ningún archivo de otro módulo cambia.

## Alternativas descartadas
- **Capas globales (`components/`, `services/`, `models/` en la raíz).** Incumple **Estructura**: un cambio en una función toca varias carpetas compartidas, y un módulo nuevo modifica archivos existentes (**Escalable**).
- **Un *monorepo* Nx con librerías por módulo y `@nx/enforce-module-boundaries`.** Las reglas de límites son sólidas, pero añade una herramienta de construcción entera, *workspace* y configuración por librería para una sola aplicación con tres módulos. Incumple **Simple** y **Eficiente**. Se puede reconsiderar si aparece una segunda aplicación.
- **Una cuarta capa `domain/` en cada módulo.** Las tres funciones son de administración: listar, editar y aprobar. La lógica que no está en el backend cabe en la fachada y en los modelos de `application`. Una capa más sería una capa que la etapa no necesita (**Simple**), y el criterio **Estructura** nombra solo tres.
- **Interfaces TypeScript (`interface`) como contrato del repositorio.** No existen en tiempo de ejecución, así que no sirven como *token* de inyección y obligarían a crear `InjectionToken` aparte. La clase abstracta es contrato y *token* a la vez.

## Consecuencias
- E2 deja configurados el *lint* de capas, su prueba y el presupuesto. Cualquier etapa que viole una flecha falla en `ng lint` o `ng build`.
- `shell/` es una carpeta propia y no un módulo de `features/`. Lo importa la raíz y no se carga bajo demanda, porque se ve siempre.
- `shared/` crece solo con decisión escrita, para que no acabe siendo un cajón de sastre.
- No cambia ninguna decisión vigente.
