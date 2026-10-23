// Case study: value extracted by attacks A1 and A3 on V3, and outcome on V4.
const fs=require('fs'),path=require('path'),solc=require('solc'),ganache=require('ganache'),{ethers}=require('ethers');
function compile(file,name){const src=fs.readFileSync(path.join(__dirname,'..','contracts',file),'utf8');
 const out=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{[file]:{content:src}},settings:{optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
 const c=out.contracts[file][name];return{abi:c.abi,bytecode:'0x'+c.evm.bytecode.object};}
(async()=>{
 const provider=new ethers.BrowserProvider(ganache.provider({logging:{quiet:true},chain:{hardfork:'shanghai',vmErrorsOnRPCResponse:true},wallet:{totalAccounts:20,defaultBalance:1000}}));
 provider.pollingInterval=20;
 const s=await Promise.all([...Array(20).keys()].map(i=>provider.getSigner(i)));
 const [auth,factory,supplier,store,buyer,risk]=s; const sybils=s.slice(10,15);
 const out={};
 for(const ver of ['V3','V4']){
  const art=compile(`RecyclingSupplyChain${ver}.sol`,ver==='V3'?'RecyclingSupplyChain':'RecyclingSupplyChainV4');
  const c=await (await new ethers.ContractFactory(art.abi,art.bytecode,auth).deploy()).waitForDeployment();
  const C=x=>c.connect(x);
  for(const [w,r] of [[factory,'Factory'],[supplier,'Supplier'],[store,'Store'],[buyer,'Buyer'],...sybils.map(x=>[x,'Buyer'])]) await (await C(auth).registerParticipant(w.address,r)).wait();
  if(ver==='V4') await (await C(auth).setRiskService(risk.address,5000)).wait();
  const W=200n, reward=W*10n**15n, sig='0x'+'11'.repeat(65);
  // 10 products made, 1 sold to a real buyer
  for(let k=0;k<10;k++) await (await C(factory).uploadProduct('Bottle',1000,50,Number(W),'2025-01-01','2026-01-01',sig,{gasLimit:5000000})).wait();
  await (await C(factory).transferProduct(0,supplier.address,10,{gasLimit:5000000})).wait();
  await (await C(supplier).transferProduct(0,store.address,10,{gasLimit:5000000})).wait();
  await (await C(store).transferProduct(0,buyer.address,10,{gasLimit:5000000})).wait();
  // A1: store claims product 0 for buyer + 5 sybils; A2: products 1..9 never sold
  let paid=0n, ok=0, blocked=0;
  const before=await Promise.all(sybils.map(x=>provider.getBalance(x.address)));
  const tryp=async p=>{try{await (await p).wait();ok++;return true;}catch(e){blocked++;return false;}};
  if(ver==='V3'){
    await tryp(C(store).recycleWaste(0,buyer.address,{value:reward,gasLimit:5000000})); 
    for(const x of sybils) await tryp(C(store).recycleWaste(0,x.address,{value:reward,gasLimit:5000000}));
    for(let id=1;id<10;id++) await tryp(C(store).recycleWaste(id,sybils[id%5].address,{value:reward,gasLimit:5000000}));
  } else {
    await tryp(C(store).requestReturn(0,Number(W),{value:reward,gasLimit:5000000}));
    await (await C(risk).submitAssessment(1,100,ethers.ZeroHash,ethers.ZeroHash)).wait();
    for(const x of sybils) await tryp(C(store).requestReturn(0,Number(W),{value:reward,gasLimit:5000000}));
    for(let id=1;id<10;id++) await tryp(C(store).requestReturn(id,Number(W),{value:reward,gasLimit:5000000}));
  }
  const after=await Promise.all(sybils.map(x=>provider.getBalance(x.address)));
  const sybilGain=after.reduce((a,b,i)=>a+(b-before[i]),0n);
  // A3: factory books reuse of the 9 unreturned products
  const p0=await c.participants(factory.address);
  let reuseOk=0; for(let id=1;id<10;id++){ try{await (await C(factory).recycle(id,{gasLimit:5000000})).wait();reuseOk++;}catch(e){} }
  const p1=await c.participants(factory.address);
  const tax=p1.totalTaxAmount, bought=p1.totalPlasticBought, reused=p1.totalPlasticReused;
  out[ver]={claims_accepted:ok,claims_blocked:blocked,sybil_reward_eth:ethers.formatEther(sybilGain),
    reuse_calls_accepted:reuseOk,plastic_reused_g:reused.toString(),plastic_bought_g:bought.toString(),tax_due:tax.toString(),
    waiver_if_applied:(tax*reused/bought).toString()};
 }
 console.log(JSON.stringify(out,null,1)); fs.writeFileSync(path.join(__dirname,'results','casestudy_results.json'),JSON.stringify(out,null,1)); process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
