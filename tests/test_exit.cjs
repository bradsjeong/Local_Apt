const assert=require('node:assert/strict');
const {run}=require('../site/exit-model.js');
const a={price:40000,loan:10000,deposit:20000,rent:0,wait:0,monthlyDeposit:10000,jeonse:20000,conversion:6,interest:0,amortization:'interest',loanMonths:120,tax:0,other:0,discount:0,fee:0,growth:0,saleTax0:0};
const cycle={kind:'jeonse',months:24,saleTax:0};
assert.equal(run(a,cycle).total,10000);
// Receiving more refundable deposit must not create wealth.
assert.equal(run({...a,jeonse:25000},cycle).total,10000);
assert.equal(run({...a,jeonse:15000},cycle).total,10000);
// Principal reduces cash and debt equally, rather than counting as an expense twice.
assert.ok(Math.abs(run({...a,amortization:'principal'},cycle).total-10000)<1e-7);
assert.equal(run({...a,interest:6},cycle).interest,1200);
assert.equal(run({...a,interest:6},cycle).total,8800);
const monthly=run(a,{kind:'monthly',months:12,saleTax:0});
assert.equal(monthly.newRent,50);assert.equal(monthly.total,10600);assert.equal(monthly.minCash,-10000);
// Existing lease continues until expiry; new terms start afterwards.
assert.equal(run({...a,wait:6,rent:30},{kind:'monthly',months:12,saleTax:0}).rentTotal,780);
const withCosts={...a,interest:5,tax:100,discount:3,fee:0.5};
const r=run(withCosts,cycle);
const g=(Math.pow(r.breakEven/a.price,12/r.months)-1)*100;
assert.ok(Math.abs(run(withCosts,cycle,g).advantage)<1e-7);
console.log('Exit model: deposit, loan, lease timing and break-even checks passed');
