// Script para verificar la configuración de Firebase
// Ejecuta: node verificar-config.js

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Verificando configuración de Firebase...\n');

try {
  const envPath = join(__dirname, '.env.local');
  const envPathAlt = join(__dirname, '.env');
  const envContent = existsSync(envPath)
    ? readFileSync(envPath, 'utf-8')
    : existsSync(envPathAlt)
      ? readFileSync(envPathAlt, 'utf-8')
      : '';

  if (!envContent) {
    console.log('❌ No se encontró .env.local ni .env');
    console.log('\n💡 Crea .env.local con las variables NEXT_PUBLIC_FIREBASE_* (ver .env.example)\n');
    process.exit(1);
  }

  const requiredVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];

  let allConfigured = true;
  let missingVars = [];

  console.log('📋 Verificando variables de entorno:\n');

  requiredVars.forEach(varName => {
    const regex = new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=(.+)`, 'i');
    const match = envContent.match(regex);
    
    if (match && match[1] && !match[1].includes('tu-') && !match[1].includes('aqui')) {
      console.log(`✅ ${varName}: Configurado`);
    } else {
      console.log(`❌ ${varName}: NO configurado`);
      allConfigured = false;
      missingVars.push(varName);
    }
  });

  console.log('\n' + '='.repeat(60) + '\n');

  if (allConfigured) {
    console.log('✅ ¡Todas las variables están configuradas!\n');
    console.log('Próximos pasos:');
    console.log('1. Ejecuta: npm run dev');
    console.log('2. Abre: http://localhost:3000');
    console.log('3. Inicia sesión con tus credenciales de Firebase\n');
  } else {
    console.log('⚠️  Faltan variables por configurar:\n');
    missingVars.forEach(v => console.log(`   - ${v}`));
    console.log('\n📖 Lee el archivo CONFIGURACION_FIREBASE.md para obtener ayuda.\n');
    console.log('Pasos rápidos:');
    console.log('1. Ve a: https://console.firebase.google.com/project/crossfitconnect-app/settings/general');
    console.log('2. Busca "Your apps" y selecciona tu Web App (ícono </>) o créala');
    console.log('3. Copia los valores de firebaseConfig');
    console.log('4. Pégalos en el archivo .env.local (o .env) con prefijo NEXT_PUBLIC_\n');
  }

  // Verificar serviceAccountKey.json
  console.log('🔐 Verificando archivos de seguridad:\n');
  
  try {
    const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
    readFileSync(serviceAccountPath, 'utf-8');
    console.log('⚠️  serviceAccountKey.json encontrado');
    console.log('   Este archivo NO se usa en esta aplicación web.');
    console.log('   Es para Firebase Admin SDK (servidor).');
    console.log('   ✅ Ya está en .gitignore (no se subirá a git)\n');
  } catch (error) {
    console.log('✅ serviceAccountKey.json no encontrado (correcto para esta app)\n');
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  console.log('\n💡 Crea .env.local en la raíz con las variables NEXT_PUBLIC_FIREBASE_*\n');
}

console.log('='.repeat(60));
console.log('\n📚 Documentación disponible:');
console.log('   - CONFIGURACION_FIREBASE.md (guía detallada)');
console.log('   - INICIO_RAPIDO.md (pasos rápidos)');
console.log('   - README.md (documentación completa)\n');
