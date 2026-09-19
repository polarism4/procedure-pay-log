const fs=require('node:fs');
const path=require('node:path');
const url=process.env.SUPABASE_URL||'';
const publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY||'';
if(Boolean(url)!==Boolean(publishableKey))throw Error('Set both Supabase environment variables');
if(url && new URL(url).protocol!=='https:')throw Error('Supabase URL must use HTTPS');
if(publishableKey.startsWith('sb_secret_'))throw Error('Never deploy a secret key');
if(publishableKey.startsWith('eyJ')){
 const payload=JSON.parse(Buffer.from(publishableKey.split('.')[1],'base64url'));
 if(payload.role!=='anon')throw Error('Only an anon or publishable key can be deployed');
}
fs.mkdirSync(path.join(__dirname,'dist'),{recursive:true});
for(const file of ['index.html','data.js','cloud.js','manifest.json','service-worker.js','icon-192.png','icon-512.png'])fs.copyFileSync(path.join(__dirname,file),path.join(__dirname,'dist',file));
fs.writeFileSync(path.join(__dirname,'dist/config.js'),'window.PAY_LOG_CONFIG = '+JSON.stringify({url,publishableKey})+';\n');
fs.writeFileSync(path.join(__dirname,'dist/_headers'),'/service-worker.js\n  Cache-Control: no-cache\n/config.js\n  Cache-Control: no-cache\n/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n');
