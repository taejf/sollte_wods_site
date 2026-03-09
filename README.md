# Aplicación Astro con Firebase y Material Web

Una aplicación web moderna construida con Astro, Firebase Authentication, Firestore y Material Web Components.

## Características

- 🚀 **Astro** - Framework web ultrarrápido con renderizado híbrido
- 🔐 **Firebase Authentication** - Sistema de autenticación seguro
- 📊 **Firestore** - Base de datos NoSQL en tiempo real
- 🎨 **Material Web Components** - Componentes UI nativos de Material Design 3
- 📱 **Responsive** - Diseño adaptable a todos los dispositivos
- 🔒 **Seguro** - Protección de rutas y datos

## Requisitos Previos

- Node.js 18+ instalado
- Una cuenta de Firebase
- Un proyecto de Firebase configurado

## Configuración Inicial

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Ve a **Project Settings** (ícono de engranaje)
4. En la sección **Your apps**, haz clic en el ícono web `</>`
5. Registra tu aplicación web
6. Copia las credenciales de configuración

### 3. Configurar Variables de Entorno

1. Copia el archivo de ejemplo:
   ```bash
   copy .env.example .env
   ```

2. Edita `.env` y pega tus credenciales de Firebase:
   ```
   PUBLIC_FIREBASE_API_KEY=tu-api-key
   PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
   PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto-id
   PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
   PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
   ```

### 4. Configurar Firebase Authentication

1. En Firebase Console, ve a **Authentication**
2. Haz clic en **Get Started**
3. Habilita el método **Email/Password**
4. Crea un usuario de prueba en la pestaña **Users**

### 5. Configurar Firestore

1. En Firebase Console, ve a **Firestore Database**
2. Haz clic en **Create database**
3. Selecciona el modo de prueba o producción
4. Elige una ubicación para tu base de datos

### 6. Configurar Reglas de Seguridad de Firestore

En la pestaña **Rules** de Firestore, configura las siguientes reglas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```

Esto permite:
- ✅ Lectura solo para usuarios autenticados
- ❌ Escritura deshabilitada desde la aplicación (solo desde Firebase Console)

### 7. Crear Datos de Prueba

1. Ve a Firestore Database en Firebase Console
2. Crea una colección llamada `datos`
3. Agrega algunos documentos de prueba con campos como:
   ```json
   {
     "title": "Ejemplo 1",
     "description": "Esta es una descripción de prueba",
     "fecha": "2026-03-09",
     "estado": "activo"
   }
   ```

## Ejecutar la Aplicación

### Modo Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:4321`

### Build de Producción

```bash
npm run build
```

### Preview de Producción

```bash
npm run preview
```

## Estructura del Proyecto

```
sollte_wods_site/
├── src/
│   ├── pages/
│   │   ├── index.astro          # Página de login
│   │   └── dashboard.astro      # Dashboard protegido
│   ├── components/
│   │   └── DataDisplay.astro    # Componente de visualización
│   ├── layouts/
│   │   └── Layout.astro         # Layout base
│   ├── lib/
│   │   ├── firebase.ts          # Configuración Firebase
│   │   └── auth.ts              # Helpers de autenticación
│   └── env.d.ts                 # Tipos TypeScript
├── public/                      # Archivos estáticos
├── astro.config.mjs            # Configuración Astro
├── package.json                # Dependencias
├── tsconfig.json               # Configuración TypeScript
├── .env                        # Variables de entorno (no commitear)
└── .env.example                # Plantilla de variables
```

## Uso

1. **Iniciar Sesión**: Abre la aplicación y usa las credenciales del usuario que creaste en Firebase
2. **Ver Dashboard**: Después de autenticarte, serás redirigido al dashboard
3. **Ver Datos**: El dashboard mostrará automáticamente los datos de Firestore
4. **Cerrar Sesión**: Haz clic en "Cerrar Sesión" para salir

## Características Técnicas

### Autenticación
- Login con email y password
- Protección de rutas
- Redirección automática si no está autenticado
- Manejo de errores de autenticación

### Firestore
- Fetch automático de datos al cargar el dashboard
- Búsqueda en múltiples colecciones
- Manejo de errores de conexión
- Visualización dinámica de datos

### Material Web Components
- Componentes nativos sin overhead de framework
- Tema personalizable con tokens CSS
- Diseño responsive
- Accesibilidad integrada

## Solución de Problemas

### Error: "No se encontraron datos en Firestore"
- Verifica que hayas creado una colección con documentos
- Revisa las reglas de seguridad de Firestore
- Asegúrate de estar autenticado

### Error: "Credenciales inválidas"
- Verifica que el usuario exista en Firebase Authentication
- Confirma que el email y contraseña sean correctos
- Revisa que Firebase Authentication esté habilitado

### Error: "Firebase not configured"
- Verifica que el archivo `.env` exista
- Confirma que todas las variables estén configuradas
- Reinicia el servidor de desarrollo

## Personalización

### Cambiar Colores del Tema

Edita las variables CSS en `src/layouts/Layout.astro`:

```css
:root {
  --md-sys-color-primary: #6750A4;
  --md-sys-color-on-primary: #FFFFFF;
  /* ... más colores */
}
```

### Agregar Más Componentes Material

Importa componentes adicionales en el layout:

```javascript
import '@material/web/card/filled-card.js';
import '@material/web/chip/chip-set.js';
// ... más componentes
```

Ver [Material Web Components](https://github.com/material-components/material-web) para la lista completa.

## Recursos

- [Documentación de Astro](https://docs.astro.build)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Material Web Components](https://github.com/material-components/material-web)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

## Licencia

MIT
