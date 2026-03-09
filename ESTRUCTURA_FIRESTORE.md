# 📊 Estructura de Datos de Firestore

## Ruta de la Colección

**Ruta completa:** `/crossfitconnect-app/nuevaVersion/wods/`

Esta es una subcolección dentro de la estructura de Firestore.

## Colección: `wods`

Cada documento en la colección `wods` debe tener la siguiente estructura:

### Campos Principales

```javascript
{
  // Título del WOD
  "title": "HALLOWEEN 🎃",
  
  // Descripción general
  "description": "Microciclo #16: descarga 🔻 Esta semana tendrá como principal objetivo disminuir las cargas de entrenamiento en cuanto a volumen e intensidad, con el fin de recuperarnos y lograr una mejor forma deportiva...",
  
  // ID del administrador
  "adminId": "K2fT9GSH4JwdKK6rFF4qY",
  
  // Fecha del WOD (Timestamp de Firestore)
  "wodDate": Timestamp,
  
  // Calentamiento
  "warmup": "Arrep 10 min:\n• 10 Codos/brazo en total\n• 10 Codos/brazo en total\n• 15 Hollow rocks",
  
  // Fuerza
  "strength": "Reps 5-4-3-2-1 Snatch pull + 2 Hang power snatch + 2 High hang power snatch 65% Rm Power snatch + 5 Rounds 5 Rounds Max cal row Accesorios: 4x74 Weighted strict pull-ups + 4x12 Cable row chest supported a lado 4x15 Seated lat pulldown 4x12 Polea biceps tempo 2/1 4x10 Plancha lateral + Abd Dv x lado 2 Muscle snatch + 6 Snatch pull + 5 Muscle snatch + 100 50/50 Du/ Su x 2...",
  
  // Tipo de Metcon
  "idMetconType": "Duo/MMNUZ6A/U2DeR/",
  
  // Array de Metcons
  "metcoes": [
    {
      "description": "Partner wod For time - Time cap 18 min 6-4-3-2-1 Rope climb 7 Snatch Db x lado Synchro + 10 Burpees target Synchro + 100 50/50 Du/ Su x 2 Sollte functional: Partner wod For time - Time cap 18 min 10-8-6-4-2 Bungee row Rb + lado Synchro Cada round: 7 Snatch Rb x lado Synchro + 10 Burpees target Synchro + 100 50/50 Du/ Su x 2..."
    }
  ],
  
  // Complementarios/Accesorios
  "additional": "Conditioning: Arrep x 1:30 10 Global stretching x lado 10 Mov. Torácica con disco + mediball 10 Plancha lateral + Abd Dv x lado 10 Muscle snatch + 6 Snatch pull press + 10 Elevaciones respiratorias..."
}
```

### Campos Requeridos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `title` | String | Título del WOD |
| `description` | String | Descripción general del WOD |
| `adminId` | String | ID del administrador que creó el WOD |
| `wodDate` | Timestamp | Fecha del WOD |
| `metcoes` | Array | Array de objetos con los metcons |
| `idMetconType` | String | Tipo de metcon (ej: "Duo/MMNUZ6A/U2DeR/") |

### Campos Opcionales

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `warmup` | String | Descripción del calentamiento |
| `strength` | String | Descripción de la parte de fuerza |
| `additional` | String | Trabajo complementario/accesorios |

## Estructura del Array `metcoes`

Cada elemento en el array `metcoes` tiene:

```javascript
{
  "description": "Texto con las rondas y ejercicios del metcon"
}
```

## Ejemplo Completo de Documento

```javascript
{
  "title": "Fase de Transformación 🏋️",
  "description": "21 de enero de 2026 a las 12:00:00 a.m. UTC-5",
  "adminId": "K2fT9GSH4JwdKK6rFF4qY",
  "wodDate": "2026-01-21T05:00:00.000Z",
  "warmup": "7 Rounds 10 Global stretching x lado 10 Mov. Torácica con disco + mediball 10 Plancha lateral + Abd Dv x lado 10 Muscle snatch + 6 Snatch pull press + 10 Elevaciones respiratorias",
  "strength": "Reps 5-4-3-2-1 Snatch pull + 2 Hang power snatch + 2 High hang power snatch 65% Rm Power snatch + 5 Rounds 5 Rounds Max cal row Accesorios: 4x74 Weighted strict pull-ups + 4x12 Cable row chest supported a lado 4x15 Seated lat pulldown 4x12 Polea biceps tempo 2/1 4x10 Plancha lateral + Abd Dv x lado 2 Muscle snatch + 6 Snatch pull + 5 Muscle snatch + 100 50/50 Du/ Su x 2...",
  "idMetconType": "Duo/MMNUZ6A/U2DeR/",
  "metcoes": [
    {
      "description": "3 Rondas\n3 Squat clean 135-115-95 /\n1:15-95-75\n6 Burpees box jump over"
    },
    {
      "description": "3 Rondas\n3 Squat clean 165-135-115 /\nT35-105-85\n6 Burpees box jump over\n9 Cal machine"
    }
  ],
  "additional": "4 Rondas\n10 Hip thrust Heavy DB unilateral x lado\n20 Abductor fitball"
}
```

## Cómo Agregar un WOD en Firebase Console

1. Ve a Firestore Database
2. Navega a la ruta: `crossfitconnect-app` → `nuevaVersion` → `wods`
3. Haz clic en "Add document"
4. Agrega los campos según la estructura anterior
5. Para el campo `wodDate`, usa tipo "timestamp"
6. Para el campo `metcoes`, usa tipo "array" y agrega objetos con el campo `description`

**Nota:** Si no existe la estructura, créala:
- Crea documento `crossfitconnect-app`
- Dentro, crea subcolección `nuevaVersion`
- Dentro, crea subcolección `wods`

## Reglas de Seguridad Recomendadas

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /crossfitconnect-app/nuevaVersion/wods/{wodId} {
      allow read: if request.auth != null;
      allow write: if false; // Solo escritura desde admin
    }
  }
}
```

## Notas Importantes

- El campo `wodDate` debe ser un Timestamp de Firestore para ordenar correctamente
- Los saltos de línea en `description`, `warmup`, `strength` y `additional` se usan con `\n`
- Los emojis en los títulos son opcionales pero recomendados para mejor UX
- El array `metcoes` puede tener múltiples metcons (METCON 1, METCON 2, etc.)
