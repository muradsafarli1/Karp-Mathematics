import admin from 'firebase-admin';
import fs from 'node:fs';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

if (!fs.existsSync(keyPath)) {
  throw new Error(
    `Firebase service-account JSON not found at "${keyPath}". Download it from Firebase Console and keep it OUT of GitHub.`
  );
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'able-2ca24.firebasestorage.app'
});

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

const CONTENT_COLLECTIONS = [
  'problems',
  'articles',
  'contests',
  'videos',
  'exams',
  'legacyUsers'
];

async function deleteCollection(name) {
  const snap = await db.collection(name).get();
  let deleted = 0;
  for (const doc of snap.docs) {
    await doc.ref.delete();
    deleted++;
  }
  console.log(`Cleared ${name}: ${deleted}`);
}

async function deleteNonAdminUsers() {
  let nextPageToken;
  let deleted = 0;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    const targets = page.users.filter(u => u.email !== 'admin@able.local');

    for (const user of targets) {
      await auth.deleteUser(user.uid);
      await db.collection('users').doc(user.uid).delete().catch(() => {});
      deleted++;
    }

    nextPageToken = page.pageToken;
  } while (nextPageToken);

  console.log(`Deleted Firebase Auth users except admin@able.local: ${deleted}`);
}

async function clearNonAdminUserDocs() {
  const snap = await db.collection('users').get();
  let deleted = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.email !== 'admin@able.local') {
      await doc.ref.delete();
      deleted++;
    }
  }

  console.log(`Cleared non-admin user profiles: ${deleted}`);
}

async function clearStorage() {
  try {
    const [files] = await bucket.getFiles();
    for (const file of files) await file.delete();
    console.log(`Cleared Storage files: ${files.length}`);
  } catch (e) {
    console.log('Storage cleanup skipped:', e.message);
  }
}

console.log('\nKARP Firebase reset');
console.log('This deletes old content, old non-admin accounts, legacy user profiles, and Storage files.');
console.log('The Firebase admin@able.local account is preserved.\n');

await deleteNonAdminUsers();
await clearNonAdminUserDocs();

for (const name of CONTENT_COLLECTIONS) {
  await deleteCollection(name);
}

await clearStorage();

console.log('\nRESET COMPLETE.');
console.log('Firebase is now ready for fresh KARP content.\n');
