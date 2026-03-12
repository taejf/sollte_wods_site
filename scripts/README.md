# Scripts de administración

## set-admin-pins.js

Lista los admins de Firestore y, bajo confirmación, permite definir un PIN para cada uno y subirlo encriptado (hash bcrypt) al campo `pinHash` del documento.

### Uso

```bash
npm run admins:pin
```

### Requisitos

1. **Cuenta de servicio de Firebase**  
   - Descarga el JSON de cuenta de servicio en Firebase Console (proyecto crossfitconnect-app) → Configuración del proyecto → Cuentas de servicio.  
   - Coloca el fichero en la raíz del proyecto como `serviceAccountKey.json` (está en `.gitignore`).

2. **Dependencias**  
   Instaladas con `npm install` (firebase-admin, bcryptjs, readline-sync en devDependencies).

### Flujo

1. Muestra la lista de admins (nombre/email, firebaseUID, id del documento).
2. Pregunta: «¿Definir PINs y subirlos encriptados? (s/n)».
3. Para cada admin pide el PIN (entrada oculta). Vacío = no cambiar.
4. Muestra resumen y pide: «¿Confirmar y subir a Firestore? (s/n)».
5. Si confirmas, escribe en cada documento el campo `pinHash` (bcrypt, 10 rondas).

Los PINs en texto plano no se guardan; solo el hash. No es posible recuperar el PIN desde `pinHash`.
