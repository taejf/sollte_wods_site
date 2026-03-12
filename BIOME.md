# Configuración de Biome ⚡

Este proyecto utiliza [Biome](https://biomejs.dev/) v2.4.6 como linter y formateador de código.

## ¿Qué es Biome?

Biome es una herramienta moderna y rápida que reemplaza a ESLint y Prettier, ofreciendo:
- **Velocidad**: Hasta 97% más rápido que otras herramientas
- **Todo en uno**: Linting y formateo en una sola herramienta
- **Configuración simple**: Un solo archivo de configuración
- **Compatibilidad**: Funciona con JavaScript, TypeScript, JSX, TSX y JSON

## Scripts disponibles

```bash
# Verificar problemas de linting
npm run lint

# Corregir problemas de linting automáticamente
npm run lint:fix

# Formatear código
npm run format

# Verificar linting y formato (sin modificar archivos)
npm run check

# Corregir linting y formato automáticamente
npm run check:fix
```

## Configuración

La configuración de Biome se encuentra en `biome.json` e incluye:

### Formateador
- **Indentación**: 2 espacios
- **Ancho de línea**: 100 caracteres
- **Comillas**: Simples para JS/TS, dobles para JSX
- **Punto y coma**: Automático (solo cuando es necesario)
- **Comas finales**: Estilo ES5

### Linter
- Reglas recomendadas habilitadas
- Imports no usados: Error
- Variables no usadas: Error
- Console.log: Advertencia (deshabilitado en tests)
- Doble igual (==): Error (usar === siempre)
- Any explícito: Advertencia
- Hooks de React: Verificación de dependencias

### Archivos ignorados
- `node_modules/`
- `.next/`
- `out/`, `build/`, `dist/`
- Archivos de configuración (*.config.js)
- Archivos públicos

## Integración con el editor

Para usar Biome en VSCode/Cursor:

1. Instala la extensión de Biome:
   - Busca "Biome" en el marketplace de extensiones
   - O instala desde: https://marketplace.visualstudio.com/items?itemName=biomejs.biome

2. Reinicia el editor después de instalar la extensión

3. El formateo automático funcionará al guardar archivos

## Migración desde ESLint/Prettier

Si tenías ESLint o Prettier configurados previamente:

1. Puedes eliminar los siguientes archivos (si existen):
   - `.eslintrc.js`, `.eslintrc.json`, `.eslintrc.yml`
   - `.prettierrc`, `.prettierrc.json`, `.prettierrc.yml`
   - `.prettierignore`

2. Puedes desinstalar las dependencias antiguas:
   ```bash
   npm uninstall eslint prettier eslint-config-next
   ```

## Comandos útiles

```bash
# Verificar un archivo específico
npx biome check src/app/page.tsx

# Formatear un archivo específico
npx biome format --write src/app/page.tsx

# Ver ayuda
npx biome --help
```

## CI/CD

Para integrar Biome en tu pipeline de CI/CD, agrega:

```yaml
- name: Check code quality
  run: npm run check
```

Esto verificará el linting y formato sin modificar archivos.

## Más información

- [Documentación oficial de Biome](https://biomejs.dev/)
- [Guía de migración desde ESLint](https://biomejs.dev/guides/migrate-eslint-prettier/)
- [Reglas de linting](https://biomejs.dev/linter/rules/)
