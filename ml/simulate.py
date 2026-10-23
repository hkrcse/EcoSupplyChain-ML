"""
EcoSupplyChain lifecycle simulator.

Generates forward events (production, transfer, sale) and reverse events
(buyer return requests at the selling store) for a 180-day horizon, then
injects four fraud schemes that pass every deterministic check in the
hardened V4 contract (one reward per product and stage, claimant must be
the recorded owner, collector must be the upstream seller).

Every number is drawn from the distributions below; nothing here comes
from a real deployment.
"""
import numpy as np
import pandas as pd

CATS = np.array(["PET", "CAN", "HDPE", "PACK"])
CAT_W = np.array([25.0, 15.0, 60.0, 10.0])        # grams of recoverable material
CAT_P = np.array([0.45, 0.25, 0.10, 0.20])
CAT_PRICE = np.array([1.2, 1.0, 3.5, 2.0])

DEFAULTS = dict(
    days=180, n_factories=4, n_suppliers=8, n_stores=40, n_buyers=6000,
    frac_bulk=0.01, frac_delayed_upload_stores=0.10, n_promo_stores=6,
    n_miscal_stores=3, n_fraud_stores=8, n_ring_groups=1, scale_sigma=0.04,
)


def simulate(seed=0, **kw):
    cfg = {**DEFAULTS, **kw}
    rng = np.random.default_rng(seed)
    D, S, B = cfg["days"], cfg["n_stores"], cfg["n_buyers"]

    store_supplier = rng.integers(0, cfg["n_suppliers"], S)
    supplier_factory = rng.integers(0, cfg["n_factories"], cfg["n_suppliers"])

    # ------------------------------------------------------------------
    # legitimate buyers
    # ------------------------------------------------------------------
    home = rng.integers(0, S, B)
    second = np.where(rng.random(B) < 0.25, rng.integers(0, S, B), home)
    visit_rate = rng.gamma(2.0, 0.08, B)                 # visits per day
    ret_prop = rng.beta(2.0, 3.0, B)                     # P(item returned)
    is_bulk = rng.random(B) < cfg["frac_bulk"]
    visit_rate[is_bulk] *= 3
    ret_prop[is_bulk] = rng.uniform(0.75, 0.95, is_bulk.sum())
    first_day = rng.uniform(-60, D * 0.6, B)             # wallet join day

    sales = []      # (wallet, store, t, cat, price_ratio, prod_age)
    for b in range(B):
        t0 = max(first_day[b], 0.0)
        n = rng.poisson(visit_rate[b] * (D - t0))
        if n == 0:
            continue
        ts = np.sort(rng.uniform(t0, D, n))
        st = np.where(rng.random(n) < 0.8, home[b], second[b])
        k = (rng.poisson(12 if is_bulk[b] else 3, n) + 1)
        for t, s_, kk in zip(ts, st, k):
            c = rng.choice(4, kk, p=CAT_P)
            sales.append((b, s_, t, c, rng.normal(1.0, 0.04, kk), rng.gamma(3, 6, kk)))

    rows = []
    for b, s_, t, c, pr, age in sales:
        for ci, p, a in zip(c, pr, age):
            rows.append((b, s_, t, ci, p, a))
    sale = pd.DataFrame(rows, columns=["wallet", "store", "t_sale", "cat", "price_ratio", "prod_age"])
    sale["synthetic"] = 0
    sale["scheme"] = ""

    # ------------------------------------------------------------------
    # legitimate returns: each item returned w.p. ret_prop after a delay,
    # bundled into trips, at the selling store (V4 invariant I3)
    # ------------------------------------------------------------------
    promo = rng.choice(S, cfg["n_promo_stores"], replace=False)
    promo_start = rng.uniform(20, D - 30, len(promo))
    p_ret = ret_prop[sale.wallet.values].copy()
    for s_, ps in zip(promo, promo_start):
        m = (sale.store.values == s_) & (sale.t_sale.values >= ps) & (sale.t_sale.values < ps + 14)
        p_ret[m] = np.minimum(1.0, p_ret[m] * 1.8)
    returned = rng.random(len(sale)) < p_ret
    delay = rng.lognormal(np.log(6.0), 0.8, len(sale))
    delay[is_bulk[sale.wallet.values]] = rng.lognormal(np.log(2.0), 0.6, is_bulk[sale.wallet.values].sum())
    sale["t_ready"] = sale.t_sale + delay
    sale["returned"] = returned & (sale.t_ready < D)

    legit_req = _bundle_trips(sale[sale.returned], rng, trip_mean=8.0)

    # stores that batch-upload returns late (legit, noisy timestamps)
    late = rng.choice(S, int(cfg["frac_delayed_upload_stores"] * S), replace=False)
    m = legit_req.store.isin(late)
    legit_req.loc[m, "t_req"] = np.ceil(legit_req.loc[m, "t_req"] / 4.0) * 4.0 + rng.uniform(0, 0.2, m.sum())
    legit_req = legit_req[legit_req.t_req < D]
    legit_req["label"] = 0
    legit_req["scheme"] = "legit"

    # ------------------------------------------------------------------
    # fraud schemes (all pass the V4 deterministic checks)
    # ------------------------------------------------------------------
    candidates = rng.permutation(S)
    candidates = candidates[~np.isin(candidates, promo)]
    ring_sup = store_supplier[candidates[0]]
    ring = [s_ for s_ in candidates if store_supplier[s_] == ring_sup][:3]
    if len(ring) < 2:   # force a ring of 3 stores on one supplier
        ring = list(candidates[:3]); store_supplier[ring] = ring_sup
    others = [s_ for s_ in candidates if s_ not in ring]
    n_f = cfg["n_fraud_stores"]
    s1 = others[:n_f // 3]
    s2 = others[n_f // 3: 2 * n_f // 3]
    s4 = others[2 * n_f // 3: n_f]

    next_wallet = [B]
    fraud_sales, fraud_req, inflate = [], [], []

    def new_wallets(k):
        w = np.arange(next_wallet[0], next_wallet[0] + k)
        next_wallet[0] += k
        return w

    def emit(wallet, store, t_sale, k, delay_fn, meas_fn, scheme):
        c = rng.choice(4, k, p=CAT_P)
        ids = []
        for ci in c:
            fraud_sales.append((wallet, store, t_sale, ci, rng.normal(1.0, 0.04), rng.gamma(3, 6), 1, scheme))
        t_r = t_sale + delay_fn()
        if t_r < D:
            fraud_req.append(dict(wallet=wallet, store=store, t_req=t_r, cats=c,
                                  t_sales=np.full(k, t_sale), meas_factor=meas_fn(), scheme=scheme))

    # S1 phantom returns via sybil wallets, no material behind the claim
    for s_ in s1:
        start = rng.uniform(20, 120)
        pool = new_wallets(rng.integers(15, 40))
        for d in np.arange(start, D):
            for _ in range(rng.poisson(2.0)):
                emit(rng.choice(pool), s_, d + rng.random(), rng.integers(6, 30),
                     lambda: rng.exponential(0.4), lambda: rng.uniform(0.0, 0.25), "S1_phantom")

    # S3 coordinated ring: shared sybil pool across ring stores, weight matched
    pool = new_wallets(60)
    start = rng.uniform(30, 110)
    for d in np.arange(start, D):
        for _ in range(rng.poisson(3.0)):
            emit(rng.choice(pool), rng.choice(ring), d + rng.random(), rng.integers(4, 16),
                 lambda: rng.lognormal(np.log(3.0), 0.7), lambda: rng.normal(1.0, 0.05), "S3_ring")

    # S4 low-and-slow sybil: small, spread out, partially matched material
    for s_ in s4:
        start = rng.uniform(20, 120)
        pool = new_wallets(rng.integers(60, 120))
        for d in np.arange(start, D):
            for _ in range(rng.poisson(0.8)):
                emit(rng.choice(pool), s_, d + rng.random(), rng.integers(1, 5),
                     lambda: rng.lognormal(np.log(5.0), 0.8), lambda: rng.uniform(0.6, 0.95), "S4_lowslow")

    # S2 count inflation: genuine return trips padded with the buyer's own
    # unreturned items (owner is still the claimant, so V4 accepts it)
    for s_ in s2:
        start = rng.uniform(20, 120)
        inflate.append((s_, start))

    fs = pd.DataFrame(fraud_sales, columns=["wallet", "store", "t_sale", "cat", "price_ratio",
                                            "prod_age", "synthetic", "scheme"])
    sale_all = pd.concat([sale[["wallet", "store", "t_sale", "cat", "price_ratio", "prod_age",
                                "synthetic", "scheme"]], fs], ignore_index=True)

    # assemble requests
    fr = pd.DataFrame(fraud_req)
    if len(fr):
        fr["label"] = 1
    req = pd.concat([legit_req, fr], ignore_index=True)

    # apply S2 padding
    req["meas_factor"] = req["meas_factor"].where(req["meas_factor"].notna(), 1.0)
    unret = sale[~sale.returned]
    unret_by_w = {w: g for w, g in unret.groupby("wallet")}
    for s_, start in inflate:
        idx = req.index[(req.store == s_) & (req.label == 0) & (req.t_req > start)]
        pick = idx[rng.random(len(idx)) < 0.30]
        for i in pick:
            w = req.at[i, "wallet"]
            g = unret_by_w.get(w)
            if g is None:
                continue
            g = g[g.t_sale < req.at[i, "t_req"]]
            if len(g) == 0:
                continue
            k = int(min(len(g), rng.integers(1, 4)))
            add = g.sample(k, random_state=int(rng.integers(1e9)))
            n0 = len(req.at[i, "cats"])
            req.at[i, "cats"] = np.concatenate([req.at[i, "cats"], add.cat.values])
            req.at[i, "t_sales"] = np.concatenate([req.at[i, "t_sales"], add.t_sale.values])
            req.at[i, "meas_factor"] = n0 / (n0 + k)          # only original items present
            req.at[i, "label"] = 1
            req.at[i, "scheme"] = "S2_inflate"

    # material measurement at an independent collection scale
    w_exp = np.array([CAT_W[c].sum() for c in req.cats])
    noise = rng.normal(0, cfg["scale_sigma"], len(req))
    dirty = rng.random(len(req)) < 0.04
    noise[dirty] += rng.uniform(0.08, 0.20, dirty.sum())          # residue in containers
    miscal = rng.choice(S, cfg["n_miscal_stores"], replace=False)
    mc_start = rng.uniform(10, D - 40, len(miscal))
    for s_, ms in zip(miscal, mc_start):
        m = (req.store.values == s_) & (req.t_req.values >= ms) & (req.t_req.values < ms + 30)
        noise[m] -= 0.12                                         # legit scale drift
    req["w_exp"] = w_exp
    req["w_meas"] = np.maximum(0.0, w_exp * req.meas_factor.values * (1 + noise))
    req["n_items"] = [len(c) for c in req.cats]
    req["reward"] = req.w_exp * 1e-3                            # ETH at 0.001 ETH per gram
    req["supplier"] = store_supplier[req.store.values]
    req = req.sort_values("t_req").reset_index(drop=True)
    req["req_id"] = np.arange(len(req))

    meta = dict(ring=list(map(int, ring)), s1=list(map(int, s1)), s2=list(map(int, s2)),
                s4=list(map(int, s4)), promo=list(map(int, promo)), miscal=list(map(int, miscal)),
                late=list(map(int, late)), store_supplier=store_supplier.tolist(),
                n_wallets=int(next_wallet[0]))
    sale_all["supplier"] = store_supplier[sale_all.store.values]
    return sale_all.sort_values("t_sale").reset_index(drop=True), req, meta


def _bundle_trips(items, rng, trip_mean):
    """Group each wallet's ready-to-return items into store trips."""
    out = []
    for (w, s_), g in items.groupby(["wallet", "store"]):
        g = g.sort_values("t_ready")
        t = g.t_ready.values
        trip = t[0] + rng.exponential(trip_mean * 0.3)
        bucket_c, bucket_ts = [], []
        for tr, c, ts in zip(t, g.cat.values, g.t_sale.values):
            if tr > trip and bucket_c:
                out.append(dict(wallet=w, store=s_, t_req=trip, cats=np.array(bucket_c),
                                t_sales=np.array(bucket_ts), meas_factor=1.0))
                bucket_c, bucket_ts = [], []
                trip = max(trip, tr) + rng.exponential(trip_mean)
            bucket_c.append(c); bucket_ts.append(ts)
        if bucket_c:
            out.append(dict(wallet=w, store=s_, t_req=max(trip, t[-1]), cats=np.array(bucket_c),
                            t_sales=np.array(bucket_ts), meas_factor=1.0))
    return pd.DataFrame(out)


if __name__ == "__main__":
    s, r, m = simulate(0)
    print(len(s), "item sales;", len(r), "return requests")
    print(r.scheme.value_counts())
    print(m)
