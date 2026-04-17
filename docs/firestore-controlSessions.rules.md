# Reglas sugeridas: `controlSessions`

Colección: `crossfitconnect-app/nuevaVersion/controlSessions/{uid}`

Cada documento representa el estado de visualización remota para el admin con Firebase UID `uid`.

## Reglas (copiar en la consola de Firebase o en `firestore.rules`)

Ajusta la condición de admin según cómo valides el rol en tu proyecto (aquí se asume que solo usuarios autenticados que son admins pueden acceder; si ya tienes un claim `admin`, úsalo en lugar de la lectura a `admins`).

```javascript
match /crossfitconnect-app/nuevaVersion/controlSessions/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}

// Presencia por dispositivo (TV + móvil). Si tu ruta de sesión es otra, replica el patrón.
match /controlSessions/{userId}/presence/{deviceId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

Si en el cliente usas la ruta anidada `crossfitconnect-app/nuevaVersion/controlSessions`, añade también:

```javascript
match /crossfitconnect-app/nuevaVersion/controlSessions/{userId}/presence/{deviceId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

Si varios admins deben compartir la misma sesión de sala, cambia el modelo a un `sessionId` compartido y restringe por `headquarter` o por claim personalizado.

## Campos del documento

| Campo           | Tipo    | Descripción                                      |
|----------------|---------|--------------------------------------------------|
| `currentIndex` | number  | Índice del carrusel (incluye slide clon si aplica) |
| `isPaused`     | bool    | Carrusel automático pausado                      |
| `lineHeight`   | number  | Interlineado                                     |
| `cardScale`    | number  | Escala de tarjetas                               |
| `fontSize`     | number  | Escala de fuente                                 |
| `isDark`       | bool    | Tema oscuro                                      |
| `updatedAt`    | timestamp | Última escritura (servidor)                    |
