(function(root){
  const PAYOUT_RATES=Object.freeze({sss:0.5,private:0.8});
  const rounded=n=>Math.round(n*100)/100;
  const rateFor=right=>PAYOUT_RATES[right];
  function validate(data){
    if(!data || !Array.isArray(data.entries) || !data.prices || typeof data.prices!=='object' || Array.isArray(data.prices)) throw Error('ข้อมูลไม่ถูกต้อง');
    const amount=n=>typeof n==='number' && Number.isFinite(n) && n>=0 && n<1e10 && Math.abs(n*100-Math.round(n*100))<0.0001;
    const name=n=>typeof n==='string' && n.trim().length>0 && n.length<=200 && !['__proto__','constructor','prototype'].includes(n);
    const ids=new Set();
    const entries=data.entries.map(e=>{
      if(!e || !/^[a-zA-Z0-9_-]{1,100}$/.test(String(e.id)) || ids.has(String(e.id)) || !name(e.procedure) || !['sss','private'].includes(e.right) || !Number.isInteger(e.qty) || e.qty<1 || e.qty>1000000 || !amount(e.unit) || !Number.isFinite(Date.parse(e.ts)) || (e.note!=null && (typeof e.note!=='string' || e.note.length>5000))) throw Error('รายการไม่ถูกต้อง หรือมีรหัสซ้ำ');
      ids.add(String(e.id));
      const total=rounded(e.qty*e.unit);
      if(e.total!==undefined && Math.abs(e.total-total)>0.005) throw Error('ยอดรวมเดิมไม่ตรงกับจำนวน × ราคา กรุณาตรวจ Backup');
      const payRate=rateFor(e.right);
      const netTotal=rounded(total*payRate);
      if(e.payRate!==undefined && (typeof e.payRate!=='number' || !Number.isFinite(e.payRate) || Math.abs(e.payRate-payRate)>0.000001)) throw Error('อัตราจ่ายเดิมไม่ตรงกับสิทธิ์ กรุณาตรวจ Backup');
      if(e.netTotal!==undefined && (typeof e.netTotal!=='number' || !Number.isFinite(e.netTotal) || Math.abs(e.netTotal-netTotal)>0.005)) throw Error('ยอดรับจริงเดิมไม่ตรงกับ DF × อัตราจ่าย กรุณาตรวจ Backup');
      return {...e,id:String(e.id),ts:new Date(e.ts).toISOString(),total,payRate,netTotal,note:e.note||''};
    });
    const prices=Object.create(null);
    for(const [n,p] of Object.entries(data.prices)){
      if(!name(n) || !p || !amount(p.sss) || !amount(p.private) || (p.active!==undefined && typeof p.active!=='boolean')) throw Error('ตารางราคาไม่ถูกต้อง');
      prices[n]={sss:p.sss,private:p.private,active:p.active!==false};
    }
    return {entries,prices};
  }
  root.PayLogData={validate,PAYOUT_RATES,rateFor};
  if(typeof module!=='undefined') module.exports=root.PayLogData;
})(globalThis);
