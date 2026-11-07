import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { SharedState } from '../shared-state.mjs';

const source=(await readFile(new URL('../shared.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
async function setup({pending=false,failBackup=false,migrated=false,earlyEdit=false,failInstall=false}={}){
 const local={version:2,name:'local'},remote={version:2,name:'shared'};
 const storage=new Map([['pocolog.v1',JSON.stringify(local)],['pocolog.shared-revision.v1','3']]);if(pending)storage.set('pocolog.pending.v1','1');
 const elements=new Map(),listeners={},loaded=[],downloads=[];let current=local,receive,error,transactions=0;
 const element=()=>({hidden:false,disabled:false,textContent:'',dataset:{},append(){}});
 const document={getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,querySelector:()=>element()};
 const localStorage={getItem:key=>storage.get(key)??null,setItem(key,value){if(failBackup&&key==='pocolog.before-auto-load.v1')throw Error('quota');storage.set(key,value);},removeItem:key=>storage.delete(key)};
 const api={
  localBookState:()=>({valid:true,edited:earlyEdit}),
  getPayload:()=>JSON.stringify(current),
  setBookPayload(payload,beforeApply){
   const book=JSON.parse(payload);
   if(book?.version!==2)throw Error('invalid');
   beforeApply();
   if(failInstall)throw Error('端末に保存できません');
   current=structuredClone(book);loaded.push(book);storage.set('pocolog.v1',payload);return migrated;
  },
  downloadBackup:book=>downloads.push(book??current)
 };
 const window={pocolog:api,POCOLOG_FIREBASE_CONFIG:{projectId:'fixture'},addEventListener:(name,fn)=>listeners[name]=fn};
 vm.runInNewContext(source,{window,document,localStorage,SharedState,TextEncoder,location:{hostname:'test.invalid'},setTimeout:()=>1,clearTimeout(){},confirm:()=>true,initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),signInAnonymously:async()=>{},doc:()=>({}),onSnapshot(ref,options,next,fail){receive=next;error=fail;},runTransaction(){transactions++;throw Error('unexpected write');},serverTimestamp:()=>0});
 await new Promise(resolve=>setImmediate(resolve));
 return {storage,elements,loaded,downloads,edit:()=>listeners['pocolog:edit'](),snapshot(record={revision:7,payload:JSON.stringify(remote)},metadata={fromCache:false,hasPendingWrites:false}){receive({exists:()=>!!record,data:()=>record,metadata});},fail:()=>error({code:'unavailable'}),get current(){return current;},get transactions(){return transactions;},local,remote};
}

test('startup loads server data automatically, without a click or remote write',async()=>{
 const h=await setup();h.snapshot();assert.equal(h.elements.get('sharedStatus').textContent,'同期済');assert.deepEqual(h.current,h.remote);assert.equal(h.elements.get('sharedReload').disabled,false);assert.equal(h.storage.get('pocolog.shared-revision.v1'),'7');assert.equal(h.storage.has('pocolog.pending.v1'),false);
});
test('startup pending input is backed up before loading latest, with a downloadable recovery',async()=>{
 const h=await setup({pending:true});h.snapshot();assert.deepEqual(JSON.parse(h.storage.get('pocolog.before-auto-load.v1')),h.local);assert.deepEqual(h.current,h.remote);assert.equal(h.storage.has('pocolog.pending.v1'),false);h.edit();h.snapshot({revision:8,payload:JSON.stringify({version:2,name:'new remote'})});assert.deepEqual(h.current,h.remote);assert.match(h.elements.get('syncDetailText').textContent,/未共有/);
});
test('new edits while connecting, cached data, absent records and invalid data cannot overwrite input',async()=>{
 const h=await setup({pending:true});h.snapshot(undefined,{fromCache:true,hasPendingWrites:false});assert.deepEqual(h.current,h.local);h.edit();h.snapshot();assert.deepEqual(h.current,h.local);assert.equal(h.storage.get('pocolog.pending.v1'),'1');assert.equal(h.storage.has('pocolog.before-auto-load.v1'),false);
 const empty=await setup({pending:true});empty.snapshot(null);assert.deepEqual(empty.current,empty.local);assert.equal(empty.storage.get('pocolog.pending.v1'),'1');
 const bad=await setup({pending:true});bad.snapshot({revision:7,payload:'invalid json'});assert.deepEqual(bad.current,bad.local);assert.equal(bad.storage.get('pocolog.pending.v1'),'1');
});
test('backup failure or connection failure preserves pending input and manual recovery remains available',async()=>{
 const h=await setup({pending:true,failBackup:true});h.snapshot();assert.equal(h.elements.get('sharedStatus').textContent,'未同期');assert.deepEqual(h.current,h.local);assert.equal(h.storage.get('pocolog.pending.v1'),'1');assert.equal(h.elements.get('sharedReload').disabled,false);assert.match(h.elements.get('syncDetailText').textContent,/自動読込を保留/);
 const offline=await setup({pending:true});offline.fail();assert.deepEqual(offline.current,offline.local);assert.equal(offline.storage.get('pocolog.pending.v1'),'1');
});
test('migrations after automatic load remain pending at the received revision',async()=>{
 const h=await setup({pending:true,migrated:true});h.snapshot();assert.deepEqual(h.current,h.remote);assert.equal(h.storage.get('pocolog.pending.v1'),'1');assert.equal(h.storage.get('pocolog.shared-revision.v1'),'7');h.snapshot({revision:8,payload:JSON.stringify({version:2,name:'later'})});assert.deepEqual(h.current,h.remote);
});

test('identical startup, repeated server snapshot, save and load avoid unnecessary work',async()=>{
 const h=await setup();
 const record={revision:7,payload:JSON.stringify(h.local)};
 h.snapshot(record);
 h.snapshot({...record});
 await h.elements.get('sharedSave').onclick();
 h.elements.get('sharedReload').onclick();
 assert.equal(h.transactions,0);
 assert.equal(h.loaded.length,0);
 assert.equal(h.storage.get('pocolog.shared-revision.v1'),'7');
 h.snapshot({revision:8,payload:JSON.stringify(h.remote)});
 h.snapshot({revision:8,payload:JSON.stringify(h.remote)});
 assert.equal(h.loaded.length,1);
 assert.deepEqual(h.current,h.remote);
});
test('input made before the sync module loads is never replaced by startup',async()=>{
 const h=await setup({pending:true,earlyEdit:true});
 h.snapshot();
 assert.deepEqual(h.current,h.local);
 assert.equal(h.loaded.length,0);
 assert.equal(h.storage.get('pocolog.shared-revision.v1'),'3');
 assert.equal(h.storage.get('pocolog.pending.v1'),'1');
});
test('a failed local install keeps the old book and revision',async()=>{
 const h=await setup({pending:true,failInstall:true});
 h.snapshot();
 assert.deepEqual(h.current,h.local);
 assert.equal(h.storage.get('pocolog.shared-revision.v1'),'3');
 assert.equal(h.storage.get('pocolog.pending.v1'),'1');
 assert.match(h.elements.get('syncDetailText').textContent,/保存できません/);
});

test('a newer revision with identical data updates the base without repainting',async()=>{
 const h=await setup();
 const payload=JSON.stringify(h.remote);
 h.snapshot({revision:7,payload});
 h.snapshot({revision:8,payload});
 assert.equal(h.loaded.length,1);
 assert.equal(h.storage.get('pocolog.shared-revision.v1'),'8');
 await h.elements.get('sharedSave').onclick();
 assert.equal(h.transactions,0);
});
test('refresh preserves pending input when the server is still at its base revision',async()=>{
 const h=await setup({pending:true});
 h.snapshot({revision:3,payload:JSON.stringify(h.remote)});
 assert.deepEqual(h.current,h.local);
 assert.equal(h.storage.has('pocolog.before-auto-load.v1'),false);
 assert.equal(h.storage.get('pocolog.pending.v1'),'1');
});
