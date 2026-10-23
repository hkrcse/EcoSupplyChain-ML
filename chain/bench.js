// Compile V3 and V4, deploy on an in-process Ganache chain, run one full
// lifecycle on each, record gas per call, and replay four attacks.
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const ganache = require('ganache');
const { ethers } = require('ethers');

function compile(file, name) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'contracts', file), 'utf8');
  const input = { language: 'Solidity', sources: { [file]: { content: src } },
    settings: { optimizer: { enabled: true, runs: 200 }, viaIR: false,
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  (out.errors || []).forEach(e => { if (e.severity === 'error') { console.error(e.formattedMessage); process.exit(1); } });
  const c = out.contracts[file][name];
  return { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
}

const results = { gas: {}, attacks: {}, latency: {} };

async function main() {
  const provider = new ethers.BrowserProvider(ganache.provider({
    logging: { quiet: true }, chain: { hardfork: 'shanghai', vmErrorsOnRPCResponse: true },
    wallet: { totalAccounts: 12, defaultBalance: 1000 }, miner: { blockGasLimit: 30000000 } }));
  provider.pollingInterval = 20;
  const s = await Promise.all([...Array(12).keys()].map(i => provider.getSigner(i)));
  const [auth, factory, supplier, store, buyer, risk, sybil, factory2] = s;

  async function g(label, txp, tbl) {
    const t0 = process.hrtime.bigint();
    const tx = await txp; const rc = await tx.wait();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    tbl[label] = tbl[label] || []; tbl[label].push(Number(rc.gasUsed));
    results.latency[label] = results.latency[label] || []; results.latency[label].push(ms);
    return rc;
  }
  async function tryTx(p) { try { const tx = await p; await tx.wait(); return 'SUCCEEDED'; } catch (e) { const m = (e.info && e.info.error && e.info.error.message) || e.reason || e.shortMessage || e.message; return 'REVERTED: ' + String(m).replace('VM Exception while processing transaction: ', '').slice(0, 80); } }

  const sig = '0x' + '11'.repeat(65);
  const W = 200; // grams of plastic
  const rate = 10n ** 15n;
  const reward = BigInt(W) * rate;

  for (const ver of ['V3', 'V4']) {
    const art = compile(`RecyclingSupplyChain${ver}.sol`, ver === 'V3' ? 'RecyclingSupplyChain' : 'RecyclingSupplyChainV4');
    const F = new ethers.ContractFactory(art.abi, art.bytecode, auth);
    const c = await F.deploy(); const dep = await c.deploymentTransaction().wait();
    const tbl = results.gas[ver] = { deploy: [Number(dep.gasUsed)] };
    const C = (sg) => c.connect(sg);
    await g('registerParticipant', C(auth).registerParticipant(factory.address, 'Factory'), tbl);
    for (const [w, r] of [[supplier, 'Supplier'], [store, 'Store'], [buyer, 'Buyer'], [sybil, 'Buyer'], [factory2, 'Factory']])
      await g('registerParticipant', C(auth).registerParticipant(w.address, r), tbl);
    if (ver === 'V4') await g('setRiskService', C(auth).setRiskService(risk.address, 5000), tbl);

    // N products through the full cycle to average gas
    const N = 5;
    for (let k = 0; k < N; k++) {
      await g('uploadProduct', C(factory).uploadProduct('Bottle', 1000, 50, W, '2025-01-01', '2026-01-01', sig), tbl);
    }
    for (let id = 0; id < N; id++) {
      await g('transferProduct', C(factory).transferProduct(id, supplier.address, 10), tbl);
      await g('transferProduct', C(supplier).transferProduct(id, store.address, 10), tbl);
      await g('transferProduct', C(store).transferProduct(id, buyer.address, 10), tbl);
    }
    for (let id = 0; id < N - 1; id++) { // last product is kept for attacks
      if (ver === 'V3') {
        await g('recycleWaste', C(store).recycleWaste(id, buyer.address, { value: reward }), tbl);
        await g('recycleWaste', C(supplier).recycleWaste(id, store.address, { value: reward }), tbl);
        await g('recycleWaste', C(factory).recycleWaste(id, supplier.address, { value: reward }), tbl);
      } else {
        const actors = [store, supplier, factory];
        for (let st = 0; st < 3; st++) {
          await g('requestReturn', C(actors[st]).requestReturn(id, W, { value: reward }), tbl);
          const cid = await c.nextClaimId();
          const score = (id === 1 && st === 0) ? 8000 : 1200; // one held claim
          await g('submitAssessment', C(risk).submitAssessment(cid, score, ethers.encodeBytes32String('gbdt-v1'), ethers.id('evidence' + cid)), tbl);
          if (score >= 5000) await g('resolveHold', C(auth).resolveHold(cid, true), tbl);
        }
      }
      await g('recycle', C(factory).recycle(id), tbl);
    }
    await g('authorityTaxWaiveToFactory', C(auth).authorityTaxWaiveToFactory(factory.address), tbl);

    // ---------------- attacks ----------------
    const A = results.attacks[ver] = {};
    const victim = N - 1; // sold to buyer, never returned
    // a1: same product rewarded to two different wallets
    if (ver === 'V3') {
      await (await C(store).recycleWaste(victim, buyer.address, { value: reward })).wait();
      A['A1 duplicate reward, second wallet'] = await tryTx(C(store).recycleWaste(victim, sybil.address, { value: reward }));
    } else {
      await (await C(store).requestReturn(victim, W, { value: reward })).wait();
      const cid = await c.nextClaimId();
      await (await C(risk).submitAssessment(cid, 100, ethers.ZeroHash, ethers.ZeroHash)).wait();
      A['A1 duplicate reward, second wallet'] = await tryTx(C(store).requestReturn(victim, W, { value: reward }));
    }
    // a2: reward for an item that never reached a buyer (still in store stock)
    await (await C(factory).uploadProduct('Bottle', 1000, 50, W, '2025-01-01', '2026-01-01', sig)).wait();
    const unsold = Number(await c.nextProductId()) - 1;
    await (await C(factory).transferProduct(unsold, supplier.address, 10)).wait();
    await (await C(supplier).transferProduct(unsold, store.address, 10)).wait();
    if (ver === 'V3') A['A2 reward for unsold item'] = await tryTx(C(store).recycleWaste(unsold, sybil.address, { value: reward }));
    else A['A2 reward for unsold item'] = await tryTx(C(store).requestReturn(unsold, W, { value: reward }));
    // a3: factory records reuse of material that never came back -> inflated tax waiver
    await (await C(factory).uploadProduct('Bottle', 1000, 50, W, '2025-01-01', '2026-01-01', sig)).wait();
    const fresh = Number(await c.nextProductId()) - 1;
    A['A3 reuse claim without return'] = await tryTx(C(factory).recycle(fresh));
    // a4: another factory claims reuse of a product it did not make
    A['A4 reuse claim by other factory'] = await tryTx(C(factory2).recycle(0));
  }

  const summ = {};
  for (const v of ['V3', 'V4']) {
    summ[v] = {};
    for (const [k, arr] of Object.entries(results.gas[v])) summ[v][k] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }
  results.gasMean = summ;
  const lat = {};
  for (const [k, arr] of Object.entries(results.latency)) lat[k] = +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
  results.latencyMean = lat;
  delete results.latency;
  fs.writeFileSync(path.join(__dirname, 'results', 'chain_results.json'), JSON.stringify(results, null, 1));
  console.log(JSON.stringify({ gasMean: summ, attacks: results.attacks }, null, 1));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
