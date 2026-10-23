"""Security case study: per-claim view of one low-and-slow (S4) store, seed 0."""
import json, os, numpy as np, pandas as pd
import features as F
from run_experiments import gbdt, rule_score, thr_at_fpr, T_TRAIN, T_VAL
HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(HERE, "..", "results")
X = pd.read_csv(os.path.join(HERE, "..", "data", "seed0", "features.csv.gz"))
meta = json.load(open(os.path.join(R, "dataset_summary.json")))["0"]["meta"]
cols = F.all_features()
tr, va, te = X[X.t_req < T_TRAIN], X[(X.t_req >= T_TRAIN) & (X.t_req < T_VAL)], X[X.t_req >= T_VAL].copy()
m = gbdt(0).fit(tr[cols].values, tr.label.values)
thr = thr_at_fpr(m.predict_proba(va[cols].values)[:, 1], va.label.values, 0.01)
rthr = thr_at_fpr(rule_score(va), va.label.values, 0.01)
te["p"] = m.predict_proba(te[cols].values)[:, 1]; te["rule"] = rule_score(te)
out = {"threshold": float(thr), "rule_threshold": float(rthr), "stores": {}}
for s in meta["s4"] + meta["s1"]:
    g = te[te.store == s]
    if g.label.sum() == 0: continue
    f, h = g[g.label == 1], g[g.label == 0]
    out["stores"][int(s)] = dict(
        scheme=str(f.scheme.iloc[0]), n_fraud=int(len(f)), n_legit=int(len(h)),
        fraud_held_ml=int((f.p > thr).sum()), fraud_held_rules=int((f.rule > rthr).sum()),
        legit_held_ml=int((h.p > thr).sum()), legit_held_rules=int((h.rule > rthr).sum()),
        fraud_value=float(f.reward.sum()), fraud_value_paid_ml=float(f.reward[f.p <= thr].sum()),
        fraud_value_paid_rules=float(f.reward[f.rule <= rthr].sum()),
        median_fraud=dict(n_items=float(f.n_items.median()), w_age=float(f.w_age.median()), w_prev_req=float(f.w_prev_req.median()),
                          delay_med=float(f.delay_med.median()), resid=float(f.resid.median()), w_ret_ratio=float(f.w_ret_ratio.median()),
                          s_ret_ratio_30=float(f.s_ret_ratio_30.median()), s_new_wallet_frac=float(f.s_new_wallet_frac.median())),
        median_legit=dict(n_items=float(h.n_items.median()), w_age=float(h.w_age.median()), w_prev_req=float(h.w_prev_req.median()),
                          delay_med=float(h.delay_med.median()), resid=float(h.resid.median()), w_ret_ratio=float(h.w_ret_ratio.median()),
                          s_ret_ratio_30=float(h.s_ret_ratio_30.median()), s_new_wallet_frac=float(h.s_new_wallet_frac.median())))
    g[["t_req", "label", "p", "rule", "reward"]].to_csv(os.path.join(R, f"case_store{s}.csv"), index=False)
json.dump(out, open(os.path.join(R, "case_study.json"), "w"), indent=1)
print(json.dumps(out, indent=1))
