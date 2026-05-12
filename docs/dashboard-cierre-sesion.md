# Dashboard: mensaje «cierre de sesión no autorizado»

Este documento describe el aviso que puede verse en pantalla completa/TV cuando se navega el **dashboard de WODs** (`/dashboard`): *«Se bloqueó un cierre de sesión no autorizado. Usa el botón "Cerrar sesión" para finalizar la sesión.»* También cubre la **mitigación automática** con PIN guardado en `localStorage` y los mensajes relacionados con un fallo de recuperación.

## Finalidad del mensaje

No indica un error de servidor arbitrario: la aplicación **distingue**:

1. Salida **correcta**: el usuario pulsó «Cerrar sesión». Antes se registra una intención explícita en `sessionStorage` y, cuando Firebase ya no tiene sesión, se redirige al inicio sin mostrar este banner. Además se **borra** cualquier PIN guardado para recuperación (véase más abajo).

2. Pérdida de sesión **sin** ese flujo: Firebase reporta usuario nulo después de haber tenido sesión admin válida en esa carga de página, pero **no** existe la marca de cierre oficial. Antes de mostrar el mensaje rojo, el dashboard intenta una **recuperación automática** con `loginWithPin` si hay un PIN válido guardado (mitigación kiosk/TV). Si eso falla o no hay PIN, se muestra el error y **no** se redirige de inmediato, salvo en los casos de la tabla siguiente.

La lógica vive en `src/app/dashboard/page.tsx` (listener `onAuthChange`) y en `src/lib/auth.ts` (`markExplicitLogoutIntent`, `consumeExplicitLogoutIntent`, `logoutUser`, funciones de PIN y recuperación).

## Mitigación: PIN en `localStorage` y re-sesión automática

Tras un **login por PIN correcto** (`loginWithPin`), el PIN se persiste en **`localStorage`** con la clave `sollteWods_dashboardPinRecovery` para que, si Firebase pierde la sesión en esa TV sin un cierre oficial, el dashboard pueda **volver a autenticarse solo** llamando otra vez a `loginWithPin` con ese valor.

| Aspecto | Detalle |
|---------|---------|
| Cuándo se guarda | Al completar `loginWithPin` con éxito (admin válido). |
| Cuándo se borra | En `logoutUser` (incluido el botón «Cerrar sesión» del dashboard). |
| Cuándo se intenta recuperar | En `onAuthChange` con `user === null`, sesión admin ya vista en la página, sin intención explícita de cierre, **y** existe PIN almacenado. |
| Concurrencia | `sessionRecoveryInFlightRef` en `page.tsx` evita solapar dos intentos simultáneos. |
| Fallo **definitivo** (PIN inválido, sin admin, mensajes de error de credencial) | Se llama `invalidateStoredDashboardPinIfAuthRejected` y se elimina el PIN guardado; puede mostrarse el mensaje genérico de recuperación fallida. |
| Fallo **transitorio** (red, errores de servidor al validar PIN no atribuibles al PIN) | El PIN **no** se borra; en un nuevo evento sin usuario podría reintentarse. |

### Riesgos de seguridad (obligatorio tenerlo en cuenta)

- El PIN queda **en claro** en el almacenamiento del navegador; quien tenga acceso físico o al perfil del navegador puede usarlo para obtener sesión hasta que alguien pulse «Cerrar sesión» en el dashboard.
- Es una decisión pensada para **dispositivos controlados** (p. ej. TV del box), no para ordenadores públicos compartidos sin supervisión.

## Comportamiento resumido

| Estado | Acción habitual |
|--------|----------------|
| Sesión perdida **y** intención de «Cerrar sesión» marcada **o** aún no había sesión admin en esta visita | Redirección al inicio (`/`) sin el banner |
| Sesión perdida **y** ya hubo sesión admin **sin** marca de cierre **y** hay PIN en `localStorage` | Intento de `loginWithPin` automático; si tiene éxito, se continúa en el dashboard sin el mensaje de «cierre no autorizado» |
| Mismo caso anterior **pero** recuperación fallida (o no hay PIN guardado) | Mensaje rojo de cierre no autorizado **o**, si hubo intento de recuperación y falló, el mensaje sobre no poder recuperar sesión automáticamente (revisar PIN o conexión). |

La marca de cierre oficial se guarda solo al usar el botón «Cerrar sesión» en el dashboard (`handleLogout`), no al cerrar el navegador ni al borrar pestañas a mano.

## Causas frecuentes «fortuitas» (sin usar el botón)

| Caso | Qué puede ocurrir |
|------|-------------------|
| Red inestable o cortes breves | Falla el refresco del token de Firebase y la sesión se invalida; la mitigación puede reautenticar con el PIN guardado. |
| Reloj del dispositivo muy desfasado | Los JWT dependen de la hora correcta del sistema; puede fallar la renovación del token. |
| Limpieza de datos del sitio / cookies / almacenamiento | Si se borra también `localStorage`, desaparece el PIN de recuperación además de la sesión de Firebase. |
| Borrado de `sessionStorage` | Ahí reside la marca de cierre oficial; si se vacía y luego Firebase cierra sesión, no hay rastro de intención. El PIN de recuperación es independiente (`localStorage`). |
| Cambios en la cuenta (consola Firebase, cambio de contraseña, usuario deshabilitado) | El cliente pierde sesión; la recuperación con PIN puede fallar si el admin o el PIN ya no son válidos (y entonces se puede borrar el PIN almacenado). |
| Tokens de refresco revocados o políticas de sesión | Sesión invalidada en este navegador; el re-login por PIN guardado puede compensar si el PIN sigue siendo correcto. |
| TV o PC en suspensión mucho tiempo, navegador en segundo plano | Al volver, a veces la sesión ya no es válida; la mitigación reduce la necesidad de teclear de nuevo si el PIN persiste. |
| Reinicio brusco del navegador o recuperación tras fallo | Estado inconsistente; Firebase puede iniciar como no autenticado. |
| Perfil temporal / incógnito | Expiración o cierre de ventana puede borrar almacenamiento; no debe confiarse para kiosk con recuperación PIN. |
| Misma cuenta en otro dispositivo o pestaña | Cierre de sesión o revocación en otro sitio puede afectar esta pantalla según políticas de Firebase. |

## Guía operativa (gimnasio / TV)

- Para salir y **eliminar el PIN guardado**, usar siempre que sea posible **«Cerrar sesión»** en el dashboard antes de dejar la TV accesible a otros.

- Si el mensaje aparece tras estar mucho tiempo en marcha:

  - comprobar **Wi‑Fi** estable;

  - comprobar **fecha y hora** del equipo;

  - evitar políticas del navegador que **limpien datos al cerrar** si esa TV debe mantener sesión y recuperación PIN.

- Si aparece que **no** se pudo recuperar la sesión automáticamente: revisar red; si el PIN cambió en el backend, será necesario iniciar sesión de nuevo manualmente.

## Notas para desarrollo

- `hadAuthenticatedSessionRef` en `page.tsx` distingue «ya hubo usuario admin válido en esta montura» vs. visitantes que nunca llegaron a completar ese estado.

- `markExplicitLogoutIntent` / `consumeExplicitLogoutIntent` usan la clave `explicitLogoutIntent` en `sessionStorage`. No sustituye a la seguridad del servidor; ordena la UX del dashboard frente a cierres inesperados.

- PIN de recuperación: `getStoredDashboardPin`, `clearStoredDashboardPin`, `invalidateStoredDashboardPinIfAuthRejected` en `src/lib/auth.ts`; `persistDashboardPinForRecovery` se usa internamente tras `loginWithPin` exitoso.

- Si se desea **redirigir siempre** al perder sesión sin mostrar banner —o desactivar el almacenamiento del PIN por política— habría que ajustar `onAuthChange` y/o `loginWithPin` / `logoutUser`; tener en cuenta impacto en kiosk y seguridad física del dispositivo.
