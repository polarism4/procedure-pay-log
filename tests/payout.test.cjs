const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync(require.resolve('../index.html'),'utf8');

test('dashboard and entry form present actual payment beside full DF',()=>{
  assert.match(html,/รับจริงวันนี้/);
  assert.match(html,/DF เต็ม/);
  assert.match(html,/ปกส\. 50%/);
  assert.match(html,/ทั่วไป\/ประกัน 80%/);
  assert.match(html,/function actualTotal\(e\)/);
});

test('CSV exports gross DF, payout rate, and actual payment',()=>{
  assert.match(html,/DF ต่อครั้ง/);
  assert.match(html,/อัตราจ่าย/);
  assert.match(html,/ยอดรับจริง/);
  assert.match(html,/actualTotal\(e\)/);
});
