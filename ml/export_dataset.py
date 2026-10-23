"""Export the raw EcoSC-Sim records of one world to data/seed<N>/.

  python3 export_dataset.py --seed 0

Writes sales.csv.gz (one row per item sold) and requests.csv.gz (one row per
stage-0 return request). features.csv.gz is written by run_experiments.py.
"""
import argparse, os
import numpy as np
import simulate

CATS = ["PET", "CAN", "HDPE", "PACK"]

def main(seed):
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", f"seed{seed}")
    os.makedirs(out, exist_ok=True)
    sale, req, meta = simulate.simulate(seed)
    s = sale.copy()
    s["category"] = [CATS[c] for c in s.cat]
    s = s.drop(columns=["cat", "synthetic"]).rename(columns={"scheme": "scheme_tag"})
    s.round(4).to_csv(os.path.join(out, "sales.csv.gz"), index=False)
    r = req.copy()
    r["categories"] = [";".join(CATS[c] for c in cs) for cs in r.cats]
    r["sale_times"] = [";".join(f"{t:.4f}" for t in ts) for ts in r.t_sales]
    r = r[["req_id", "wallet", "store", "supplier", "t_req", "n_items", "categories", "sale_times",
           "w_exp", "w_meas", "reward", "label", "scheme"]]
    r.round(4).to_csv(os.path.join(out, "requests.csv.gz"), index=False)
    print(f"seed {seed}: {len(s)} sales, {len(r)} requests -> {out}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--seed", type=int, default=0)
    main(ap.parse_args().seed)
