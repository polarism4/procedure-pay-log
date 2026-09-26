/* Optional cloud layer; the original quick-entry UI stays local and immediate. */
let cloud=null, account=null, cloudState=null, busy=false, syncing=false, scheduled=false;
const cloudStatus=message=>document.getElementById('cloudStatus').textContent=message;
const snapshot=()=>PayLogData.validate({entries,prices});
const cacheKey=()=>`proc_cloud_v1_${account}`;
function persistData(){
  const data=snapshot();
  if(account){
    cloudState={...cloudState,...data,dirty:true};
    localStorage.setItem(cacheKey(),JSON.stringify(cloudState));
    cloudStatus('บันทึกในเครื่องแล้ว · รอซิงก์');
    if(!scheduled){scheduled=true;queueMicrotask(()=>{scheduled=false;syncCloud();});}
  }else{
    localStorage.setItem(K_ENTRIES,JSON.stringify(data.entries));
    localStorage.setItem(K_PRICES,JSON.stringify(data.prices));
  }
}
function applyData(data){
  const checked=PayLogData.validate(data);entries=checked.entries;prices=checked.prices;
  editingId=null;selectedProcedure=getFrequentOrder()[0]||'';
  renderDashboard();renderHistory();renderPrices();renderProcedureGrid();go('dashboard');
}
async function syncCloud(){
  if(!account || syncing || busy)return;
  syncing=true;
  let succeeded=false;
  try{
    if(cloudState.dirty){
      const sent=JSON.stringify(snapshot());
      const {data,error}=await cloud.rpc('save_pay_log',{expected_revision:cloudState.revision,payload:JSON.parse(sent)});
      if(error)throw error;
      cloudState.revision=Number(data);
      cloudState.dirty=JSON.stringify(snapshot())!==sent;
      localStorage.setItem(cacheKey(),JSON.stringify(cloudState));
      cloudStatus(cloudState.dirty?'รอซิงก์รายการใหม่':'ซิงก์แล้ว');
    }else cloudStatus('ซิงก์แล้ว');
    succeeded=true;
  }catch(e){
    cloudStatus(String(e.message).includes('REVISION_CONFLICT')?'ข้อมูลอีกอุปกรณ์เปลี่ยนแล้ว · Backup ข้อมูลในเครื่องก่อน แล้วกดโหลดจาก Cloud':'ยังไม่ซิงก์ · ข้อมูลอยู่ในเครื่อง กดซิงก์เพื่อลองใหม่');
  }finally{syncing=false;if(succeeded&&cloudState.dirty)queueMicrotask(syncCloud);}
}
async function refreshCloud(){
  if(!account || syncing || busy)return;
  if(cloudState.dirty && !confirm('มีข้อมูลในเครื่องที่ยังไม่ซิงก์ กรุณา Backup ก่อน\nโหลด Cloud จะแทนข้อมูลบัญชีนี้ในเครื่อง ต้องการดำเนินการ?'))return;
  busy=true;
  try{
    const {data,error}=await cloud.rpc('load_pay_log');if(error)throw error;
    if(cloudState.dirty) localStorage.setItem(cacheKey()+'_before_reload',JSON.stringify(cloudState));
    cloudState={...PayLogData.validate(data),revision:Number(data.revision),dirty:false};
    localStorage.setItem(cacheKey(),JSON.stringify(cloudState));applyData(cloudState);cloudStatus('โหลด Cloud แล้ว');
  }catch(e){cloudStatus('โหลดไม่สำเร็จ · '+e.message);}finally{busy=false;}
}
async function loginCloud(event){
  event.preventDefault();if(busy||syncing||account)return;
  busy=true;
  try{
    if(!cloud)throw Error('ยังไม่ได้ตั้งค่า Supabase');
    const {data,error}=await cloud.auth.signInWithPassword({email:document.getElementById('cloudEmail').value,password:document.getElementById('cloudPassword').value});
    document.getElementById('cloudPassword').value='';if(error)throw error;
    const owner=data.user.id;
    const cachedRaw=localStorage.getItem(`proc_cloud_v1_${owner}`);
    let next;
    if(cachedRaw){
      const cached=JSON.parse(cachedRaw);PayLogData.validate(cached);
      if(cached.dirty) next=cached;
    }
    if(!next){
      const result=await cloud.rpc('load_pay_log');if(result.error)throw result.error;
      next={...PayLogData.validate(result.data),revision:Number(result.data.revision),dirty:false};
      localStorage.setItem(`proc_cloud_v1_${owner}`,JSON.stringify(next));
    }
    account=owner;cloudState=next;applyData(next);
    document.getElementById('cloudActions').hidden=false;
    document.getElementById('cloudLogin').hidden=true;
    cloudStatus(next.dirty?'มีข้อมูลในเครื่องรอซิงก์':'เข้าสู่ระบบแล้ว · '+data.user.email);
    if(next.dirty)queueMicrotask(syncCloud);
  }catch(e){cloudStatus('เข้าสู่ระบบไม่สำเร็จ · '+e.message);}finally{busy=false;}
}
async function restoreCloudLogin(){
  const {data,error}=await cloud.auth.getSession();if(error)throw error;
  const user=data.session?.user;if(!user)return false;
  const owner=user.id;
  const cachedRaw=localStorage.getItem(`proc_cloud_v1_${owner}`);
  let next;
  if(cachedRaw){
    const cached=JSON.parse(cachedRaw);PayLogData.validate(cached);next=cached;
  }else{
    const result=await cloud.rpc('load_pay_log');if(result.error)throw result.error;
    next={...PayLogData.validate(result.data),revision:Number(result.data.revision),dirty:false};
    localStorage.setItem(`proc_cloud_v1_${owner}`,JSON.stringify(next));
  }
  account=owner;cloudState=next;applyData(next);
  document.getElementById('cloudActions').hidden=false;
  document.getElementById('cloudLogin').hidden=true;
  cloudStatus(next.dirty?'กลับเข้าสู่บัญชีแล้ว · มีข้อมูลในเครื่องรอซิงก์':'เข้าสู่ระบบอัตโนมัติแล้ว · '+user.email);
  if(next.dirty)queueMicrotask(syncCloud);
  return true;
}

async function logoutCloud(){
  if(busy||syncing)return;
  if(cloudState?.dirty){cloudStatus('กรุณาซิงก์หรือ Backup ข้อมูลที่ค้างก่อนออกจากระบบ');return;}
  busy=true;
  try{
    const {error}=await cloud.auth.signOut({scope:'local'});if(error)throw error;
    localStorage.removeItem(cacheKey());account=null;cloudState=null;
    applyData({entries:loadFirst([K_ENTRIES,...OLD_ENTRIES])||[],prices:loadFirst([K_PRICES,...OLD_PRICES])||defaults});
    document.getElementById('cloudActions').hidden=true;document.getElementById('cloudLogin').hidden=false;cloudStatus('ใช้ข้อมูลในเครื่อง');
  }catch(e){cloudStatus(e.message);}finally{busy=false;}
}
function downloadMigrationBackup(data){
  const payload={app:'Procedure Pay Log',version:'1.1',exportedAt:new Date().toISOString(),purpose:'pre-cloud-migration',entries:data.entries,prices:data.prices};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`procedure-pay-log-pre-cloud-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function migrateLocal(){
  if(!account||busy||syncing)return;
  if(cloudState.revision!==0 || entries.length || Object.keys(prices).length){cloudStatus('นำเข้าได้เฉพาะบัญชี Cloud ว่าง เพื่อป้องกันข้อมูลซ้ำหรือเขียนทับ');return;}
  try{
    const data=PayLogData.validate({entries:loadFirst([K_ENTRIES,...OLD_ENTRIES])||[],prices:loadFirst([K_PRICES,...OLD_PRICES])||defaults});
    if(!confirm(`นำเข้า ${data.entries.length} รายการ จากเครื่องนี้เข้าบัญชีที่เข้าสู่ระบบ?\nระบบจะดาวน์โหลด Backup ก่อนนำเข้า`))return;
    localStorage.setItem('proc_pre_cloud_backup_v1',JSON.stringify(data));
    downloadMigrationBackup(data);
    applyData(data);persistData();
  }catch(e){cloudStatus(e.message);}
}
(async()=>{
  const config=window.PAY_LOG_CONFIG;
  if(!config?.url||!config?.publishableKey){cloudStatus('โหมดในเครื่อง · ยังไม่ได้ตั้งค่า Cloud');return;}
  try{
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.102.0');
    cloud=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storage:window.localStorage}});
    busy=true;
    try{
      if(!await restoreCloudLogin())cloudStatus('Cloud พร้อม · เข้าสู่ระบบเพื่อเปิดข้อมูลบัญชี');
    }finally{busy=false;}
  }catch(e){cloudStatus('เชื่อมต่อ Cloud ไม่ได้ · ยังใช้ข้อมูลในเครื่องได้');}
})();
window.addEventListener('online',()=>syncCloud());
