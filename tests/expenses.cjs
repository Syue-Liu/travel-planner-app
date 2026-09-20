const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fn(name){const start=html.search(new RegExp('^function '+name+'\\(','m'));assert(start>=0,name);const tail=html.slice(start);const end=tail.slice(1).search(/^(?:function |async function |let |const |window\.|setInterval\(|load\()/m);return tail.slice(0,end+1);}
const alerts=[];let writes=0,inputs=[];
const ctx={S:{travelers:['甲','乙','丙'],expenses:[],settleCurrency:'TWD',modal:{}},FM:{},FX:{rates:null,status:'測試匯率'},CUR:{TWD:1,JPY:.22},CUR_LABEL:{TWD:'NT$',JPY:'¥'},CTI:{},TI:()=>'',getTvColor:()=>({}),alert:m=>alerts.push(m),uid:()=> 'new',ac:()=> '其他',normalizeExpenseDate:s=>s,localDate:()=> '2026-09-20',bindExpenseIds:()=>{},setD:u=>{writes++;Object.assign(ctx.S,u);},document:{querySelectorAll:()=>inputs}};
vm.createContext(ctx);
for(const name of ['esc','jsq','convertAmount','expValue','fmtSettlement','isPersonalExp','expenseAllocations','expenseAdvanceHtml','expenseDraftPreview','settlementSummary','settle','splt','sExp'])vm.runInContext(fn(name),ctx);
const expense=(amount,paidBy,splitWith,currency='TWD',shares=null)=>({item:'晚餐',amount,paidBy,splitWith,currency,shares,expenseMode:'shared'});
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
// A full advance for one other traveler: payer has no own consumption.
let e=expense(3000,'甲',['乙'],'JPY');
let result=ctx.settle([e],ctx.S.travelers);close(result.b['甲'],660);close(result.b['乙'],-660);assert.equal(result.tx[0].from,'乙');assert.equal(result.tx[0].to,'甲');
assert(ctx.expenseAdvanceHtml(e).includes('甲 代墊 → 乙'));assert(ctx.expenseAdvanceHtml(e).includes('¥3,000'));
// Equal division, custom amounts, offsetting payments, and personal expenses.
e=expense(3000,'甲',['甲','乙'],'JPY');result=ctx.settle([e],ctx.S.travelers);close(result.b['甲'],330);
const custom=expense(1000,'乙',['甲','乙','丙'],'TWD',{'甲':200,'乙':300,'丙':500});
const personal={...expense(99999,'丙',['甲']),expenseMode:'personal'};
ctx.S.expenses=[e,custom,personal];result=ctx.settle(ctx.S.expenses,ctx.S.travelers);
close(result.b['甲'],130);close(result.b['乙'],370);close(result.b['丙'],-500);
const residual={...result.b};for(const tx of result.tx){residual[tx.from]+=tx.amount;residual[tx.to]-=tx.amount;}Object.values(residual).forEach(v=>close(v,0));
// Detail converts original JPY share once; all summary totals exclude personal expense.
ctx.S.splitExpanded='乙';let markup=ctx.splt(result.b,result.tx,0);
assert(markup.includes('結餘總覽'));assert(markup.includes('共同消費 NT$1,660 · 2 筆'));assert(markup.includes('負擔 NT$330'));assert(markup.includes('NT$1,000 先付 − NT$630 負擔 = NT$370 結餘'));
// Decimal amounts are retained, including the reference screenshot's amounts.
assert.equal(ctx.fmtSettlement(10839.6),'NT$10,839.6');
result=ctx.settle([expense(377.6,'甲',['乙'])],ctx.S.travelers);assert.equal(result.tx[0].amount,377.6);
result=ctx.settle([expense(.01,'甲',['乙'])],ctx.S.travelers);assert.equal(result.tx[0].amount,.01);
for(const [currency,expected] of [['JPY',1500],['TWD',330]]){ctx.S.settleCurrency=currency;close(ctx.settle([e],ctx.S.travelers).b['甲'],expected);}ctx.S.settleCurrency='TWD';
// Clear selection must not silently charge everyone. Invalid drafts never save.
ctx.S.expenses=[];const draft={item:'代買',amount:'3000',currency:'JPY',expenseMode:'shared',paidBy:'甲',splitMode:'equal',splitWith:[]};ctx.FM={...draft};ctx.sExp();assert.equal(writes,0);assert(alerts.at(-1).includes('至少一位'));
ctx.FM={...draft,splitWith:['乙'],paidBy:''};ctx.sExp();assert.equal(writes,0);
ctx.FM={...draft,splitWith:['乙'],amount:'-3'};ctx.sExp();assert.equal(writes,0);
ctx.FM={...draft,splitWith:['乙']};assert(ctx.expenseDraftPreview().includes('¥3,000'));ctx.sExp();assert.equal(writes,1);assert.equal(ctx.S.expenses[0].splitWith.join(','),'乙');assert.equal(ctx.S.expenses[0].paidBy,'甲');
// Editing replaces the existing record instead of adding a duplicate.
ctx.S.modal={expId:'new'};ctx.FM.amount='2000';ctx.sExp();assert.equal(ctx.S.expenses.length,1);assert.equal(ctx.S.expenses[0].amount,2000);
// Custom allocations must total the expense; invalid/negative shares are rejected.
ctx.S.modal={expId:'new'};ctx.FM={...draft,amount:100,splitMode:'custom'};inputs=[{value:'99.6',dataset:{person:'乙'}}];ctx.sExp();assert.equal(writes,2);
inputs=[{value:'100',dataset:{person:'乙'}},{value:'-2',dataset:{person:'甲'}}];ctx.sExp();assert.equal(writes,2);
inputs=[{value:'100',dataset:{person:'乙'}}];ctx.sExp();assert.equal(writes,3);assert.equal(ctx.S.expenses[0].shares['乙'],100);
// Names cannot inject markup into the chart, detail or advance preview.
ctx.S.travelers=['<img src=x onerror=alert(1)>'];markup=ctx.settlementSummary({},[]);assert(!markup.includes('<img'));assert(markup.includes('&lt;img'));
ctx.S.travelers=['甲','乙'];ctx.S.expenses=[];result=ctx.settle([],ctx.S.travelers);markup=ctx.splt(result.b,result.tx,0);assert(markup.includes('收支平衡'));assert(!markup.includes('+ NT$0 應收'));
console.log('PASS: advances, net transfers, equal/custom sharing, FX, decimal precision, summary totals/details, invalid saves, edit preservation, escaping and empty state');
