const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {validate}=require('../data.js');
const source=fs.readFileSync(require.resolve('../cloud.js'),'utf8');

function makeContext({cache={},guestEntries=[],guestPrices={Guest:{sss:1,private:2,active:true}},rpc,confirmResult=true}={}){
  const store=new Map(Object.entries(cache));
  const els=new Map();
  const el=id=>{
    if(!els.has(id)) els.set(id,{id,textContent:'',value:'',hidden:false,click(){this.clicked=true;},remove(){},appendChild(){}});
    return els.get(id);
  };
  el('cloudEmail').value='user@example.com';el('cloudPassword').value='pw';
  const context={
    console,structuredClone,Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}},
    PayLogData:{validate}, entries:structuredClone(guestEntries), prices:structuredClone(guestPrices),
    K_ENTRIES:'proc_entries_v04',K_PRICES:'proc_prices_v04',OLD_ENTRIES:[],OLD_PRICES:[],defaults:structuredClone(guestPrices),
    editingId:null,selectedProcedure:'',
    localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    document:{getElementById:el,createElement:()=>({href:'',download:'',click(){this.clicked=true;},remove(){}}),body:{appendChild(){}}},
    window:{PAY_LOG_CONFIG:{},addEventListener(){}},
    confirm:()=>confirmResult,
    queueMicrotask:fn=>Promise.resolve().then(fn),
    getFrequentOrder:()=>Object.keys(context.prices),renderDashboard(){},renderHistory(){},renderPrices(){},renderProcedureGrid(){},go(){},
    loadFirst:keys=>{for(const k of keys){const v=store.get(k);if(v)return JSON.parse(v)}return null;},
  };
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(source+'\n;globalThis.__api={persistData,syncCloud,refreshCloud,loginCloud,logoutCloud,migrateLocal,applyData};',context,{filename:'cloud.js'});
  const cloud={
    auth:{
      signInWithPassword:async()=>({data:{user:{id:'u1',email:'user@example.com'}},error:null}),
      signOut:async()=>({error:null})
    },
    rpc:rpc|| (async name=> name==='load_pay_log'?{data:{revision:0,entries:[],prices:{}},error:null}:{data:1,error:null})
  };
  vm.runInContext('cloud=globalThis.__cloud',Object.assign(context,{__cloud:cloud}));
  return {context,store,els,cloud,api:context.__api,eval:code=>vm.runInContext(code,context)};
}

const p={A:{sss:10,private:20,active:true}};
const e={id:'x',ts:'2026-09-19T00:00:00Z',procedure:'A',right:'sss',qty:1,unit:10,total:10,note:''};

test('guest edits remain guest/local and are not uploaded merely by login',async()=>{
  let saves=0;
  const h=makeContext({guestEntries:[e],guestPrices:p,rpc:async name=>{if(name==='save_pay_log')saves++;return name==='load_pay_log'?{data:{revision:0,entries:[],prices:{}},error:null}:{data:1,error:null}}});
  h.store.set('proc_entries_v04',JSON.stringify([e]));h.store.set('proc_prices_v04',JSON.stringify(p));
  await h.api.loginCloud({preventDefault(){}});
  assert.equal(saves,0);
  assert.equal(h.eval('entries.length'),0);
  assert.equal(JSON.parse(h.store.get('proc_entries_v04')).length,1);
});

test('clean account cache is refreshed from cloud on login instead of showing stale data',async()=>{
  const cached={revision:1,dirty:false,entries:[e],prices:p};
  let loads=0;
  const remote={revision:2,entries:[{...e,id:'y',unit:20,total:20}],prices:p};
  const h=makeContext({cache:{proc_cloud_v1_u1:JSON.stringify(cached)},rpc:async name=>{if(name==='load_pay_log'){loads++;return {data:remote,error:null}};return {data:3,error:null}}});
  await h.api.loginCloud({preventDefault(){}});
  assert.equal(loads,1);
  assert.equal(h.eval('cloudState.revision'),2);
  assert.equal(h.eval('entries[0].id'),'y');
});

test('dirty account cache survives login and automatically retries sync',async()=>{
  const cached={revision:4,dirty:true,entries:[e],prices:p};
  let saves=0,loads=0;
  const h=makeContext({cache:{proc_cloud_v1_u1:JSON.stringify(cached)},rpc:async name=>{if(name==='load_pay_log'){loads++;return {data:{revision:9,entries:[],prices:{}},error:null}};saves++;return {data:5,error:null}}});
  await h.api.loginCloud({preventDefault(){}});
  await new Promise(r=>setImmediate(r));
  assert.equal(loads,0);
  assert.equal(saves,1);
  assert.equal(h.eval('cloudState.dirty'),false);
  assert.equal(h.eval('cloudState.revision'),5);
});

test('network failure keeps pending local changes dirty',async()=>{
  const cached={revision:1,dirty:true,entries:[e],prices:p};
  const h=makeContext({cache:{proc_cloud_v1_u1:JSON.stringify(cached)},rpc:async name=>name==='load_pay_log'?{data:{revision:1,entries:[e],prices:p},error:null}:{data:null,error:new Error('offline')}});
  h.eval("account='u1';cloudState="+JSON.stringify(cached)+";entries="+JSON.stringify([e])+";prices="+JSON.stringify(p));
  await h.api.syncCloud();
  assert.equal(h.eval('cloudState.dirty'),true);
  assert.match(h.els.get('cloudStatus').textContent,/ยังไม่ซิงก์/);
});

test('revision conflict is surfaced and does not clear pending state',async()=>{
  const cached={revision:1,dirty:true,entries:[e],prices:p};
  const h=makeContext({rpc:async()=>({data:null,error:new Error('REVISION_CONFLICT')})});
  h.eval("account='u1';cloudState="+JSON.stringify(cached)+";entries="+JSON.stringify([e])+";prices="+JSON.stringify(p));
  await h.api.syncCloud();
  assert.equal(h.eval('cloudState.dirty'),true);
  assert.match(h.els.get('cloudStatus').textContent,/อีกอุปกรณ์/);
});

test('edits made while a save is in flight remain dirty for a follow-up sync',async()=>{
  let resolveFirst;let calls=0;
  const h=makeContext({rpc:async name=>{if(name==='load_pay_log')return {data:{revision:0,entries:[],prices:{}},error:null};calls++;if(calls===1)return await new Promise(r=>resolveFirst=r);return {data:2,error:null}}});
  h.eval("account='u1';cloudState={revision:0,dirty:true,entries:[],prices:"+JSON.stringify(p)+"};entries=[];prices="+JSON.stringify(p));
  const first=h.api.syncCloud();
  await new Promise(r=>setImmediate(r));
  h.eval("entries.push("+JSON.stringify(e)+");cloudState={...cloudState,entries:structuredClone(entries),prices:structuredClone(prices),dirty:true};localStorage.setItem(cacheKey(),JSON.stringify(cloudState));");
  resolveFirst({data:1,error:null});
  await first; await new Promise(r=>setImmediate(r)); await new Promise(r=>setImmediate(r));
  assert.equal(calls,2);
  assert.equal(h.eval('cloudState.dirty'),false);
  assert.equal(h.eval('cloudState.revision'),2);
});
