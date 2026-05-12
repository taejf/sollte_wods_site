# Dashboard: cierre de sesión y recuperación con PIN

Este documento describe el comportamiento del **dashboard de WODs** (`/dashboard`) cuando Firebase deja de tener usuario: intención explícita de «Cerrar sesión», recuperación automática con PIN en `localStorage`, y redirección al inicio cuando no hay recuperación posible.

## Cómo ordena la aplicación el cierre

1. Salida **correcta**: el usuario pulsó «Cerrar sesión». Antes se registra una intención en `sessionStorage` y, cuando Firebase ya no tiene sesión, se redirige al inicio (`/`). Además se **borra** el PIN guardado para recuperación automática.

2. Pérdida de sesión **sin** ese flujo: Firebase notifica usuario nulo después de haber tenido sesión admin válida en esa carga de página, pero **no** hay marca de cierre oficial. Primero se intenta **recuperación automática** con `loginWithPin` si existe PIN en `localStorage`. Si no hay PIN o no aplica el reintento, **se redirige al inicio (`/`)**. El único texto de error que puede quedar visible en este flujo es el de **fallo al reautenticar con el PIN guardado** cuando ese intento se ejecuta y falla (véase la tabla más abajo).

La lógica vive en `src/app/dashboard/page.tsx` (listener `onAuthChange`) y en `src/lib/auth.ts` (`markExplicitLogoutIntent`, `consumeExplicitLogoutIntent`, `logoutUser`, funciones de PIN y recuperación).

## Mitigación: PIN en `localStorage` y re-sesión automática

Tras un **login por PIN correcto** (`loginWithPin`), el PIN se persiste en **`localStorage`** con la clave `sollteWods_dashboardPinRecovery` para que, si Firebase pierde la sesión en esa TV sin un cierre oficial, el dashboard pueda **volver a autenticarse solo** llamando otra vez a `loginWithPin` con ese valor.

| Aspecto | Detalle |
|---------|---------|
| Cuándo se guarda | Al completar `loginWithPin` con éxito (admin válido). |
| Cuándo se borra | En `logoutUser` (incluido el botón «Cerrar sesión» del dashboard). |
| Cuándo se intenta recuperar | En `onAuthChange` con `user === null`, sesión admin ya vista en la página, sin intención explícita de cierre, **y** existe PIN almacenado. |
| Concurrencia | `sessionRecoveryInFlightRef` en `page.tsx` evita solapar dos intentos simultáneos. |
| Fallo **definitivo** (PIN inválido, sin admin, mensajes de error de credencial) | Se llama `invalidateStoredDashboardPinIfAuthRejected` y se elimina el PIN guardado; puede mostrarse el mensaje de recuperación fallida en el dashboard hasta la siguiente navegación. |
| Fallo **transitorio** (red, errores de servidor al validar PIN no atribuibles al PIN) | El PIN **no** se borra; en un nuevo evento sin usuario podría reintentarse. |

### Riesgos de seguridad

- El PIN queda **en claro** en el almacenamiento del navegador; quien tenga acceso físico o al perfil del navegador puede usarlo para obtener sesión hasta que alguien pulse «Cerrar sesión» en el dashboard.
- Pensado para **dispositivos controlados** (p. ej. TV del box), no para ordenadores públicos sin supervisión.

## Comportamiento resumido

| Estado | Acción habitual |
|--------|----------------|
| Sesión perdida **y** intención de «Cerrar sesión» marcada **o** aún no había sesión admin en esta visita | Redirección al inicio (`/`) |
| Sesión perdida **y** ya hubo sesión admin **sin** marca de cierre **y** hay PIN en `localStorage` | Intento de `loginWithPin` automático; si tiene éxito, se continúa en el dashboard |
| Mismo caso anterior **pero** recuperación fallida | Mensaje en dashboard sobre no poder recuperar la sesión automáticamente (PIN o conexión); el usuario puede volver a iniciar sesión según la UI |
| Sesión perdida **y** no hay PIN guardado aplicable para ese evento | Redirección al inicio (`/`) |

La marca de cierre oficial se guarda solo al usar el botón «Cerrar sesión» en el dashboard (`handleLogout`), no al cerrar el navegador ni al borrar pestañas a mano.

## Causas frecuentes de pérdida de sesión «fortuita» (sin usar el botón)

| Caso | Qué puede ocurrir |
|------|-------------------|
| Red inestable o cortes breves | Falla el refresco del token de Firebase y la sesión se invalida; la mitigación puede reautenticar con el PIN guardado. |
| Reloj del dispositivo muy desfasado | Los JWT dependen de la hora correcta del sistema; puede fallar la renovación del token. |
| Limpieza de datos del sitio / cookies / almacenamiento | Si se borra también `localStorage`, desaparece el PIN de recuperación además de la sesión de Firebase. |
| Borrado de `sessionStorage` | Ahí reside la marca de cierre oficial; si se vacía y luego Firebase cierra sesión, no hay rastro de intención. El PIN de recuperación es independiente (`localStorage`). |
| Cambios en la cuenta (consola Firebase, cambio de contraseña, usuario deshabilitado) | El cliente pierde sesión; la recuperación con PIN puede fallar si el admin o el PIN ya no son válidos. |
| Tokens de refresco revocados o políticas de sesión | Sesión invalidada en este navegador; el re-login por PIN guardado puede compensar si el PIN sigue siendo correcto. |
| TV o PC en suspensión mucho tiempo | Al volver, a veces la sesión ya no es válida; la mitigación reduce la necesidad de teclear de nuevo si el PIN persiste. |
| Reinicio brusco del navegador o recuperación tras fallo | Estado inconsistente; Firebase puede iniciar como no autenticado. |
| Perfil temporal / incógnito | Expiración o cierre de ventana puede borrar almacenamiento; no conviene para kiosk con recuperación PIN. |
| Misma cuenta en otro dispositivo o pestaña | Cierre de sesión o revocación en otro sitio puede afectar esta pantalla según políticas de Firebase. |

## Guía operativa (gimnasio / TV)

- Para salir y **eliminar el PIN guardado**, usar **«Cerrar sesión»** en el dashboard antes de dejar la TV accesible a otros.

- Si acabas en la **pantalla de inicio de sesión** sin haber pulsado «Cerrar sesión**:

  - comprobar **Wi‑Fi** estable;

  - comprobar **fecha y hora** del equipo;

  - evitar políticas del navegador que **limpien datos al cerrar** si esa TV debe mantener sesión y recuperación PIN.

- Si ves el aviso de que **no** se pudo recuperar la sesión automáticamente: revisar red; si el PIN cambió en el backend, iniciar sesión de nuevo con el PIN actual.

## Notas para desarrollo

- `hadAuthenticatedSessionRef` en `page.tsx` distingue «ya hubo usuario admin válido en esta montura» vs. visitantes que nunca llegaron a completar ese estado.

- `markExplicitLogoutIntent` / `consumeExplicitLogoutIntent` usan la clave `explicitLogoutIntent` en `sessionStorage`.

- PIN de recuperación: `getStoredDashboardPin`, `clearStoredDashboardPin`, `invalidateStoredDashboardPinIfAuthRejected` en `src/lib/auth.ts`; `persistDashboardPinForRecovery` se usa internamente tras `loginWithPin` exitoso.

- Para **no** guardar el PIN en el cliente o cambiar cómo se redirige al perder sesión, ajustar `onAuthChange` y/o `loginWithPin` / `logoutUser`.
