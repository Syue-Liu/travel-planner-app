const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);
const block=html.slice(html.indexOf('// ── 航班住宿：'),html.indexOf('let _installPrompt=null;'));
assert(block.includes('function parseBookingImport(')&&block.includes('function confirmBookingImport('));
const alerts=[];let seq=0,undo,clock={date:'2026-10-11',minutes:8*60};
const ctx={Blob,S:{memo:[{id:'memo1',text:'護照',cat:'證件',done:false},{id:'buy1',kind:'purchase',text:'牛軋糖',quantity:1}],trash:{},modal:null},FM:{},
  TI:n=>`[${n}]`,esc:s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),
  linkify:s=>ctx.esc(s),mu:a=>'map:'+a,nu:a=>'nav:'+a,dayScene:()=>'<svg></svg>',uid:()=>`bk${++seq}`,alert:m=>alerts.push(m),
  setD:p=>Object.assign(ctx.S,p),openModal:(el,m)=>{ctx.S.modal=m;},_refreshHeroContent:()=>{},tomb:id=>{ctx.S.trash[id]=1;},undoToast:(m,fn)=>{undo=fn;},
  tripClock:()=>clock,document:{getElementById:()=>null}};
vm.createContext(ctx);vm.runInContext(block.replace(/^const /gm,'var '),ctx); // top-level const is not visible on the context object

// Manual form: validation and per-type fields.
ctx.FM={bkType:'stay',name:' '};ctx.saveBooking();assert.equal(alerts.pop(),'請填寫住宿名稱');
ctx.FM={bkType:'flight'};ctx.saveBooking();assert.match(alerts.pop(),/至少填寫/);
ctx.FM={bkType:'car',date:'2026-10-12',endDate:'2026-10-11',number:'Yaris'};ctx.saveBooking();assert.match(alerts.pop(),/還車日期不能早於取車日期/);
ctx.FM={bkType:'flight',date:'2026-11-11',time:'07:40',endTime:'10:50',number:'CI188',from:'桃園 T1',to:'釜山 T1',name:'不該存',code:'ABC123',note:'網路報到'};ctx.saveBooking();
const flight=ctx.bookingItems()[0];assert.equal(flight.type,'flight');assert.equal(flight.name,undefined);assert.equal(flight.text,'航班：CI188 桃園 T1 → 釜山 T1');assert.equal(flight.cat,'預訂');
ctx.openBooking(null,'',flight.id);assert.equal(ctx.FM.number,'CI188');ctx.FM.note='改提醒';ctx.saveBooking();assert.equal(ctx.bookingItems().length,1);assert.equal(ctx.bookingItems()[0].note,'改提醒');assert.equal(ctx.bookingItems()[0].id,flight.id);
assert.equal(ctx.S.memo[0].id,'memo1');assert.equal(ctx.S.memo[1].id,'buy1');

// Status and ordering: overnight arrival, ongoing stay, next upcoming.
assert.equal(ctx.bkSpan({type:'flight',date:'2026-11-15',time:'23:10',endTime:'01:05'}).e,'2026-11-16 01:05');
assert.equal(ctx.bkStatus({type:'stay',date:'2026-10-10',time:'15:00',endDate:'2026-10-12'},'2026-10-11 08:00'),'now');
assert.equal(ctx.bkStatus({type:'train',date:'2026-10-10',time:'08:00',endTime:'09:30'},'2026-10-11 08:00'),'past');
assert.equal(ctx.bkWhen({date:'2026-10-12',time:'09:00'},'2026-10-11'),'明天 09:00');assert.equal(ctx.bkWhen({date:'2026-11-11'},'2026-10-11'),'還有 31 天');

// AI import parsing: fences, aliases, normalisation, single object.
const batch=[{type:'飛機',date:'2026/11/11',time:'7:40',endTime:'10:50',number:'KE2028',from:'金海',to:'松山'},{type:'Hotel',name:'礁溪老爺酒店',date:'2026-10-10',endDate:'2026-10-12',time:'15:00',code:'HT-1',note:'含早餐\n停車場在後門'},{type:'高鐵',number:803,from:'台北',to:'左營'}];
let parsed=ctx.parseBookingImport('```json\n'+JSON.stringify(batch)+'\n```');
assert.equal(parsed.length,3);assert.equal(parsed[0].type,'flight');assert.equal(parsed[0].date,'2026-11-11');assert.equal(parsed[0].time,'07:40');
assert.equal(parsed[1].type,'stay');assert.equal(parsed[1].endDate,'2026-10-12');assert.equal(parsed[2].type,'train');assert.equal(parsed[2].number,'803');assert.equal(parsed[2].endDate,'');
assert.equal(ctx.parseBookingImport('{"type":"car","number":"Yaris","date":"2026-10-11","endDate":"2026-10-12"}')[0].endDate,'2026-10-12');
for(const raw of ['[]','not json','[1]',JSON.stringify([{type:'rocket',number:'X'}]),JSON.stringify([{type:'stay'}]),JSON.stringify([{type:'flight'}]),JSON.stringify([{type:'flight',number:'A',date:'2026-02-31'}]),JSON.stringify([{type:'flight',number:'A',time:'25:00'}]),JSON.stringify([{type:'flight',number:{}}]),JSON.stringify([{type:'flight',number:'A',note:'x'.repeat(1001)}]),JSON.stringify(Array(51).fill({type:'flight',number:'A'})),'x'.repeat(200001)])assert.throws(()=>ctx.parseBookingImport(raw),raw.slice(0,40));
assert.throws(()=>ctx.parseBookingImport(JSON.stringify([batch[0],{type:'stay'}])),/第 2 筆/);
const hostile=ctx.parseBookingImport('[{"type":"flight","number":"<img onerror=evil>","id":"memo1","kind":"purchase","done":true,"__proto__":{"polluted":true}}]')[0];
assert.equal(hostile.kind,'booking');assert.equal(hostile.id,undefined);assert.equal(hostile.done,false);assert.equal(({}).polluted,undefined);

// Duplicate handling and confirm.
ctx.FM={bkImportText:JSON.stringify([...batch,{type:'flight',date:'2026-11-11',time:'07:40',number:'CI188',from:'桃園 T1',to:'釜山 T1'},batch[1]]),bkImportSkip:true};
let plan=ctx.bookingImportPlan(ctx.FM.bkImportText);assert.equal(plan.rows.length,5);assert.equal(plan.duplicates,2);assert.equal(plan.items.length,3);
ctx.FM.bkImportSkip=false;assert.equal(ctx.bookingImportPlan(ctx.FM.bkImportText).items.length,5);ctx.FM.bkImportSkip=true;
const preview=ctx.bookingImportPreviewHtml(ctx.FM.bkImportText);assert(preview.includes('可新增 3 筆'));assert(preview.includes('略過重複'));
assert(ctx.bookingImportPreviewHtml('[{"type":"flight","number":"<b>x</b>"}]').includes('&lt;b&gt;'));assert(ctx.bookingImportPreviewHtml('oops').includes('import-err'));
ctx.S.modal={t:'booking_import'};ctx.confirmBookingImport();
assert.equal(ctx.bookingItems().length,4);assert(ctx.bookingItems().filter(b=>b.id!==flight.id).every(b=>b.id&&b._u&&b.kind==='booking'));assert.match(alerts.pop(),/已新增 3 筆.*略過 2 筆重複/);
assert.equal(ctx.S.memo.filter(m=>m.kind!=='booking').length,2);
ctx.S.modal={t:'booking_import'};ctx.FM={bkImportText:'[{"type":"flight","number":"Z1"}]'};const big=ctx.S.cover;ctx.S.cover='x'.repeat(850000);const n=ctx.bookingItems().length;ctx.confirmBookingImport();assert.equal(ctx.bookingItems().length,n);assert.match(alerts.pop(),/容量上限/);delete ctx.S.cover;
ctx.S.modal=null;ctx.FM={bkImportText:'[{"type":"flight","number":"Z2"}]'};ctx.confirmBookingImport();assert.equal(ctx.bookingItems().length,n);

// View: next reminder, escaping, delete + undo.
const view=ctx.bookingsView();assert(view.includes('接下來'));assert(view.includes('入住中'));assert(!/openBooking\(this,'(flight|train|stay)'\)|openBookingImport/.test(view),'adding lives in the ＋ button only');assert(view.includes("openBooking(this,'',"));
ctx.S.memo.push({id:'x1',kind:'booking',type:'flight',number:'<script>',note:'<img>'});assert(!ctx.bookingsView().includes('<script>'));
const stay=ctx.bookingItems().find(b=>b.type==='stay');ctx.confirm=()=>true;vm.runInContext('confirm=()=>true',ctx);ctx.deleteBooking(stay.id);assert(ctx.S.trash[stay.id]);assert(!ctx.bookingItems().some(b=>b.id===stay.id));undo();assert(ctx.bookingItems().some(b=>b.name==='礁溪老爺酒店'&&b.id!==stay.id));
ctx.S.memo=[];assert(ctx.bookingsView().includes('bk-empty'));assert(!ctx.bookingsView().includes('<button'));

// Wiring that lives outside the block.
assert(html.includes("m.kind!=='purchase'&&m.kind!=='booking'"));
assert(html.includes("else if(m.t==='booking_import')c=bookingImportModal()"));
assert(/HERO_TYPES=new Set\([^)]*'booking_import'/.test(html));
assert(html.includes('"openBookingImport(this)"'));
console.log('PASS: booking form validation, overnight/ongoing status, AI import parsing and normalisation, hostile input, duplicates, capacity guard, escaping, delete/undo and wiring');
