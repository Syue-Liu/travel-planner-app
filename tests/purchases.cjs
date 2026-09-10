const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))new vm.Script(m[1]);
function fn(name){const start=html.search(new RegExp('^function '+name+'\\(','m'));assert(start>=0);const tail=html.slice(start);const end=tail.slice(1).search(/^(?:function |async function |let |const |window\.|setInterval\(|load\()/m);return tail.slice(0,end+1);}
let seq=0,undo;const alerts=[];
const ctx={Blob,window:{},S:{memo:[{id:'memo1',text:'護照',cat:'證件',done:false}],trash:{}},FM:{},TI:()=>'',esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),uid:()=>`buy${++seq}`,alert:m=>alerts.push(m),confirm:()=>true,openModal:()=>{},setD:u=>Object.assign(ctx.S,u),tomb:id=>ctx.S.trash[id]=Date.now(),undoToast:(_,f)=>undo=f};
vm.createContext(ctx);
vm.runInContext(html.slice(html.indexOf("let buyFilter='all'"),html.indexOf('function memoView()')),ctx);
vm.runInContext(fn('toggleMemo'),ctx);
vm.runInContext(fn('stampChanges'),ctx);vm.runInContext(fn('_itemSig'),ctx);vm.runInContext(fn('mergeById'),ctx);
ctx.FM={buyName:'餅乾',buyQuantity:2,buyShop:'河口湖',buyNote:'送家人'};ctx.saveBuy();
assert.equal(ctx.buyItems().length,1);assert.equal(ctx.S.memo[0].text,'護照');const id=ctx.buyItems()[0].id;
ctx.openBuy(null,id);ctx.FM.buyName='新口味';ctx.saveBuy();assert.equal(ctx.buyItems()[0].text,'新口味');assert.equal(ctx.buyItems()[0].quantity,2);
ctx.toggleMemo(id);assert.equal(ctx.buyItems()[0].done,true);
ctx.openBuy(null,id);ctx.FM.buyNote='改備註';ctx.saveBuy();assert.equal(ctx.buyItems()[0].done,true);
ctx.FM={buyName:' ',buyQuantity:1};ctx.saveBuy();ctx.FM={buyName:'錯誤數量',buyQuantity:1.5};ctx.saveBuy();assert.equal(alerts.length,2);assert.equal(ctx.buyItems().length,1);
ctx.S.memo.push({id:'xss',kind:'purchase',text:'<img onerror=alert(1)>',note:'<script>',quantity:1,done:false});assert(!ctx.buyView().includes('<img onerror'));assert(ctx.buyView().includes('&lt;script>'));
vm.runInContext("buyFilter='pending'",ctx);assert(!ctx.buyView().includes('新口味'));vm.runInContext("buyFilter='done'",ctx);assert(ctx.buyView().includes('新口味'));
const stamped=ctx.stampChanges(ctx.S.memo,[]);assert(stamped.every(m=>m._u));const restored=JSON.parse(JSON.stringify(stamped));assert.equal(restored.find(m=>m.id===id).shop,'河口湖');
const merged=ctx.mergeById(restored,[{id:'remote',kind:'purchase',text:'旅伴商品',_u:1}],{});assert.equal(merged.length,4);
ctx.deleteBuy(id);assert(ctx.S.trash[id]);assert(!ctx.buyItems().some(m=>m.id===id));undo();assert(ctx.buyItems().some(m=>m.text==='新口味'&&m.id!==id));assert.equal(ctx.S.memo[0].id,'memo1');
assert(html.includes("m.kind!=='purchase'"));assert(html.includes("else if(m.t==='buy_edit')c=buyModal()"));
// Grouping, backwards compatibility, custom categories and image presentation.
vm.runInContext("buyFilter='all'",ctx);
const photo='data:image/jpeg;base64,YWJj';
ctx.FM={buyName:'乳霜',buyQuantity:1,buyArea:'  銀座  ',buyCategory:'美妝保養',buyShop:'Loft',buyImage:photo};ctx.saveBuy();
ctx.FM={buyName:'鉛筆',buyQuantity:3,buyArea:'銀座',buyCategory:'文具',buyShop:'伊東屋'};ctx.saveBuy();
const cream=ctx.buyItems().find(m=>m.text==='乳霜');assert.equal(cream.area,'銀座');assert.equal(cream.image,photo);
const groups=ctx.buyGroups(ctx.buyItems());assert.equal(groups.filter(([a])=>a==='銀座').length,1);assert.equal(groups.find(([a])=>a==='銀座')[1].length,2);assert.equal(groups.at(-1)[0],'未指定地區');
assert.equal(ctx.buyCategory({}),'其他');assert.equal(ctx.safeBuyImage('javascript:alert(1)'), '');assert.equal(ctx.safeBuyImage('data:image/svg+xml;base64,YWJj'),'');assert.equal(ctx.safeBuyImage('data:image/jpeg;base64,'+'a'.repeat(40001)),'');
assert(ctx.buyCard(cream).includes('class="buy-photo"  ontoggle'));assert(ctx.buyCard(cream).includes('loading="lazy"'));assert(!ctx.buyCard({id:'none',text:'無圖'}).includes('<details'));
vm.runInContext(`buyPhotoOpen.add('${cream.id}')`,ctx);assert(ctx.buyCard(cream).includes('class="buy-photo" open'));
vm.runInContext("buyCategoryFilter='文具'",ctx);assert(ctx.buyView().includes('鉛筆'));assert(!ctx.buyView().includes('乳霜'));
ctx.openBuy(null,cream.id);assert.equal(ctx.FM.buyArea,'銀座');assert.equal(ctx.FM.buyImage,photo);assert(ctx.buyModal().includes('buy-photo-input'));ctx.FM.buyImage='';ctx.saveBuy();assert.equal(ctx.buyItems().find(m=>m.id===cream.id).image,'');
const before=ctx.S.memo.length;ctx.FM={buyName:'等待圖片',buyQuantity:1,buyImageBusy:true};ctx.saveBuy();assert.equal(ctx.S.memo.length,before);
ctx.S.cover='x'.repeat(850000);ctx.FM={buyName:'超出容量',buyQuantity:1};ctx.saveBuy();assert.equal(ctx.S.memo.length,before);delete ctx.S.cover;
// Browser image pipeline mocked at its I/O boundary; cancellation must not leak images into another draft.
let imageHandle,refresh=0,revoked=0;
ctx._refreshHeroContent=()=>refresh++;
ctx.URL={createObjectURL:()=> 'blob:test',revokeObjectURL:()=>revoked++};
ctx.Image=class{constructor(){imageHandle=this;this.naturalWidth=1200;this.naturalHeight=800;}set src(v){this.source=v;}};
ctx.document={createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=>photo})};
ctx.S.modal={t:'buy_edit'};ctx.FM={buyImage:''};ctx.uploadBuyImage({type:'image/jpeg',size:2000});assert(ctx.FM.buyImageBusy);imageHandle.onload();assert.equal(ctx.FM.buyImage,photo);assert.equal(ctx.FM.buyImageBusy,false);assert.equal(revoked,1);
ctx.uploadBuyImage({type:'image/png',size:2000});ctx.FM={buyImage:''};imageHandle.onload();assert.equal(ctx.FM.buyImage,'');assert.equal(revoked,2);
ctx.uploadBuyImage({type:'image/webp',size:2000});imageHandle.onerror();assert.equal(ctx.FM.buyImageBusy,false);assert.equal(revoked,3);
const beforeInvalid=refresh;ctx.uploadBuyImage({type:'image/svg+xml',size:100});ctx.uploadBuyImage({type:'image/png',size:13*1024*1024});assert.equal(refresh,beforeInvalid);
// Multiple choices preserve drafts, toggle independently and expose their selected state.
const inputs=Object.fromEntries(['category','area','shop','recipients'].map(key=>['buy-'+key,{value:'',maxLength:200}]));
const chip=(field,value)=>({dataset:{field,value},setAttribute(key,value){this[key]=value;}});
const chips=[chip('buyArea','銀座'),chip('buyArea','新宿'),chip('buyRecipients','媽媽')];
ctx.document={getElementById:id=>inputs[id],querySelectorAll:()=>chips};
ctx.FM={buyArea:'銀座',buyNote:'保留備註',buyImage:photo};inputs['buy-area'].value='銀座';
ctx.applyBuyQuick(chips[1]);assert.equal(ctx.FM.buyArea,'銀座、新宿');assert.equal(chips[0]['aria-pressed'],'true');assert.equal(chips[1]['aria-pressed'],'true');
ctx.applyBuyQuick(chips[0]);assert.equal(ctx.FM.buyArea,'新宿');assert.equal(chips[0]['aria-pressed'],'false');
inputs['buy-area'].value=' 自填地區、 自填地區，銀座 ';ctx.applyBuyQuick(chips[1]);assert.equal(ctx.FM.buyArea,'自填地區、銀座、新宿');
ctx.updateBuyQuick('buyArea','銀座');assert.equal(chips[1]['aria-pressed'],'false');assert.equal(ctx.FM.buyNote,'保留備註');assert.equal(ctx.FM.buyImage,photo);
inputs['buy-area'].value='銀座';inputs['buy-area'].maxLength=2;ctx.applyBuyQuick(chips[1]);assert.equal(inputs['buy-area'].value,'銀座');
ctx.FM={buyName:'多區商品',buyQuantity:2,buyArea:'銀座、新宿、銀座',buyCategory:'生活雜貨、伴手禮',buyRecipients:'媽媽、霹靂維德',buyShop:'Loft、唐吉訶德',buyImage:photo};ctx.saveBuy();
const multi=ctx.buyItems().find(m=>m.text==='多區商品');assert.equal(multi.area,'銀座、新宿');assert.equal(multi.recipients,'媽媽、霹靂維德');
ctx.openBuy(null,multi.id);assert.equal(ctx.FM.buyRecipients,'媽媽、霹靂維德');assert.equal(ctx.FM.buyImage,photo);
const multiGroups=ctx.buyGroups([multi]);assert.equal(multiGroups.length,2);assert(multiGroups.every(([,items])=>items.length===1&&items[0].id===multi.id));
vm.runInContext("buyCategoryFilter='伴手禮';buyFilter='all'",ctx);assert(ctx.buyView().includes('多區商品'));assert(ctx.buyView().includes(' / '+ctx.buyItems().length+' 件'));
ctx.toggleMemo(multi.id);assert(ctx.buyGroups([multi]).length===2);assert(ctx.buyItems().find(m=>m.id===multi.id).done);
assert(ctx.buyQuickValues('area').includes('新宿'));assert(!ctx.buyQuickValues('area').includes('銀座、新宿'));
ctx.S.travelers=['霹靂維德','旅伴乙'];const recipientHtml=ctx.buyQuickChoices('buyRecipients','recipients');
assert(recipientHtml.includes('旅伴乙'));assert(recipientHtml.includes('data-value="媽媽" aria-pressed="true"'));assert(ctx.buyCard(multi).includes('幫誰買｜媽媽、霹靂維德'));
assert(!ctx.buyCard({id:'legacy',text:'舊商品'}).includes('幫誰買｜'));
ctx.FM.buyRecipients='<img src=x onerror=alert(1)>';ctx.saveBuy();assert(!ctx.buyCard(ctx.buyItems().find(m=>m.id===multi.id)).includes('<img src=x'));
const recipientMerge=ctx.mergeById(JSON.parse(JSON.stringify(ctx.stampChanges(ctx.S.memo,[]))),[],{});
assert.equal(recipientMerge.find(m=>m.id===multi.id).recipients,ctx.FM.buyRecipients);
// AI JSON import: validate the whole batch, preview safely and append without replacing existing data.
const batch=[{name:'進口餅乾',quantity:2,categories:['零食飲料','伴手禮'],areas:['新宿','銀座'],shops:['Loft'],recipients:['媽媽','爸爸'],note:'原味'}];
ctx.FM={buyImportText:JSON.stringify(batch),buyImportSkip:true};
let parsed=ctx.parseBuyImport('```json\n'+JSON.stringify(batch)+'\n```');assert.equal(parsed[0].area,'新宿、銀座');assert.equal(parsed[0].recipients,'媽媽、爸爸');assert.equal(parsed[0].quantity,2);
assert.equal(ctx.parseBuyImport('[{"name":"只有名稱"}]')[0].quantity,1);
for(const raw of ['{}','[]','not json',JSON.stringify([{name:''}]),JSON.stringify([{name:'a',quantity:0}]),JSON.stringify([{name:'a',quantity:'2'}]),JSON.stringify([{name:'a',areas:[{}]}]),JSON.stringify([{name:'a',note:10}]),JSON.stringify(Array(101).fill({name:'a'})), 'x'.repeat(200001)])assert.throws(()=>ctx.parseBuyImport(raw));
assert.throws(()=>ctx.parseBuyImport(JSON.stringify([...batch,{name:'壞資料',quantity:1.5}])),/第 2 件/);
const hostile=ctx.parseBuyImport('[{"name":"<img onerror=evil>","id":"memo1","done":true,"image":"javascript:evil","__proto__":{"polluted":true}}]')[0];
assert.equal(hostile.done,false);assert.equal(hostile.image,'');assert.equal(hostile.id,undefined);assert.equal(hostile.polluted,undefined);
assert(!ctx.buyImportPreviewHtml(JSON.stringify([{name:'<img onerror=evil>'}])).includes('<img onerror'));
const originalMemo=JSON.stringify(ctx.S.memo),baseCount=ctx.buyItems().length;
assert.equal(ctx.buyImportPlan(JSON.stringify([...batch,...batch])).items.length,1);
assert.equal(ctx.buyImportPlan(JSON.stringify([...batch,...batch])).duplicates,1);
const importNodes={'buy-import-box':{value:JSON.stringify(batch)},'buy-import-preview':{},'buy-import-confirm':{}};
ctx.document={getElementById:id=>importNodes[id]};ctx.S.modal={t:'buy_import'};ctx.previewBuyImport();assert.equal(importNodes['buy-import-confirm'].disabled,false);assert.equal(JSON.stringify(ctx.S.memo),originalMemo);
ctx.confirmBuyImport();assert.equal(ctx.buyItems().length,baseCount+1);assert.equal(ctx.S.modal,null);assert.equal(JSON.stringify(ctx.S.memo.slice(0,-1)),originalMemo);
ctx.confirmBuyImport();assert.equal(ctx.buyItems().length,baseCount+1); // stale/double click
assert.equal(ctx.buyImportPlan(JSON.stringify(batch)).items.length,0);
assert.equal(ctx.buyImportPlan(JSON.stringify([{...batch[0],recipients:['爸爸','媽媽']}])).items.length,0);
assert.equal(ctx.buyImportPlan(JSON.stringify([{...batch[0],recipients:['自己']}])).items.length,1);
ctx.FM.buyImportSkip=false;assert.equal(ctx.buyImportPlan(JSON.stringify(batch)).items.length,1);
ctx.FM.buyImportSkip=true;ctx.S.modal={t:'buy_import'};importNodes['buy-import-box'].value=JSON.stringify([{name:'雲端剛新增'}]);ctx.previewBuyImport();
ctx.S.memo.push({id:'cloud-buy',kind:'purchase',text:'雲端剛新增'});const concurrentCount=ctx.buyItems().length;ctx.confirmBuyImport();assert.equal(ctx.buyItems().length,concurrentCount);assert.equal(importNodes['buy-import-confirm'].disabled,true);
importNodes['buy-import-box'].value=JSON.stringify([{name:'容量不足'}]);ctx.S.cover='x'.repeat(850000);ctx.confirmBuyImport();assert.equal(ctx.buyItems().length,concurrentCount);delete ctx.S.cover;
importNodes['buy-import-box'].value=JSON.stringify([{name:'有效商品'},{name:'',quantity:1}]);ctx.confirmBuyImport();assert.equal(ctx.buyItems().length,concurrentCount);assert(importNodes['buy-import-preview'].innerHTML.includes('第 2 件'));
vm.runInContext(fn('fabConfig'),ctx);ctx.S.view='buy';ctx.S.modal=null;assert.equal(ctx.fabConfig().ai,'AI 匯入待買');
assert(html.includes("else if(S.view==='buy')openBuyImport(el)"));assert(html.includes("else if(m.t==='buy_import')c=buyImportModal()"));
console.log('PASS: purchase regressions, multi-select, recipients and AI import parsing, preview, validation, escaping, duplicates, concurrent additions, append-only writes, capacity limits and FAB routing');

// Cloudinary boundary and async races; network is mocked, no real account/files are used here.
(async()=>{
  const cloudUrl='https://res.cloudinary.com/test-cloud/image/upload/v123/travel/photo.jpg';
  ctx.window.TRAVEL_APP_CLOUDINARY={cloudName:'test-cloud',uploadPreset:'travel_test'};
  ctx.cloud={tripId:'test-trip'};ctx.navigator={onLine:true};
  ctx.FormData=FormData;ctx.AbortController=AbortController;ctx.setTimeout=setTimeout;ctx.clearTimeout=clearTimeout;
  assert(ctx.cloudImageConfig());assert.equal(ctx.safeBuyImage(cloudUrl),cloudUrl);
  for(const value of ['javascript:alert(1)','https://evil.example/a.jpg','https://res.cloudinary.com.evil.example/test-cloud/image/upload/a.jpg','https://res.cloudinary.com/test-cloud/raw/upload/a.jpg','https://res.cloudinary.com/test-cloud/image/upload/a.svg',cloudUrl+'" onerror="evil'])assert.equal(ctx.cloudImageUrl(value),'');
  ctx.window.TRAVEL_APP_CLOUDINARY.cloudName='../bad';assert.equal(ctx.cloudImageConfig(),null);ctx.window.TRAVEL_APP_CLOUDINARY.cloudName='test-cloud';
  let request,verified=0;
  ctx.fetch=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({secure_url:cloudUrl})};};
  ctx.verifyCloudImage=async url=>{verified++;return url;};
  assert.equal(await ctx.sendCloudImage(photo),cloudUrl);assert.equal(verified,1);assert.equal(request.url,'https://api.cloudinary.com/v1_1/test-cloud/image/upload');
  assert.equal(request.options.body.get('upload_preset'),'travel_test');assert.equal(request.options.body.get('file'),photo);assert.equal(request.options.credentials,'omit');assert.equal(request.options.body.get('api_key'),null);
  ctx.navigator.onLine=false;await assert.rejects(ctx.sendCloudImage(photo),/需要網路/);ctx.navigator.onLine=true;
  await assert.rejects(ctx.sendCloudImage('javascript:evil'),/格式/);
  ctx.fetch=async()=>({ok:false,status:400,json:async()=>({error:{message:'preset invalid'}})});await assert.rejects(ctx.sendCloudImage(photo),/上傳設定/);
  ctx.fetch=async()=>({ok:true,json:async()=>({secure_url:'https://res.cloudinary.com/other/image/upload/a.jpg'})});await assert.rejects(ctx.sendCloudImage(photo),/有效網址/);
  ctx.fetch=async()=>{throw Object.assign(Error('timeout'),{name:'AbortError'});};await assert.rejects(ctx.sendCloudImage(photo),/逾時/);
  ctx.fetch=async()=>({ok:true,json:async()=>({secure_url:cloudUrl})});ctx.verifyCloudImage=async()=>{throw Error('not readable');};await assert.rejects(ctx.sendCloudImage(photo),/not readable/);
  // A cancelled edit must not receive a late result; failed uploads retain the original image.
  const sendOriginal=ctx.sendCloudImage;let completeUpload;
  ctx.compressCloudImage=async()=>photo;ctx.sendCloudImage=()=>new Promise(resolve=>completeUpload=resolve);
  ctx.FM={buyImage:photo};ctx.S.modal={t:'buy_edit'};
  let pending=ctx.uploadCloudBuyImage({type:'image/jpeg'});await new Promise(setImmediate);assert(ctx.FM.buyImageBusy);completeUpload(cloudUrl);await pending;assert.equal(ctx.FM.buyImage,cloudUrl);assert.equal(ctx.FM.buyImageBusy,false);
  pending=ctx.uploadCloudBuyImage({type:'image/jpeg'});await new Promise(setImmediate);ctx.FM={buyImage:photo};ctx.S.modal={t:'buy_edit'};completeUpload(cloudUrl);await pending;assert.equal(ctx.FM.buyImage,photo);
  ctx.sendCloudImage=async()=>{throw Error('upload failed');};await ctx.uploadCloudBuyImage({type:'image/jpeg'});assert.equal(ctx.FM.buyImage,photo);assert.equal(ctx.FM.buyImageBusy,false);
  // Cover upload preserves a newly selected or remotely edited cover.
  ctx.sendCloudImage=()=>new Promise(resolve=>completeUpload=resolve);ctx.S.modal={t:'cover'};ctx.S.cover=photo;
  pending=ctx.uploadCloudCover({type:'image/jpeg'});await new Promise(setImmediate);ctx.S.cover='newer-cover';completeUpload(cloudUrl);await pending;assert.equal(ctx.S.cover,'newer-cover');
  ctx.S.modal={t:'cover'};pending=ctx.uploadCloudCover({type:'image/jpeg'});await new Promise(setImmediate);completeUpload(cloudUrl);await pending;assert.equal(ctx.S.cover,cloudUrl);
  // Migration preserves concurrent fields and deleted products and does not cross trips.
  ctx.S.memo=[{id:'keep-task',text:'護照'},{id:'move1',kind:'purchase',text:'商品一',image:photo},{id:'move2',kind:'purchase',text:'商品二',image:'data:image/jpeg;base64,ZGVm'}];ctx.S.cover=photo;ctx.S.modal={t:'cloud_images'};
  ctx.buildTrip=()=>({memo:ctx.S.memo,cover:ctx.S.cover});
  ctx.sendCloudImage=async data=>{ctx.S.memo.find(m=>m.id==='move1').note='旅伴新備註';return cloudUrl;};await ctx.migrateTripImages();
  assert.equal(ctx.S.cover,cloudUrl);assert.equal(ctx.S.memo.find(m=>m.id==='move1').note,'旅伴新備註');assert.equal(ctx.S.memo.find(m=>m.id==='move1').image,cloudUrl);assert.equal(ctx.S.memo[0].text,'護照');assert.equal(ctx.embeddedTripImages().length,0);
  const newPhoto='data:image/jpeg;base64,Z2hp';ctx.S.memo.push({id:'failed',kind:'purchase',text:'未搬移',image:newPhoto});
  ctx.sendCloudImage=async()=>{throw Error('upload failed');};await ctx.migrateTripImages();assert.equal(ctx.S.memo.find(m=>m.id==='failed').image,newPhoto);
  ctx.sendCloudImage=async()=>{ctx.S.memo=ctx.S.memo.filter(m=>m.id!=='failed');return cloudUrl;};await ctx.migrateTripImages();assert(!ctx.S.memo.some(m=>m.id==='failed'));
  ctx.S.memo.push({id:'switch',kind:'purchase',text:'原旅程',image:'data:image/jpeg;base64,amts'});ctx.sendCloudImage=async()=>{ctx.cloud.tripId='other-trip';return cloudUrl;};await ctx.migrateTripImages();assert.equal(ctx.S.memo.find(m=>m.id==='switch').image,'data:image/jpeg;base64,amts');
  console.log('PASS: Cloudinary config, trusted URLs, upload failures, verified delivery, stale drafts, cover races, migration preservation and trip isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
// In-store shopping: aliases, branch keywords, multi-store entries, and independent filters.
const storeSavedMemo=ctx.S.memo;ctx.S.memo=[
 {id:'store1',kind:'purchase',text:'MUJI待買',shop:'無印良品 銀座旗艦店／無印良品 新宿 LUMINE',area:'銀座、新宿',done:false,purchaseCategory:'生活雜貨'},
 {id:'store2',kind:'purchase',text:'已買商品',shop:'MUJI 銀座',area:'銀座',done:true},
 {id:'store3',kind:'purchase',text:'多店商品',shop:'唐吉訶德新宿東南口 / Loft',done:false},
 {id:'store4',kind:'purchase',text:'MUJI只在品名',shop:'伊東屋',note:'無印良品',done:false},
 {id:'store5',kind:'purchase',text:'相機',shop:'Bic Camera 新宿東口',done:false},
 {id:'store6',kind:'purchase',text:'餅乾',shop:'7-ELEVEN',done:false}
];
for(const q of ['MUJI','無印','無印良品','ｍｕｊｉ','無印 銀座','銀座 muji'])assert(ctx.buyMatchesStore(ctx.S.memo[0],q),q);
assert(!ctx.buyMatchesStore(ctx.S.memo[0],'無印 原宿'));assert(!ctx.buyMatchesStore(ctx.S.memo[0],'銀座 新宿'),'keywords must match the same store');
assert(!ctx.buyMatchesStore(ctx.S.memo[3],'MUJI'),'do not match product name or notes');
for(const q of ['donki','don quijote','ドンキ','唐吉','Loft'])assert(ctx.buyMatchesStore(ctx.S.memo[2],q),q);
for(const q of ['bic camera','ビックカメラ','Ｂｉｃ　Ｃａｍｅｒａ 新宿'])assert(ctx.buyMatchesStore(ctx.S.memo[4],q),q);
assert(ctx.buyMatchesStore(ctx.S.memo[5],'7-11'));
const mujiChoice=ctx.buyStoreChoices().find(c=>c.name==='無印良品');assert.equal(mujiChoice.total,2);assert.equal(mujiChoice.pending,1);
ctx.render=()=>{};ctx.selectBuyStore('無印良品');assert.equal(ctx.buyVisibleItems().length,1);assert.equal(ctx.buyVisibleItems()[0].id,'store1');
assert(ctx.buyResults().includes('符合目前篩選 1 件'),'multi-area item counted once');assert.equal((ctx.buyResults().match(/class="buy-card/g)||[]).length,1,'show multi-area item only once at a store');
vm.runInContext("buyFilter='all'",ctx);assert.equal(ctx.buyVisibleItems().length,2);
vm.runInContext("buyCategoryFilter='生活雜貨'",ctx);assert.equal(ctx.buyVisibleItems().length,1);
// Updating search replaces results only, keeping the input and Chinese IME composition intact.
let focused=false;const searchNodes={'buy-results':{},'buy-store-shortcuts':{},'buy-store-clear':{},'buy-store-search':{value:'MUJI',focus(){focused=true;}}};
ctx.document={getElementById:id=>searchNodes[id]};ctx.render=()=>{throw Error('Typing must not rerender the whole page');};
const inputIdentity=searchNodes['buy-store-search'];ctx.updateBuyStoreSearch('MUJI');assert.equal(searchNodes['buy-store-search'],inputIdentity);assert.equal(searchNodes['buy-store-clear'].hidden,false);
ctx.updateBuyStoreSearch('<img src=x onerror=evil>');assert(!searchNodes['buy-results'].innerHTML.includes('<img src=x'));assert(searchNodes['buy-results'].innerHTML.includes('&lt;img'));
ctx.clearBuyStoreSearch();assert.equal(searchNodes['buy-store-search'].value,'');assert.equal(searchNodes['buy-store-clear'].hidden,true);assert(focused);
assert(html.includes('if(!event.isComposing)updateBuyStoreSearch(this.value)'));assert(html.includes('oncompositionend="updateBuyStoreSearch(this.value)"'));
ctx.S.memo=storeSavedMemo;
console.log('PASS: store aliases, branch matching, multi-store uniqueness, pending/category filters, safe search rendering and IME-preserving updates');
