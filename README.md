# EcoSupplyChain-ML

Code and data for the journal paper **"EcoSupplyChain-ML: Cross-Flow Fraud Detection for Blockchain-Based Recycling Incentives in a Dual-Flow Supply Chain"** (extended version of the ICACT 2026 conference paper *EcoSupplyChain*).

EcoSupplyChain records a product's path from factory to buyer on Ethereum and pays rewards as its packaging comes back for recycling. This repository holds:

- the original prototype DApp and contracts (V3),
- a hardened contract (V4) that fixes four business-logic flaws found in V3,
- scripts that measure gas and replay the attacks on a local chain,
- **EcoSC-Sim**, a simulator of forward sales and reverse returns with four fraud schemes,
- a gradient-boosted fraud detector that links each return to the sales behind it,
- the raw results behind every table and figure in the paper.

> All fraud-detection results come from the simulator, not from a real deployment.

---

## Repository layout

```
EcoSupplyChain-ML/
├── dapp/          React 19 + ethers.js prototype DApp (conference version, V3 contract)
├── contracts/     RecyclingSupplyChainV3.sol, RecyclingSupplyChainV4.sol, VerifySignature.sol
├── chain/         bench.js (gas + attack replay), casestudy.js (security case 1)
│   └── results/   chain_results.json, casestudy_results.json
├── ml/            simulate.py, features.py, run_experiments.py, case_study.py,
│                  make_figures.py, export_dataset.py, requirements.txt
├── data/seed0/    EcoSC-Sim world 0: sales, return requests, 39 features + labels
├── results/       per-seed results behind Tables V, XI, XII and Figs. 7-11
└── docs/figures/  result figures (PDF) as they appear in the paper
```

## Requirements

| | Minimum | Used for the paper |
|---|---|---|
| Hardware | any 64-bit CPU, 4 GB RAM, no GPU | Intel Xeon 2.1 GHz, 2 vCPUs, 8 GB RAM |
| OS | Linux, macOS, or Windows | Ubuntu 24.04.5 LTS |
| Python | 3.10+ | 3.13 (scikit-learn 1.9.1, NumPy 2.5.3, pandas 3.0.5) |
| Node.js | 18+ | 22 (solc 0.8.19, Ganache 7.9.2, ethers 6.13.2) |

## Quick start

### 1. Reproduce the detection results (Tables V, XI, XII and Figs. 7-11)

```bash
cd ml
pip install -r requirements.txt
python3 run_experiments.py --seeds 5   # about 8 minutes on 2 vCPUs
python3 case_study.py                  # security case 2 and 3 (store-level view)
python3 make_figures.py                # writes docs/figures/*.pdf
```

`run_experiments.py` generates five worlds (seeds 0-4), builds the features, trains every model, and evaluates it on three splits (temporal, unseen stores, unseen schemes). Results go to `results/all_runs.csv` (one row per seed, split, and model) and `results/summary.csv` (mean and standard deviation).

### 2. Reproduce the contract results (Tables IX, X, XIII)

```bash
cd chain
npm install
node bench.js        # gas per call for V3 and V4, attacks A1-A4 -> results/chain_results.json
node casestudy.js    # one sale, fifteen rewards (security case 1) -> results/casestudy_results.json
```

Both scripts start an in-process Ganache chain, so no wallet or network is needed.

### 3. Run the prototype DApp (optional)

See [`dapp/README.md`](dapp/README.md). It needs Ganache (or a testnet), Truffle, and MetaMask.

## The data set (EcoSC-Sim)

`data/seed0/` contains world 0, the world used for the case studies. The other worlds are regenerated exactly with `python3 ml/export_dataset.py --seed N`. See [`data/README.md`](data/README.md) for the full schema.

| File | Rows | Content |
|---|---|---|
| `sales.csv.gz` | 619,553 | one row per item sold (wallet, store, supplier, time, category, scheme tag) |
| `requests.csv.gz` | 61,047 | one row per stage-0 return request, with product list, expected and measured weight, reward, label |
| `features.csv.gz` | 61,047 | the 39 decision-time features, label, scheme, audit flag |

Fraud schemes (all pass every V4 contract check):

| Scheme | What the dishonest store does |
|---|---|
| S1 phantom | sells to its own Sybil wallets and files returns within hours, almost no material |
| S2 inflation | pads honest buyers' returns with items they bought but kept |
| S3 ring | three stores share Sybil wallets and hand in substitute material of matching weight |
| S4 low and slow | many Sybil wallets, small returns, realistic delays, most of the weight |

## How the pieces fit

1. **V4 contract** (`contracts/RecyclingSupplyChainV4.sol`) enforces exact rules: one reward per product and stage, claimant must be the recorded buyer, stages in order, reuse only by the manufacturer after the item came back. Rewards go through `requestReturn` → `submitAssessment` → pay or hold → `resolveHold`.
2. **Risk service** (off-chain) reads `ReturnRequested` events, computes the 39 features with `ml/features.py`, scores the claim with the GBDT, and posts the score, a model version tag, and an evidence hash with `submitAssessment`.
3. **Authority** reviews held claims. Audit outcomes become new training labels.

## Main results (5 simulated worlds, temporal split)

| Detector | PR-AUC | Fraud value paid |
|---|---|---|
| Rule set (6 rules) | 0.800 | 32.2% |
| GBDT forward only | 0.506 | 41.0% |
| GBDT reverse only | 0.523 | 47.9% |
| GBDT dual-flow (F+R+X) | 0.863 | 18.8% |
| GBDT full (F+R+X+M+G) | 0.950 | 8.4% |
| GBDT ensemble (full + no-material) | 0.972 | 6.1% |

V4 uses 22.6% less gas than V3 over one product's full lifecycle and blocks all four V3 attacks.

## Citation

If you use this code or data, please cite the paper (see `CITATION.cff`).

## License

Code: MIT (see `LICENSE`). Data in `data/`: CC BY 4.0.
