# Dashboard: mensaje «cierre de sesión no autorizado»

Este documento describe el aviso que puede verse en pantalla completa/TV cuando se navega el **dashboard de WODs** (`/dashboard`): *«Se bloqueó un cierre de sesión no autorizado. Usa el botón "Cerrar sesión" para finalizar la sesión.»*

## Finalidad del mensaje

No indica un error de servidor arbitrario: la aplicación **distingue**:

1. Salida **correcta**: el usuario pulsó «Cerrar sesión». Antes se registra una intención explícita en `sessionStorage` y, cuando Firebase ya no tiene sesión, se redirige al inicio sin mostrar este banner.

2. Pérdida de sesión **sin** ese flujo: Firebase reporta usuario nulo después de haber tenido sesión admin válida en esa carga de página, pero **no** existe la marca de cierre oficial. Entonces el dashboard muestra el error y **no** redirige de inmediato, para dejar claro que la sesión no terminó mediante el botón previsto.

La lógica vive en `src/app/dashboard/page.tsx` (listener `onAuthChange`) y las funciones relacionadas en `src/lib/auth.ts` (`markExplicitLogoutIntent`, `consumeExplicitLogoutIntent`, `logoutUser`).

## Comportamiento resumido

| Estado | Acción habitual |
|--------|----------------|
| Sesión perdida **y** intención de «Cerrar sesión» marcada **o** aún no había sesión admin en esta visita | Redirección al inicio (`/`) sin el banner |
| Sesión perdida **y** ya había sesión admin **sin** marca de cierre oficial | Se muestra el mensaje rojo |

La marca de cierre oficial se guarda solo al usar el botón «Cerrar sesión» en el dashboard (`handleLogout`), no al cerrar el navegador ni al borrar pestañas a mano.

## Causas frecuentes «fortuitas» (sin usar el botón)

| Caso | Qué puede ocurrir |
|------|-------------------|
| Red inestable o cortes breves | Falla el refresco del token de Firebase y la sesión se invalida. |
| Reloj del dispositivo muy desfasado | Los JWT dependen de la hora correcta del sistema; puede fallar la renovación del token. |
| Limpieza de datos del sitio / cookies / almacenamiento | Firebase deja de tener persistencia válida; la sesión desaparece sin pasar por el botón. |
| Borrado de `sessionStorage` | Ahí reside la marca de cierre oficial; si se vacía y luego Firebase cierra sesión, no hay rastro de intención. |
| Cambios en la cuenta (consola Firebase, cambio de contraseña, usuario deshabilitado) | El cliente pierde sesión sin el flujo UI de logout. |
| Tokens de refresco revocados o políticas de sesión | Sesión invalidada en este navegador. |
| TV o PC en suspensión mucho tiempo, navegador en segundo plano | Al volver, a veces la sesión ya no es válida. |
| Reinicio brusco del navegador o recuperación tras fallo | Estado inconsistente; Firebase puede iniciar como no autenticado. |
| Perfil temporal / incógnito | Expiración o cierre de ventana borra estado sin usar el dashboard. |
| Misma cuenta en otro dispositivo o pestaña | Cierre de sesión o revocación en otro sitio puede afectar esta pantalla. |

## Guía operativa (gimnasio / TV)

- Para salir siempre que sea posible, usar **«Cerrar sesión»** en el dashboard antes de apagar la TV o cerrar el navegador si el flujo debe quedar registrado como correcto.

- Si el mensaje aparece tras estar mucho tiempo en marcha:

  - comprobar **Wi‑Fi** estable;

  - comprobar **fecha y hora** del equipo;

  - evitar políticas del navegador que **limpien datos al cerrar** si esa TV debe mantener sesión larga.

- Tras el mensaje, la sesión ya no es válida: suele hacer falta **volver a iniciar sesión** (PIN o método que use el sitio).

## Notas para desarrollo

- `hadAuthenticatedSessionRef` en `page.tsx` distingue «ya hubo usuario admin válido en esta montura» vs. visitantes que nunca llegaron a completar ese estado.

- `markExplicitLogoutIntent` / `consumeExplicitLogoutIntent` usan la clave `explicitLogoutIntent` en `sessionStorage` (véase `src/lib/auth.ts`). No sustituye a la seguridad del servidor; solo ordena la UX del dashboard frente a cierres inesperados.

- Si se desea **redirigir siempre** al perder sesión sin mostrar banner, habría que cambiar esa rama de `onAuthChange`; tener en cuenta el impacto en trazabilidad y en pantallas kiosk.
