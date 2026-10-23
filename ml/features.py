"""
Decision-time features for each return request.

Every feature for request i uses only events with timestamp < t_req(i)
(store/supplier aggregates use whole days strictly before the request day).
Audit outcomes become visible AUDIT_LAG days after the audited request.
"""
import numpy as np
import pandas as pd

AUDIT_RATE = 0.05
AUDIT_LAG = 14.0

GROUPS = {
    "forward": ["w_items_bought", "w_items_bought_30", "w_visits", "w_age", "w_stores_bought",
                "w_basket", "s_sales_7", "s_sales_30"],
    "reverse": ["n_items", "w_exp", "f_PET", "f_CAN", "f_HDPE", "f_PACK", "w_prev_req", "w_prev_ret_items",
                "w_since_last_req", "s_ret_req_7", "s_ret_req_30", "s_burst", "s_audit_viol", "w_audit_viol"],
    "cross": ["delay_min", "delay_med", "delay_max", "frac_fast", "w_ret_ratio", "s_ret_ratio_30",
              "s_fast_frac_30", "sup_ret_ratio_30"],
    "material": ["resid", "resid_abs", "s_resid_30"],
    "graph": ["s_top5_share", "s_multistore_frac", "s_shared_nbrs", "s_new_wallet_frac",
              "w_ret_stores", "s_ratio_vs_peers"],
}


def _asof(left, right, by, on_left, on_right, cols, shift=0.0):
    """Value of cumulative columns in `right` just before left[on_left] - shift."""
    L = left[[by, on_left]].copy()
    L["_t"] = L[on_left] - shift
    L["_i"] = np.arange(len(L))
    L = L.sort_values("_t")
    R = right[[by, on_right] + cols].sort_values(on_right)
    M = pd.merge_asof(L, R, left_on="_t", right_on=on_right, by=by, allow_exact_matches=False)
    M = M.sort_values("_i")
    return M[cols].fillna(0.0).values


def build(sale, req, seed=0):
    rng = np.random.default_rng(seed + 991)
    req = req.copy()
    t = req.t_req.values

    # ---------------- request-level ----------------
    req["f_PET"] = [np.mean(c == 0) for c in req.cats]
    req["f_CAN"] = [np.mean(c == 1) for c in req.cats]
    req["f_HDPE"] = [np.mean(c == 2) for c in req.cats]
    req["f_PACK"] = [np.mean(c == 3) for c in req.cats]
    d = [tr - ts for tr, ts in zip(t, req.t_sales)]
    req["delay_min"] = [x.min() for x in d]
    req["delay_med"] = [np.median(x) for x in d]
    req["delay_max"] = [x.max() for x in d]
    req["frac_fast"] = [np.mean(x < 1.0) for x in d]
    req["resid"] = req.w_meas / req.w_exp - 1.0
    req["resid_abs"] = req.resid.abs()

    # ---------------- wallet forward history ----------------
    visits = sale.groupby(["wallet", "t_sale"]).size().rename("k").reset_index().sort_values("t_sale")
    visits["cum_items"] = visits.groupby("wallet").k.cumsum()
    visits["cum_visits"] = visits.groupby("wallet").cumcount() + 1
    a = _asof(req, visits, "wallet", "t_req", "t_sale", ["cum_items", "cum_visits"])
    b = _asof(req, visits, "wallet", "t_req", "t_sale", ["cum_items"], shift=30.0)
    req["w_items_bought"] = a[:, 0]
    req["w_visits"] = a[:, 1]
    req["w_items_bought_30"] = a[:, 0] - b[:, 0]
    req["w_basket"] = req.w_items_bought / np.maximum(req.w_visits, 1)
    first = visits.groupby("wallet").t_sale.min()
    req["w_age"] = np.clip(t - req.wallet.map(first).fillna(pd.Series(t, index=req.index)).values, 0, None)
    fs = sale.groupby(["wallet", "store"]).t_sale.min().reset_index().sort_values("t_sale")
    fs["cum_stores"] = fs.groupby("wallet").cumcount() + 1
    req["w_stores_bought"] = _asof(req, fs, "wallet", "t_req", "t_sale", ["cum_stores"])[:, 0]

    # ---------------- wallet reverse history ----------------
    r = req[["wallet", "t_req", "n_items", "store"]].copy().sort_values("t_req")
    r["cum_req"] = r.groupby("wallet").cumcount() + 1
    r["cum_ret"] = r.groupby("wallet").n_items.cumsum()
    r["last_t"] = r.t_req
    a = _asof(req, r, "wallet", "t_req", "t_req", ["cum_req", "cum_ret", "last_t"])
    req["w_prev_req"] = a[:, 0]
    req["w_prev_ret_items"] = a[:, 1]
    req["w_since_last_req"] = np.where(a[:, 0] > 0, t - a[:, 2], 999.0)
    req["w_ret_ratio"] = req.w_prev_ret_items / np.maximum(req.w_items_bought, 1)
    fr = req.groupby(["wallet", "store"]).t_req.min().reset_index().sort_values("t_req")
    fr["cum_rs"] = fr.groupby("wallet").cumcount() + 1
    req["w_ret_stores"] = _asof(req, fr, "wallet", "t_req", "t_req", ["cum_rs"])[:, 0]

    # ---------------- audits (delayed labels) ----------------
    audited = rng.random(len(req)) < AUDIT_RATE
    au = req.loc[audited & (req.label == 1), ["wallet", "store", "t_req"]].copy()
    au["t_known"] = au.t_req + AUDIT_LAG
    au = au.sort_values("t_known")
    au["one"] = 1
    au["cum_s"] = au.groupby("store").one.cumsum()
    au["cum_w"] = au.groupby("wallet").one.cumsum()
    req["s_audit_viol"] = _asof(req, au, "store", "t_req", "t_known", ["cum_s"])[:, 0] if len(au) else 0.0
    req["w_audit_viol"] = _asof(req, au, "wallet", "t_req", "t_known", ["cum_w"])[:, 0] if len(au) else 0.0
    req["audited"] = audited

    # ---------------- store / supplier daily aggregates ----------------
    S = int(max(sale.store.max(), req.store.max())) + 1
    D = int(np.ceil(max(sale.t_sale.max(), req.t_req.max()))) + 1
    def daily(df, tcol, val=None):
        m = np.zeros((S, D))
        day = np.floor(df[tcol].values).astype(int)
        np.add.at(m, (df.store.values, day), 1.0 if val is None else df[val].values)
        return m
    sales_d = daily(sale, "t_sale")
    ret_items_d = daily(req, "t_req", "n_items")
    req_d = daily(req, "t_req")
    req["_fast_items"] = req.frac_fast * req.n_items
    fast_d = daily(req, "t_req", "_fast_items")
    wm_d = daily(req, "t_req", "w_meas")
    we_d = daily(req, "t_req", "w_exp")

    def win(m, w):   # sum over days [day-w, day-1]
        c = np.concatenate([np.zeros((m.shape[0], 1)), np.cumsum(m, axis=1)], axis=1)
        idx = np.arange(D)
        lo = np.clip(idx - w, 0, None)
        return c[:, idx] - c[:, lo]

    day = np.floor(t).astype(int)
    st = req.store.values
    s7, s30 = win(sales_d, 7), win(sales_d, 30)
    r7, r30 = win(req_d, 7), win(req_d, 30)
    ri30, f30 = win(ret_items_d, 30), win(fast_d, 30)
    wm30, we30 = win(wm_d, 30), win(we_d, 30)
    req["s_sales_7"] = s7[st, day]
    req["s_sales_30"] = s30[st, day]
    req["s_ret_req_7"] = r7[st, day]
    req["s_ret_req_30"] = r30[st, day]
    req["s_burst"] = r7[st, day] / np.maximum(r30[st, day] * 7 / 30, 1)
    ratio = ri30 / np.maximum(s30, 1)
    req["s_ret_ratio_30"] = ratio[st, day]
    req["s_fast_frac_30"] = (f30 / np.maximum(ri30, 1))[st, day]
    req["s_resid_30"] = np.where(we30 > 0, wm30 / np.maximum(we30, 1e-9) - 1, 0)[st, day]

    sup = np.asarray(req.groupby("store").supplier.first().reindex(range(S)).fillna(-1).astype(int))
    nsup = sup.max() + 1
    sup_s = np.zeros((nsup, D)); sup_r = np.zeros((nsup, D))
    for s_ in range(S):
        if sup[s_] >= 0:
            sup_s[sup[s_]] += s30[s_]; sup_r[sup[s_]] += ri30[s_]
    req["sup_ret_ratio_30"] = (sup_r / np.maximum(sup_s, 1))[req.supplier.values, day]
    # store ratio relative to peers under the same supplier
    peer = np.zeros((S, D))
    for s_ in range(S):
        mates = [x for x in range(S) if sup[x] == sup[s_] and x != s_]
        if mates:
            mu = ratio[mates].mean(0); sd = ratio[mates].std(0) + 0.05
            peer[s_] = (ratio[s_] - mu) / sd
    req["s_ratio_vs_peers"] = peer[st, day]

    # ---------------- graph features over 30-day bipartite store-wallet graph ----------------
    first_seen = req.wallet.map(first).fillna(pd.Series(t, index=req.index)).values
    top5 = np.zeros((S, D)); multi = np.zeros((S, D)); nbrs = np.zeros((S, D)); neww = np.zeros((S, D))
    tr = req.t_req.values; wa = req.wallet.values; ni = req.n_items.values
    order = np.argsort(tr)
    tr, wa, ni, sr, fsn = tr[order], wa[order], ni[order], st[order], first_seen[order]
    for d_ in range(D):
        lo, hi = np.searchsorted(tr, d_ - 30), np.searchsorted(tr, d_)
        if hi <= lo:
            continue
        w = pd.DataFrame({"s": sr[lo:hi], "w": wa[lo:hi], "n": ni[lo:hi], "f": fsn[lo:hi]})
        ws = w.groupby("w").s.nunique()
        multi_w = set(ws[ws > 1].index)
        sw = w.groupby("s").w.apply(set)
        for s_, wset in sw.items():
            g = w[w.s == s_]
            items = g.groupby("w").n.sum().sort_values(ascending=False)
            top5[s_, d_] = items.iloc[:5].sum() / items.sum()
            multi[s_, d_] = len(wset & multi_w) / len(wset)
            ages = g.groupby("w").f.first()
            neww[s_, d_] = np.mean(d_ - ages.values < 30)
            if multi_w & wset:
                cnt = sum(1 for s2, w2 in sw.items() if s2 != s_ and len(wset & w2) >= 2)
                nbrs[s_, d_] = cnt
    req["s_top5_share"] = top5[st, day]
    req["s_multistore_frac"] = multi[st, day]
    req["s_shared_nbrs"] = nbrs[st, day]
    req["s_new_wallet_frac"] = neww[st, day]
    return req.drop(columns=["_fast_items"])


def all_features():
    return [f for g in GROUPS.values() for f in g]
