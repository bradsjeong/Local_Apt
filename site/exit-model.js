/* Amounts in 만원. Deposits are liabilities, principal repayments are cash flows. */
(function(root){
  function run(a,cycle,growth=a.growth){
    const wait=a.wait, months=wait+cycle.months, discount=Math.pow(1+a.discount/100,1/12);
    let debt=a.loan, cash=0,pv=0,interest=0,principal=0,rentTotal=0,costTotal=0,minCash=0;
    const monthlyPrincipal=a.amortization==='principal'?a.loan/a.loanMonths:0;
    const newDeposit=cycle.kind==='monthly'?a.monthlyDeposit:a.jeonse;
    const newRent=cycle.kind==='monthly'?Math.max(0,a.jeonse-newDeposit)*a.conversion/100/12:0;
    for(let m=1;m<=months;m++){
      // At the start of the new lease, return old deposit and receive new deposit.
      if(m===wait+1){const change=newDeposit-a.deposit;cash+=change;pv+=change/Math.pow(discount,wait);minCash=Math.min(minCash,cash);}
      const received=m<=wait?a.rent:newRent;
      const bank=debt*a.interest/100/12,repayment=Math.min(debt,monthlyPrincipal);
      const cost=(a.tax+a.other)/12;
      const flow=received-bank-repayment-cost;
      debt-=repayment;cash+=flow;pv+=flow/Math.pow(discount,m);
      interest+=bank;principal+=repayment;rentTotal+=received;costTotal+=cost;
      minCash=Math.min(minCash,cash);
    }
    const price=a.price*Math.pow(1+growth/100,months/12);
    const finalDeposit=cycle.months?newDeposit:a.deposit;
    const net=price*(1-a.fee/100)-debt-finalDeposit-cycle.saleTax;
    const npv=pv+net/Math.pow(discount,months);
    const immediate=a.price*(1-a.fee/100)-a.loan-a.deposit-a.saleTax0;
    const breakEven=((immediate-pv)*Math.pow(discount,months)+debt+finalDeposit+cycle.saleTax)/(1-a.fee/100);
    return {months,price,net,cash,npv,immediate,advantage:npv-immediate,breakEven,interest,principal,rentTotal,costTotal,debt,deposit:finalDeposit,newRent,minCash,total:net+cash};
  }
  const api={run};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ExitModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
