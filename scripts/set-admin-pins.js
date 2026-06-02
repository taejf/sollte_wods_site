/**
 * Script para listar admins y, bajo confirmación, definir PINs y subirlos
 * encriptados (hash bcrypt) a Firestore.
 *
 * Uso:
 *   npm run admins:pin                    # Modo interactivo (todos o uno específico)
 *   npm run admins:pin -- --admin <id>    # Asignar PIN a admin específico por docId
 *   npm run admins:pin -- --admin <id> --pin <pin>  # PIN específico para admin
 *
 * Requisitos:
 *   - Variable FIREBASE_SERVICE_ACCOUNT_JSON (contenido de serviceAccountKey.json) o
 *   - Fichero serviceAccountKey.json en la raíz del proyecto (junto a package.json).
 */

const admin = require('firebase-admin');
const bcrypt = require('bcryptjs');
const readlineSync = require('readline-sync');
const path = require('path');
const fs = require('fs');

const ADMINS_COLLECTION = 'crossfitconnect-app/nuevaVersion/admins';
const BCRYPT_ROUNDS = 10;

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { adminId: null, pin: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--admin' && args[i + 1]) {
      result.adminId = args[++i];
    } else if (args[i] === '--pin' && args[i + 1]) {
      result.pin = args[++i];
    }
  }
  return result;
}

// Raíz del proyecto (carpeta que contiene package.json), desde la ubicación de este script
const PROJECT_ROOT = path.resolve(__dirname, '..');

function initFirebase() {
  if (admin.apps.length > 0) return admin.app();

  let key;
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (envJson && envJson.trim()) {
    try {
      key = JSON.parse(envJson);
    } catch {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON no es un JSON válido.');
      process.exit(1);
    }
  } else {
    const credPath = path.join(PROJECT_ROOT, 'serviceAccountKey.json');
    if (!fs.existsSync(credPath)) {
      console.error(
        'No se encontró cuenta de servicio. Define FIREBASE_SERVICE_ACCOUNT_JSON o coloca serviceAccountKey.json en:',
        credPath
      );
      process.exit(1);
    }
    key = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  }

  if (key.project_id) {
    console.log('Usando proyecto:', key.project_id);
  }
  return admin.initializeApp({ credential: admin.credential.cert(key) });
}

function getAdminsRef() {
  const [col, doc, subcol] = ADMINS_COLLECTION.split('/');
  return admin.firestore().collection(col).doc(doc).collection(subcol);
}

async function listAdmins() {
  const ref = getAdminsRef();
  const snapshot = await ref.get();
  return snapshot.docs.map((d) => ({
    id: d.id,
    ref: d.ref,
    ...d.data()
  }));
}

function question(msg, options = {}) {
  return readlineSync.question(msg, options);
}

function label(adminDoc) {
  const parts = [
    adminDoc.documentNumber || adminDoc.email || adminDoc.nombre || '',
    adminDoc.firebaseUID ? `(${adminDoc.firebaseUID.slice(0, 8)}…)` : ''
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : adminDoc.id;
}

function randomPin5() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function validatePin(pin) {
  if (!/^\d{4,6}$/.test(pin)) {
    console.error('El PIN debe tener entre 4 y 6 dígitos.');
    return false;
  }
  return true;
}

async function assignPinToSpecificAdmin(admins, adminId, providedPin) {
  const admin = admins.find(
    (a) =>
      a.id === adminId ||
      a.documentNumber === adminId ||
      a.firebaseUID === adminId ||
      a.email === adminId
  );

  if (!admin) {
    console.error(`No se encontró admin con id/documentNumber/firebaseUID/email: ${adminId}`);
    console.log('\nAdmins disponibles:');
    admins.forEach((a) => {
      console.log(`  - docId: ${a.id} | documentNumber: ${a.documentNumber || '(sin)'} | firebaseUID: ${a.firebaseUID || '(sin)'}`);
    });
    process.exit(1);
  }

  console.log(`\nAdmin encontrado: ${label(admin)}`);
  console.log(`  docId: ${admin.id}`);
  console.log(`  documentNumber: ${admin.documentNumber || '(sin)'}`);
  console.log(`  firebaseUID: ${admin.firebaseUID || '(sin)'}`);
  console.log(`  pinHash actual: ${admin.pinHash ? '(definido)' : '(no definido)'}`);

  let pin = providedPin;
  if (!pin) {
    const useCustom = question('\n¿Usar PIN personalizado? (s/n, Enter para generar aleatorio): ')
      .trim()
      .toLowerCase();
    if (useCustom === 's' || useCustom === 'si') {
      pin = question('Ingresa el PIN (4-6 dígitos): ').trim();
      if (!validatePin(pin)) process.exit(1);
    } else {
      pin = randomPin5();
      console.log(`PIN generado: ${pin}`);
    }
  } else {
    if (!validatePin(pin)) process.exit(1);
    console.log(`\nUsando PIN proporcionado: ${pin}`);
  }

  const confirm = question(`\n¿Confirmar y asignar PIN a ${label(admin)}? (s/n): `)
    .trim()
    .toLowerCase();
  if (confirm !== 's' && confirm !== 'si') {
    console.log('Operación cancelada.');
    process.exit(0);
  }

  const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
  await admin.ref.update({ pinHash });
  console.log(`\n✓ PIN asignado correctamente a ${label(admin)}`);
  console.log(`  PIN: ${pin} (guárdalo, no se mostrará de nuevo)`);
}

async function assignPinsToAll(admins) {
  const proceed = question('\n¿Definir PINs y subirlos encriptados? (s/n): ')
    .trim()
    .toLowerCase();
  if (proceed !== 's' && proceed !== 'si') {
    console.log('Salida sin cambios.');
    process.exit(0);
  }

  const used = new Set();
  const pins = admins.map((a) => {
    let pin;
    do {
      pin = randomPin5();
    } while (used.has(pin));
    used.add(pin);
    return { admin: a, pin };
  });

  console.log('\nPINs generados (5 cifras). Guarda esta lista:\n');
  pins.forEach(({ admin: a, pin }) => {
    console.log(`  ${label(a)} → ${pin}`);
  });

  const confirm = question('\n¿Confirmar y subir a Firestore? (s/n): ')
    .trim()
    .toLowerCase();
  if (confirm !== 's' && confirm !== 'si') {
    console.log('Operación cancelada.');
    process.exit(0);
  }

  console.log('\nSubiendo PINs encriptados…');
  for (const { admin: a, pin } of pins) {
    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    await a.ref.update({ pinHash });
    console.log(`  OK: ${label(a)}`);
  }
  console.log('\nListo. Los PINs generados solo se muestran arriba; guárdalos.');
}

async function main() {
  const { adminId, pin } = parseArgs();

  console.log('Inicializando Firebase Admin…\n');
  initFirebase();

  let admins = await listAdmins();
  if (admins.length === 0) {
    console.log('No hay documentos en la colección de admins.');
    process.exit(0);
  }

  const sortKey = (a) => (a.documentNumber || a.email || a.id || '').toLowerCase();
  admins = admins.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  console.log('Admins existentes (por documentNumber):\n');
  admins.forEach((a, i) => {
    const documentNumber = a.documentNumber || a.email || '(sin documentNumber)';
    console.log(
      `  ${i + 1}. ${documentNumber} | firebaseUID: ${a.firebaseUID || '(falta)'} | docId: ${a.id}`
    );
  });

  if (adminId) {
    await assignPinToSpecificAdmin(admins, adminId, pin);
  } else {
    const mode = question('\n¿Qué deseas hacer?\n  1. Asignar PIN a un admin específico\n  2. Asignar PINs a todos los admins\n  (1/2): ')
      .trim();

    if (mode === '1') {
      const selectedId = question('Ingresa el docId, documentNumber, firebaseUID o email del admin: ').trim();
      if (!selectedId) {
        console.log('No se proporcionó identificador.');
        process.exit(1);
      }
      await assignPinToSpecificAdmin(admins, selectedId, null);
    } else if (mode === '2') {
      await assignPinsToAll(admins);
    } else {
      console.log('Opción no válida.');
      process.exit(1);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
