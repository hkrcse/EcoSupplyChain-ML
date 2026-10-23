# Pushing this folder to GitHub

1. On github.com create an empty public repository named **EcoSupplyChain-ML** under the account `hkrcse`
   (do not add a README, license, or .gitignore there; this folder already has them).
2. In a terminal, from this folder:
   ```bash
   git init
   git add .
   git commit -m "EcoSupplyChain-ML: code, contracts, simulator, data, and results"
   git branch -M main
   git remote add origin https://github.com/hkrcse/EcoSupplyChain-ML.git
   git push -u origin main
   ```
3. Check that https://github.com/hkrcse/EcoSupplyChain-ML and
   https://github.com/hkrcse/EcoSupplyChain-ML/tree/main/data open. These are the links printed in the paper.
   If you choose another account or name, update `sections/availability.tex` in the paper and `CITATION.cff`.
4. Optional: create a release (e.g. v1.0) and archive it on Zenodo to get a DOI for the data.

The largest file is `data/seed0/features.csv.gz` (about 7.5 MB), well under GitHub's 100 MB limit.
Delete this file after pushing if you like.
