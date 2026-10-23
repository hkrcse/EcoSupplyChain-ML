"""Figures for the paper (PDF, vector). Run after run_experiments.py."""
import json, os
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import precision_recall_curve

HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(HERE, "..", "results")
FIG = os.path.join(HERE, "..", "docs", "figures")
os.makedirs(FIG, exist_ok=True)

C = {"blue": "#2a78d6", "orange": "#eb6834", "aqua": "#1baf7a", "violet": "#6250d6",
     "gray": "#8a8984", "ink": "#0b0b0b", "ink2": "#52514e", "grid": "#e4e3df"}
plt.rcParams.update({"font.family": "serif", "font.size": 8, "axes.edgecolor": C["ink2"],
                     "axes.labelcolor": C["ink"], "xtick.color": C["ink2"], "ytick.color": C["ink2"],
                     "axes.grid": True, "grid.color": C["grid"], "grid.linewidth": 0.5,
                     "axes.spines.top": False, "axes.spines.right": False, "legend.frameon": False,
                     "pdf.fonttype": 42})
W1 = 3.45   # IEEE single column (in)

P = np.load(os.path.join(R, "preds_seed0.npz"), allow_pickle=True)
y, reward = P["y"], P["reward"]

# ---- Fig: precision-recall curves ----
series = [("Rules", "Rule set", C["gray"], "--"),
          ("GBDT forward-only", "Forward only", C["orange"], "-"),
          ("GBDT reverse-only", "Reverse only", C["violet"], "-"),
          ("GBDT dual-flow (F+R+X)", "Dual-flow (F+R+X)", C["aqua"], "-"),
          ("GBDT full (F+R+X+M+G)", "Full (F+R+X+M+G)", C["blue"], "-")]
fig, ax = plt.subplots(figsize=(W1, 2.5))
for key, lab, col, ls in series:
    p, r, _ = precision_recall_curve(y, P[key])
    ax.plot(r, p, color=col, lw=1.6 if "Full" in lab else 1.2, ls=ls, label=lab)
ax.set_xlabel("Recall"); ax.set_ylabel("Precision")
ax.set_xlim(0, 1.01); ax.set_ylim(0, 1.02)
ax.legend(loc="lower left", fontsize=7)
fig.tight_layout(); fig.savefig(os.path.join(FIG, "pr_curves.pdf")); plt.close(fig)

# ---- Fig: fraudulent value paid vs legitimate requests delayed ----
fig, ax = plt.subplots(figsize=(W1, 2.4))
for key, lab, col, ls in [series[0], series[3], series[4]]:
    s = P[key]
    thr = np.unique(np.quantile(s[y == 0], np.linspace(0.80, 1.0, 400)))
    xs, ys = [], []
    for t in thr:
        f = s > t
        xs.append(100 * f[y == 0].mean())
        ys.append(100 * reward[(y == 1) & ~f].sum() / reward[y == 1].sum())
    ax.plot(xs, ys, color=col, ls=ls, lw=1.4, label=lab)
ax.axvline(1.0, color=C["ink2"], lw=0.6, ls=":")
ax.text(1.15, 90, "1% of legitimate\nrequests held", fontsize=6.5, color=C["ink2"], va="top")
ax.set_xlim(0, 10); ax.set_ylim(0, 100)
ax.set_xlabel("Legitimate requests held for review (%)")
ax.set_ylabel("Fraudulent reward value paid (%)")
ax.legend(loc="upper right", fontsize=7)
fig.tight_layout(); fig.savefig(os.path.join(FIG, "tradeoff.pdf")); plt.close(fig)

# ---- Fig: per-scheme recall (mean over seeds, temporal split) ----
d = pd.read_csv(os.path.join(R, "all_runs.csv"))
t = d[d.split == "temporal"]
models = [("Rules", "Rule set", C["gray"]), ("GBDT dual-flow (F+R+X)", "Dual-flow (F+R+X)", C["aqua"]),
          ("GBDT full (F+R+X+M+G)", "Full model", C["blue"])]
schemes = [("recall_S1_phantom", "S1\nphantom"), ("recall_S2_inflate", "S2\ninflation"),
           ("recall_S3_ring", "S3\nring"), ("recall_S4_lowslow", "S4\nlow-and-slow")]
fig, ax = plt.subplots(figsize=(W1, 2.4))
bw = 0.26
for j, (m, lab, col) in enumerate(models):
    mu = [t[t.model == m][s].mean() for s, _ in schemes]
    sd = [t[t.model == m][s].std() for s, _ in schemes]
    x = np.arange(len(schemes)) + (j - 1) * (bw + 0.02)
    lo = np.minimum(sd, mu); hi = np.minimum(sd, 1 - np.array(mu))
    ax.bar(x, mu, bw, color=col, label=lab, yerr=[lo, hi], error_kw=dict(lw=0.6, capsize=1.5, ecolor=C["ink2"]))
ax.set_xticks(np.arange(len(schemes))); ax.set_xticklabels([s for _, s in schemes])
ax.set_ylabel("Recall at validation FPR = 1%"); ax.set_ylim(0, 1.08)
ax.legend(loc="upper center", ncol=3, fontsize=6.8, bbox_to_anchor=(0.5, 1.16))
ax.grid(axis="x", visible=False)
fig.tight_layout(); fig.savefig(os.path.join(FIG, "scheme_recall.pdf")); plt.close(fig)

# ---- Fig: grouped permutation importance ----
gi = json.load(open(os.path.join(R, "group_importance.json")))
names = {"forward": "Forward history", "reverse": "Reverse history", "cross": "Cross-flow",
         "material": "Material consistency", "graph": "Store-wallet graph"}
items = sorted(gi["group_drop"].items(), key=lambda kv: kv[1][0])
fig, ax = plt.subplots(figsize=(W1, 1.8))
ax.barh([names[k] for k, _ in items], [v[0] for _, v in items], xerr=[v[1] for _, v in items],
        color=C["blue"], height=0.55, error_kw=dict(lw=0.6, ecolor=C["ink2"]))
for i, (_, v) in enumerate(items):
    ax.text(v[0] + 0.01, i, f"{v[0]:.3f}", va="center", fontsize=6.8, color=C["ink"])
ax.set_xlabel("PR-AUC drop when group is permuted")
ax.set_xlim(0, max(v[0] for _, v in items) * 1.2)
ax.grid(axis="y", visible=False)
fig.tight_layout(); fig.savefig(os.path.join(FIG, "group_importance.pdf")); plt.close(fig)
print("figures written to", FIG)

# ---- Fig: case study timeline (store 28, seed 0) ----
cs = json.load(open(os.path.join(R, "case_study.json")))
g = pd.read_csv(os.path.join(R, "case_store28.csv"))
fig, ax = plt.subplots(figsize=(W1, 2.45))
h, f = g[g.label == 0], g[g.label == 1]
ax.scatter(h.t_req, np.clip(h.p, 1e-5, 1), s=9, color=C["gray"], alpha=0.55, lw=0, label=f"Honest claims ({len(h)})")
ax.scatter(f.t_req, np.clip(f.p, 1e-5, 1), s=16, color=C["orange"], marker="D", lw=0, label=f"Sybil claims ({len(f)})")
ax.axhline(cs["threshold"], color=C["blue"], lw=1.0, ls="--")
ax.text(131, cs["threshold"] * 1.6, "hold threshold (1% FPR on validation)", fontsize=6.5, color=C["blue"])
ax.set_yscale("log"); ax.set_ylim(1e-5, 1.5); ax.set_xlim(130, 180)
ax.set_xlabel("Day of claim (test period)"); ax.set_ylabel("Risk score $p_i$ (log scale)")
ax.legend(loc="lower center", fontsize=6.8, ncol=2, bbox_to_anchor=(0.5, 1.0))
fig.tight_layout(); fig.savefig(os.path.join(FIG, "case_store28.pdf")); plt.close(fig)
print("case figure written")
