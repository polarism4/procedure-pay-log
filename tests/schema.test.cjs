const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const sql=fs.readFileSync(require.resolve('../supabase/schema.sql'),'utf8');

test('schema enforces per-user RLS and removes anonymous/table write access',()=>{
  assert.match(sql,/enable row level security/g);
  assert.match(sql,/auth\.uid\(\).*user_id/s);
  assert.match(sql,/revoke all on public\.app_settings, public\.procedure_types, public\.procedure_entries from anon,authenticated/);
  assert.match(sql,/grant select on public\.app_settings, public\.procedure_types, public\.procedure_entries to authenticated/);
});

test('save RPC is authenticated, revision-locked, and derives ownership from auth.uid()',()=>{
  assert.match(sql,/security definer set search_path = ''/);
  assert.match(sql,/uid uuid := auth\.uid\(\)/);
  assert.match(sql,/for update/);
  assert.match(sql,/REVISION_CONFLICT/);
  assert.match(sql,/grant execute on function public\.save_pay_log\(bigint,jsonb\).*to authenticated/s);
});

test('database generates totals and constrains ids/financial ranges',()=>{
  assert.match(sql,/total numeric generated always as \(qty \* unit\) stored/);
  assert.match(sql,/id ~ '\^\[A-Za-z0-9_-\]\{1,100\}\$'/);
  assert.match(sql,/unit >= 0 and unit < 10000000000/);
});
