import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, runTransaction, serverTimestamp, connectFirestoreEmulator } from 'firebase/firestore';
import { SharedState } from './shared-state.mjs';

const api = window.pocolog;
const status = document.getElementById('sharedStatus');
const saveButton = document.getElementById('sharedSave');
const reloadButton = document.getElementById('sharedReload');
const archiveButton = document.createElement('button');
archiveButton.textContent = '接続前の記録を保存';
archiveButton.hidden = !localStorage.getItem('pocolog.before-shared.v1');
reloadButton.after(archiveButton);
archiveButton.onclick = () => {
  try { api.downloadBackup(JSON.parse(localStorage.getItem('pocolog.before-shared.v1'))); }
  catch { message('接続前の記録を読み出せませんでした。'); }
};
const state = new SharedState();
let connected = false, busy = false, ref;
function message(text) { status.textContent = text; }
function buttons() { saveButton.disabled = !connected || busy; reloadButton.disabled = !connected || busy; }
function backupLocal() {
  // Preserve the old local record before showing the shared table.
  const key = 'pocolog.before-shared.v1';
  if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(api.getBook()));
  archiveButton.hidden = false;
}
function apply(record) {
  if (!record) { message('共有の記録はまだありません。「共有先に保存」で現在の表を登録できます。'); return; }
  const next = JSON.parse(record.payload);
  if (!api.validBook(next)) throw Error('共有データの形式を確認できません。');
  backupLocal();
  api.setBook(next);
  message('共有先と同期済み');
}
function read(snapshot) {
  if (!snapshot.exists()) return null;
  const record = snapshot.data();
  if (!Number.isSafeInteger(record.revision) || record.revision < 1 || typeof record.payload !== 'string' || !api.validBook(JSON.parse(record.payload))) {
    throw Error('共有データの形式を確認できません。');
  }
  return record;
}
window.addEventListener('pocolog:edit', () => {
  state.edit();
  if (connected) message('未共有の変更があります。「共有先に保存」を押してください。');
});
saveButton.onclick = async () => {
  if (!connected || busy) return;
  busy = true; buttons(); message('共有先に保存中…');
  try {
    const payload = JSON.stringify(api.getBook());
    if (new TextEncoder().encode(payload).length > 700000) throw Error('記録が大きすぎます。バックアップを保存してください。');
    const clean = await state.save(payload, (expected, body) => runTransaction(ref.firestore, async tx => {
      const snapshot = await tx.get(ref);
      const actual = snapshot.exists() ? snapshot.data().revision : 0;
      if (actual !== expected) throw Error('他の人が更新しました。バックアップを保存し、「共有の最新版を読込」で確認してください。');
      const revision = actual + 1;
      tx.set(ref, { revision, payload: body, updatedAt: serverTimestamp() });
      return revision;
    }));
    if (!state.latest || state.latest.revision <= state.revision) {
      state.latest = { revision: state.revision, payload };
    }
    message(clean ? '共有先に保存しました' : '保存中に追加した変更が未共有です。もう一度保存してください。');
  } catch (error) { message(`共有保存できませんでした。${error.message} 入力はこのブラウザに残っています。`); }
  finally { busy = false; buttons(); }
};
reloadButton.onclick = () => {
  if (!connected || busy) return;
  if (state.dirty) {
    if (!confirm('未共有の入力をバックアップ保存してから、共有の最新版に置き換えますか？')) return;
    api.downloadBackup();
  }
  try {
    // Validate and preserve the pending data before discarding the dirty flag.
    if (state.latest) { backupLocal(); apply(state.latest); state.accept(); }
    else message('共有の記録はまだありません。現在の入力を保存できます。');
  } catch (error) { message(error.message); }
};
window.addEventListener('beforeunload', event => { if (state.dirty && connected) { event.preventDefault(); event.returnValue = ''; } });

async function start() {
  const config = window.POCOLOG_FIREBASE_CONFIG;
  buttons();
  if (!config) { message('共有保存は未接続です。現在はこのブラウザへの保存です。'); return; }
  message('共有先に接続中…');
  api.setEditing(false);
  const waiting = setTimeout(() => {
    api.setEditing(true);
    message('共有先の応答を待っています。入力はこのブラウザに保存できます。');
  }, 15000);
  try {
    const app = initializeApp(config);
    const auth = getAuth(app);
    const db = getFirestore(app);
    // Only local test origins may connect to the Firebase emulators.
    if (['127.0.0.1', 'localhost'].includes(location.hostname) && window.POCOLOG_USE_EMULATORS) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    await signInAnonymously(auth);
    ref = doc(db, 'pocolog', 'shared');
    onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
      // Local cached or pending writes do not prove server synchronization.
      if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) {
        message('共有先の確認待ちです。オフラインの場合、入力はブラウザに保存されます。'); return;
      }
      try {
        clearTimeout(waiting);
        const record = read(snapshot);
        if (state.receive(record)) apply(record);
        else if ((record?.revision ?? 0) !== state.revision) message('共有先に更新があります。未共有の入力を確認してから最新版を読み込んでください。');
        connected = true; api.setEditing(true); buttons();
      } catch (error) { connected = false; api.setEditing(true); buttons(); message(error.message); }
    }, error => {
      clearTimeout(waiting);
      connected = false; api.setEditing(true); buttons();
      message(`共有先に接続できません。このブラウザへの保存を続けられます。${error.code}`);
    });
  } catch (error) {
    clearTimeout(waiting);
    api.setEditing(true); message(`共有先に接続できません。このブラウザへの保存です。${error.code || error.message}`);
  }
}
window.addEventListener('offline', () => { if (connected) message('オフラインです。入力はこのブラウザに保存し、共有保存は接続後に行ってください。'); });
start();
