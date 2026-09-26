const test=require('node:test');
const assert=require('node:assert/strict');
const {validate}=require('../data.js');

const prices={
  Suture:{sss:200,private:300,active:true},
  Hidden:{sss:50,private:75,active:false}
};
const base={id:123,ts:'2026-09-19T01:02:03+07:00',procedure:'Suture',right:'sss',qty:2,unit:200,total:400,note:''};

test('normalizes legacy numeric ids/timestamps and preserves both coverage types',()=>{
  const out=validate({prices,entries:[base,{...base,id:'abc_2',right:'private',unit:300,total:600}]});
  assert.equal(out.entries[0].id,'123');
  assert.equal(out.entries[0].ts,'2026-09-18T18:02:03.000Z');
  assert.deepEqual(out.entries.map(e=>e.right),['sss','private']);
  assert.equal(out.entries[1].total,600);
  assert.deepEqual(out.entries.map(e=>e.payRate),[0.5,0.8]);
  assert.deepEqual(out.entries.map(e=>e.netTotal),[200,480]);
});

test('rejects mismatched financial totals',()=>{
  assert.throws(()=>validate({prices,entries:[{...base,total:399}]}),/ยอดรวมเดิม/);
  assert.throws(()=>validate({prices,entries:[{...base,payRate:0.8}]}),/อัตราจ่ายเดิม/);
  assert.throws(()=>validate({prices,entries:[{...base,netTotal:399}]}),/ยอดรับจริงเดิม/);
});

test('rejects duplicate or malformed entries',()=>{
  assert.throws(()=>validate({prices,entries:[base,{...base}]}),/รหัสซ้ำ/);
  assert.throws(()=>validate({prices,entries:[{...base,id:'bad id'}]}),/รายการไม่ถูกต้อง/);
  assert.throws(()=>validate({prices,entries:[{...base,id:'x',right:'other'}]}),/รายการไม่ถูกต้อง/);
});

test('preserves hidden catalog items and historical names not in catalog',()=>{
  const out=validate({prices,entries:[{...base,id:'h',procedure:'Old historical name'}]});
  assert.equal(out.prices.Hidden.active,false);
  assert.equal(out.entries[0].procedure,'Old historical name');
});

test('rejects prototype-polluting catalog names',()=>{
  const unsafe=Object.create(null); unsafe.constructor={sss:1,private:1};
  assert.throws(()=>validate({prices:unsafe,entries:[]}),/ตารางราคา/);
});
