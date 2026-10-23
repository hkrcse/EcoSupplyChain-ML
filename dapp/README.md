# EcoSupplyChain prototype DApp

React 19 front end for the five EcoSupplyChain roles (authority, factory, supplier, store, buyer). It talks to the contracts with ethers.js 6 through MetaMask and generates and scans product QR codes.

This is the conference (V3) prototype. The hardened V4 contract is in `../contracts/` and is exercised by the scripts in `../chain/`; the front end has not yet been wired to V4's request/assess/pay flow.

## Run locally

1. Install Node.js 18+, [Ganache](https://archive.trufflesuite.com/ganache/) (GUI on port 7545), Truffle (`npm install -g truffle`), and the MetaMask browser extension.
2. Deploy the contracts to Ganache:
   ```bash
   cd dapp
   npm install
   truffle migrate --network development
   ```
3. Copy the deployed addresses into `src/App.js`:
   - `CONTRACT_ADDRESS` (RecyclingSupplyChain)
   - `signatureContract_Address` (VerifySignature)
4. Set the authority wallet: `src/App.js` treats the address checked near the `setRole('Authority')` line as the authority. Replace it with the Ganache account that deployed the contract.
5. Import Ganache accounts into MetaMask, connect MetaMask to `http://127.0.0.1:7545`, and start the app:
   ```bash
   npm start
   ```
6. As the authority, register the other wallets with their roles; then use the factory, supplier, store, and buyer views.

## Folders

- `contracts/` — V3 contracts as released with the conference paper
- `migrations/` — Truffle deployment scripts
- `src/` — React application (`App.js` holds the UI and contract calls)
- `public/` — static assets
