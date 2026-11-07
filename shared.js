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
(document.querySelector('.table-tools .toolbar') || reloadButton.parentElement).append(archiveButton);
archiveButton.onclick = () => {
  try { api.downloadBackup(JSON.parse(localStorage.getItem('pocolog.before-shared.v1'))); }
  catch { message('接続前の記録を読み出せませんでした。'); }
};
const startupBackupKey = 'pocolog.before-auto-load.v1';
const startupBackupButton = document.createElement('button');
startupBackupButton.textContent = '自動読込前の入力を保存';
startupBackupButton.hidden = !localStorage.getItem(startupBackupKey);
(document.querySelector('.table-tools .toolbar') || reloadButton.parentElement).append(startupBackupButton);
startupBackupButton.onclick = () => {
  try { api.downloadBackup(JSON.parse(localStorage.getItem(startupBackupKey))); }
  catch { message('自動読込前の入力を読み出せませんでした。'); }
};
const state = new SharedState();
const pendingKey = 'pocolog.pending.v1', revisionKey = 'pocolog.shared-revision.v1';
const local = api.localBookState();
try {
  if (local.edited || (local.valid && localStorage.getItem(pendingKey) === '1')) {
    const revision = Number(localStorage.getItem(revisionKey));
    state.revision = Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
    state.edit();
  }
} catch {}
const startupGeneration = state.generation;
let firstServerSnapshot = true, appliedRecord = null, serverConfirmed = false;
const sameRecord = (a, b) => Boolean(a && b && a.revision === b.revision && a.payload === b.payload);
function retainSyncState(revision, clean) {
  try {
    localStorage.setItem(revisionKey, String(revision));
    if (clean) localStorage.removeItem(pendingKey);
  } catch {}
}

let connected = false, busy = false, ref;
function message(text, synced = false) {
  status.textContent = synced ? '同期済' : '未同期';
  status.title = text;status.dataset.synced = String(synced);
  const detail = document.getElementById('syncDetailText');if (detail) detail.textContent = text;
}
function buttons() { saveButton.disabled = !connected || busy; reloadButton.disabled = !connected || busy; }
function backupLocal() {
  // Preserve the old local record before showing the shared table.
  const key = 'pocolog.before-shared.v1';
  if (!localStorage.getItem(key)) localStorage.setItem(key, api.getPayload());
  archiveButton.hidden = false;
}
function apply(record, beforeApply = backupLocal) {
  const migrated = api.setBookPayload(record.payload, beforeApply);
  state.latest = record;
  state.accept();
  appliedRecord = record;
  if (migrated) {
    state.edit();
    localStorage.setItem(pendingKey, '1');
  }
  retainSyncState(record.revision, !migrated);
  message(migrated ? '不足するアカウントを追加しました。「保存」で反映できます。' :
    serverConfirmed ? '共有先と同期済み' : '最後に確認した共有記録を読み込みました。', !migrated && serverConfirmed);
  return migrated;
}
function read(snapshot) {
  if (!snapshot.exists()) return null;
  const record = snapshot.data();
  if (!Number.isSafeInteger(record.revision) || record.revision < 1 || typeof record.payload !== 'string') {
    throw Error('共有データの形式を確認できません。');
  }
  return record;
}
window.addEventListener('pocolog:edit', () => {
  state.edit();
  if (connected) message('未共有の変更があります。「保存」を押してください。');
});
saveButton.onclick = async () => {
  if (!connected || busy) return;
  if (!state.dirty && serverConfirmed && sameRecord(state.latest, appliedRecord)) {
    message('変更はありません。共有先と同期済みです。', true);
    return;
  }
  busy = true; buttons(); message('共有先に保存中…');
  try {
    const payload = api.getPayload();
    if (new TextEncoder().encode(payload).length > 700000) throw Error('記録が大きすぎます。バックアップを保存してください。');
    const clean = await state.save(payload, (expected, body) => runTransaction(ref.firestore, async tx => {
      const snapshot = await tx.get(ref);
      const actual = snapshot.exists() ? snapshot.data().revision : 0;
      if (actual !== expected) throw Error('他の人が更新しました。バックアップを保存し、「読込」で確認してください。');
      const revision = actual + 1;
      tx.set(ref, { revision, payload: body, updatedAt: serverTimestamp() });
      return revision;
    }));
    serverConfirmed = true;
    appliedRecord = { revision: state.revision, payload };
    if (!state.latest || state.latest.revision <= state.revision) state.latest = appliedRecord;
    retainSyncState(state.revision, clean);
    message(clean ? '共有先に保存しました' : '保存中に追加した変更が未共有です。もう一度保存してください。', clean && (!state.latest || state.latest.revision <= state.revision));
  } catch (error) { message(`共有保存できませんでした。${error.message} 入力はこのブラウザに残っています。`); }
  finally { busy = false; buttons(); }
};
reloadButton.onclick = () => {
  if (!connected || busy) return;
  if (!state.latest) {
    message('共有の記録はまだありません。現在の入力を保存できます。');
    return;
  }
  if (!state.dirty && sameRecord(state.latest, appliedRecord)) {
    message(serverConfirmed ? '最新版を表示しています。' : '最後に確認した共有記録を表示しています。', serverConfirmed);
    return;
  }
  if (state.dirty) {
    if (!confirm('未共有の入力をバックアップ保存してから、共有の最新版に置き換えますか？')) return;
    api.downloadBackup();
  }
  try { apply(state.latest); }
  catch (error) { message(error.message); }
};
window.addEventListener('beforeunload', event => { if (state.dirty && connected) { event.preventDefault(); event.returnValue = ''; } });

async function start() {
  const config = window.POCOLOG_FIREBASE_CONFIG;
  buttons();
  if (!config) { message('共有保存は未接続です。現在はこのブラウザへの保存です。'); return; }
  message('共有の最新版を自動読込中…');
  const waiting = setTimeout(() => {
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
        serverConfirmed = false;
        message('共有先の確認待ちです。オフラインの場合、入力はブラウザに保存されます。'); return;
      }
      try {
        clearTimeout(waiting);
        const record = read(snapshot);
        const first = firstServerSnapshot;
        firstServerSnapshot = false;
        serverConfirmed = true;
        if (first && record && state.dirty && !local.edited && state.generation === startupGeneration) {
          // Edits made after opening, including before this module loads, must survive startup.
          state.receive(record);
          const migrated = apply(record, () => {
            try {
              localStorage.setItem(startupBackupKey, api.getPayload());
              startupBackupButton.hidden = false;
            } catch {
              throw Error('未共有入力のバックアップを保存できないため、自動読込を保留しました。入力は保持しています。');
            }
            backupLocal();
          });
          message(migrated?'最新版を自動読込しました。不足するアカウントの追加は「保存」で反映できます。':'最新版を自動読込しました。以前の未共有入力は「その他」から保存できます。', !migrated);
        } else if (state.dirty) {
          state.receive(record);
          if ((record?.revision ?? 0) !== state.revision) message('共有先に更新があります。未共有の入力を確認してから最新版を読み込んでください。');
          else message('未共有の入力を復元しました。「保存」で反映できます。');
        } else if (!record) {
          state.receive(null);appliedRecord=null;retainSyncState(0,true);
          message('共有の記録はまだありません。「保存」で現在の表を登録できます。');
        } else if (sameRecord(record, appliedRecord) || (first && record.payload === api.getPayload())) {
          appliedRecord=record;state.receive(record);retainSyncState(record.revision,true);
          message('共有先と同期済み',true);
        } else {
          apply(record);
        }
        connected = true; buttons();
      } catch (error) {
        // A failed load must not advance the revision of the local book.
        serverConfirmed = false;
        connected = Boolean(state.latest);
        buttons();message(error.message);
      }
    }, error => {
      clearTimeout(waiting);
      connected = false; serverConfirmed = false; buttons();
      message(`共有先に接続できません。このブラウザへの保存を続けられます。${error.code}`);
    });
  } catch (error) {
    clearTimeout(waiting);
    if (['auth/admin-restricted-operation', 'auth/operation-not-allowed'].includes(error.code)) {
      message('共有編集のログイン設定がまだ完了していません。入力はこのブラウザに保存できます。');
    } else {
      message(`共有先に接続できません。このブラウザへの保存です。${error.code || error.message}`);
    }
  }
}
window.addEventListener('offline', () => { serverConfirmed = false; if (connected) message('オフラインです。入力はこのブラウザに保存し、共有保存は接続後に行ってください。'); });
start();
