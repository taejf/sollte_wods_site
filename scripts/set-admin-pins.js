/**
 * Script para listar admins y, bajo confirmación, definir PINs y subirlos
 * encriptados (hash bcrypt) a Firestore.
 *
 * Uso:
 *   npm run admins:pin
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

async function main() {
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
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
