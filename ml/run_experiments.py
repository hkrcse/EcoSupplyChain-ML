"""
Experiments for EcoSupplyChain-ML.

  python3 run_experiments.py --seeds 5

Writes results/*.json, results/*.csv and per-seed predictions used by
make_figures.py.
"""
import argparse, json, os, time
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, roc_auc_score, brier_score_loss

import simulate
import features as F

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "results")
DATA = os.path.join(HERE, "..", "data", "seed0")
os.makedirs(DATA, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

T_TRAIN, T_VAL = 110.0, 130.0
TARGET_FPR = 0.01
G = F.GROUPS
SETS = {
    "GBDT forward-only": G["forward"] + ["n_items"],
    "GBDT reverse-only": G["reverse"],
    "GBDT forward+reverse (no cross)": G["forward"] + G["reverse"],
    "GBDT dual-flow (F+R+X)": G["forward"] + G["reverse"] + G["cross"],
    "GBDT full (F+R+X+M+G)": F.all_features(),
    "GBDT full - material": [f for f in F.all_features() if f not in G["material"]],
    "GBDT full - graph": [f for f in F.all_features() if f not in G["graph"]],
    "GBDT full - material - graph": [f for f in F.all_features() if f not in G["material"] + G["graph"]],
}


def rule_score(X):
    """Operator rules written before seeing test data; score = rules fired."""
    r = np.zeros(len(X))
    r += (X.resid.values < -0.25)                                  # material deficit
    r += (X.frac_fast.values > 0.5)                                # returned within 24 h of sale
    r += (X.n_items.values >= 15) & (X.w_age.values < 14)          # bulk return by new wallet
    r += (X.w_ret_ratio.values > 0.9) & (X.w_prev_req.values >= 2)  # returns ~everything it buys
    r += (X.s_ret_ratio_30.values > 0.6)                           # store returns > 60 % of sales
    r += (X.w_ret_stores.values >= 2) & (X.w_age.values < 30)      # new wallet across stores
    return r + 1e-3 * X.resid_abs.values                           # tie-break


def gbdt(seed):
    return HistGradientBoostingClassifier(max_iter=400, learning_rate=0.05, max_leaf_nodes=31,
                                          min_samples_leaf=40, l2_regularization=1.0,
                                          early_stopping=False, random_state=seed)


def thr_at_fpr(score, y, fpr):
    neg = np.sort(score[y == 0])
    return neg[int(np.ceil((1 - fpr) * len(neg))) - 1] if len(neg) else np.inf


def evaluate(score, y, thr, value, scheme):
    flag = score > thr
    tp, fp = (flag & (y == 1)).sum(), (flag & (y == 0)).sum()
    res = dict(
        pr_auc=float(average_precision_score(y, score)),
        roc_auc=float(roc_auc_score(y, score)),
        recall=float(tp / max((y == 1).sum(), 1)),
        precision=float(tp / max(tp + fp, 1)),
        fpr=float(fp / max((y == 0).sum(), 1)),
        fraud_value_paid=float(value[(y == 1) & ~flag].sum() / max(value[y == 1].sum(), 1e-12)),
        legit_delayed=float(fp / max((y == 0).sum(), 1)),
    )
    for s in ["S1_phantom", "S2_inflate", "S3_ring", "S4_lowslow"]:
        m = scheme == s
        res["recall_" + s] = float(flag[m].mean()) if m.any() else float("nan")
    return res


def fit_predict(name, cols, tr, va, te, seed):
    if name == "Rules":
        return rule_score(va), rule_score(te), None
    Xtr, Xva, Xte = tr[cols].values, va[cols].values, te[cols].values
    if name == "Isolation Forest (full, unsupervised)":
        m = IsolationForest(n_estimators=300, random_state=seed).fit(Xtr[tr.label.values == 0])
        return -m.score_samples(Xva), -m.score_samples(Xte), m
    if name == "Logistic regression (full)":
        m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, class_weight="balanced", C=0.5))
        m.fit(Xtr, tr.label.values)
        return m.predict_proba(Xva)[:, 1], m.predict_proba(Xte)[:, 1], m
    if name == "GBDT ensemble (full + no-material)":
        c2 = SETS["GBDT full - material"]
        m1 = gbdt(seed).fit(Xtr, tr.label.values)
        m2 = gbdt(seed).fit(tr[c2].values, tr.label.values)
        f = lambda d: 0.5 * (m1.predict_proba(d[cols].values)[:, 1] + m2.predict_proba(d[c2].values)[:, 1])
        return f(va), f(te), None
    m = gbdt(seed).fit(Xtr, tr.label.values)
    return m.predict_proba(Xva)[:, 1], m.predict_proba(Xte)[:, 1], m


def models():
    d = {"Rules": None, "Isolation Forest (full, unsupervised)": F.all_features(),
         "Logistic regression (full)": F.all_features()}
    d.update(SETS)
    d["GBDT ensemble (full + no-material)"] = F.all_features()
    return d


def run_split(tag, tr, va, te, seed, store_preds=False, only=None):
    rows, preds = [], {}
    for name, cols in models().items():
        if only and name not in only:
            continue
        t0 = time.time()
        sva, ste, m = fit_predict(name, cols, tr, va, te, seed)
        thr = thr_at_fpr(sva, va.label.values, TARGET_FPR)
        r = evaluate(ste, te.label.values, thr, te.reward.values, te.scheme.values)
        r.update(model=name, split=tag, seed=seed, fit_s=round(time.time() - t0, 2))
        if name == "GBDT full (F+R+X+M+G)":
            iso = IsotonicRegression(out_of_bounds="clip").fit(sva, va.label.values)
            r["brier_raw"] = float(brier_score_loss(te.label.values, ste))
            r["brier_iso"] = float(brier_score_loss(te.label.values, iso.predict(ste)))
            x1 = te[cols].values[:1]
            for _ in range(20): m.predict_proba(x1)
            t1 = time.perf_counter()
            for _ in range(500): m.predict_proba(x1)
            r["latency_ms_single"] = (time.perf_counter() - t1) / 500 * 1e3
            t1 = time.perf_counter(); m.predict_proba(te[cols].values)
            r["throughput_per_s"] = len(te) / (time.perf_counter() - t1)
            if store_preds:
                preds["model"] = m
        rows.append(r)
        if store_preds:
            preds[name] = ste
    return rows, preds


def main(seeds):
    allrows, summary_data = [], {}
    for seed in range(seeds):
        t0 = time.time()
        sale, req, meta = simulate.simulate(seed)
        X = F.build(sale, req, seed)
        X.drop(columns=["cats", "t_sales"]).to_csv(os.path.join(DATA, "features.csv.gz"), index=False) if seed == 0 else None
        summary_data[seed] = dict(n_sales=int(len(sale)), n_req=int(len(X)),
                                  n_fraud=int(X.label.sum()),
                                  by_scheme=X.scheme.value_counts().to_dict(), meta=meta)
        tr, va, te = X[X.t_req < T_TRAIN], X[(X.t_req >= T_TRAIN) & (X.t_req < T_VAL)], X[X.t_req >= T_VAL]

        # 1) temporal split
        rows, preds = run_split("temporal", tr, va, te, seed, store_preds=(seed == 0))
        allrows += rows
        if seed == 0:
            np.savez(os.path.join(OUT, "preds_seed0.npz"), y=te.label.values, scheme=te.scheme.values,
                     reward=te.reward.values,
                     **{k: v for k, v in preds.items() if k != "model"})
            # grouped permutation importance on the test period
            m = preds["model"]; cols = F.all_features()
            base = average_precision_score(te.label.values, m.predict_proba(te[cols].values)[:, 1])
            rng = np.random.default_rng(0); imp = {}
            for g, fs in F.GROUPS.items():
                drops = []
                for rep in range(5):
                    Xp = te[cols].copy()
                    perm = rng.permutation(len(Xp))
                    for f in fs:
                        Xp[f] = Xp[f].values[perm]
                    drops.append(base - average_precision_score(te.label.values, m.predict_proba(Xp.values)[:, 1]))
                imp[g] = [float(np.mean(drops)), float(np.std(drops))]
            json.dump(dict(base_pr_auc=base, group_drop=imp), open(os.path.join(OUT, "group_importance.json"), "w"), indent=1)

        # 2) unseen stores: test stores never appear in training
        rng = np.random.default_rng(100 + seed)
        stores = np.arange(int(X.store.max()) + 1)
        fraud_stores = meta["s1"] + meta["s2"] + meta["s4"] + meta["ring"]
        test_st = set()
        for grp in [meta["s1"], meta["s2"], meta["s4"], meta["ring"]]:
            test_st.add(int(rng.choice(grp)))
        legit_st = [s for s in stores if s not in fraud_stores]
        test_st |= set(rng.choice(legit_st, 9, replace=False).tolist())
        in_test = X.store.isin(test_st)
        rows, _ = run_split("unseen-stores", tr[~in_test.loc[tr.index]], va[~in_test.loc[va.index]],
                            te[in_test.loc[te.index]], seed,
                            only=["Rules", "Logistic regression (full)", "GBDT dual-flow (F+R+X)",
                                  "GBDT full (F+R+X+M+G)", "GBDT full - material - graph",
                                  "GBDT ensemble (full + no-material)"])
        allrows += rows

        # 3) leave-one-scheme-out: scheme absent from train/val, present in test
        for s in ["S1_phantom", "S2_inflate", "S3_ring", "S4_lowslow"]:
            keep = lambda d: d[d.scheme != s]
            te_s = te[(te.scheme == s) | (te.label == 0)]
            rows, _ = run_split("unseen-" + s, keep(tr), keep(va), te_s, seed,
                                only=["Rules", "GBDT full (F+R+X+M+G)", "GBDT full - material",
                                      "GBDT ensemble (full + no-material)"])
            allrows += rows
        print(f"seed {seed} done in {time.time() - t0:.0f}s", flush=True)

    df = pd.DataFrame(allrows)
    df.to_csv(os.path.join(OUT, "all_runs.csv"), index=False)
    num = [c for c in df.columns if c not in ("model", "split", "seed")]
    agg = df.groupby(["split", "model"])[num].agg(["mean", "std"])
    agg.to_csv(os.path.join(OUT, "summary.csv"))
    json.dump(summary_data, open(os.path.join(OUT, "dataset_summary.json"), "w"), indent=1, default=int)
    pd.set_option("display.width", 250); pd.set_option("display.max_rows", 200)
    show = ["pr_auc", "recall", "precision", "fraud_value_paid", "legit_delayed",
            "recall_S1_phantom", "recall_S2_inflate", "recall_S3_ring", "recall_S4_lowslow"]
    print(df.groupby(["split", "model"])[show].mean().round(3))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--seeds", type=int, default=5)
    main(ap.parse_args().seeds)
