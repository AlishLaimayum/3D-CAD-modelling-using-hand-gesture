# GestureCAD — Scientific Claims & Provenance Ledger

> Every claim appearing in the paper is explicitly mapped to its empirical evidence file and categorized by scientific provenance:
> - **`REAL`**: Measured directly on real running software execution or physical hardware.
> - **`SIMULATED (Sweep)`**: Evaluated via parameter sweeps across multiple noise levels and random seeds (reported with 95% CI and min-max ranges).
> - **`ANALYTIC`**: Derived from exact mathematical theorems.
> - **`NOT RUN / UNMEASURED`**: Clearly marked as unmeasured pending physical laboratory setup.

---

## 1. Signal-Processing & Kinematic Claims

| # | Claim | Reported Value / Range | Data Source / Provenance | Evidence File | Status |
|---|---|---|---|---|---|
| CL-01 | Velocity-adaptive EMA filter reduces RMS cursor jitter | $52.43\%$ mean reduction [$95\%$ CI: $52.16\%$–$52.71\%$, range: $45.0\%$–$58.6\%$] | **`SIMULATED (Sweep)`** (6 noise levels $\times$ 30 seeds, 90 000 samples) | [`/evidence/summary_b3_sweep.json`](file:///d:/capstone%20project/evidence/summary_b3_sweep.json) | ✅ VERIFIED (Swept) |
| CL-02 | Dual-threshold hysteresis suppresses spurious pinch state flips | $85.55\%$ mean reduction [$95\%$ CI: $84.01\%$–$87.10\%$, range: $67.62\%$–$99.48\%$] | **`SIMULATED (Sweep)`** (6 noise levels $\times$ 30 seeds, 450 000 frames) | [`/evidence/summary_b4_sweep.json`](file:///d:/capstone%20project/evidence/summary_b4_sweep.json) | ✅ VERIFIED (Swept) |
| CL-03 | Scale-invariant wrist-MCP normalization eliminates distance sensitivity | $0.0\%$ CV across $30$--$100\text{ cm}$ camera ranges (vs. $70.0\%$ CV for raw pixels) | **`REAL / EMPIRICAL`** (Pinhole perspective geometry + real landmark data) | [`/evidence/summary_b6_scale_invariance.json`](file:///d:/capstone%20project/evidence/summary_b6_scale_invariance.json) | ✅ VERIFIED |
| CL-04 | Software CAD pipeline computational stages execute within sub-millisecond CPU time | $0.1994\text{ ms}$ mean cumulative ($0.1512\text{ ms}$ median, $0.8953\text{ ms}$ p99) | **`REAL`** (Node.js benchmark on Intel i7-12700H, 5 000 iterations) | [`/evidence/summary_b1_latency.json`](file:///d:/capstone%20project/evidence/summary_b1_latency.json) | ✅ VERIFIED |
| CL-05 | Physical Camera Video Capture & Landmark Streaming Operational | 141 frames captured @ 26.68 FPS on physical host camera | **`REAL`** (Python OpenCV + MediaPipe on host hardware) | [`/evidence/raw/real_landmarks_session.json`](file:///d:/capstone%20project/evidence/raw/real_landmarks_session.json) | ✅ VERIFIED |

---

## 2. Geometric Kernel & Topological Validity Claims

| # | Claim | Reported Value | Data Source / Provenance | Evidence File | Status |
|---|---|---|---|---|---|
| CL-06 | All extruded solids satisfy Euler characteristic $\chi = 2$ | $100\%$ pass ($20/20$ models, $\chi = 2.000$) | **`REAL + ANALYTIC`** (`ExtrusionEngine` + `SolidMesh` audit) | [`/evidence/summary_b9_mesh_validity.json`](file:///d:/capstone%20project/evidence/summary_b9_mesh_validity.json) | ✅ VERIFIED |
| CL-07 | Zero open boundary edges (guaranteed watertightness) | $0$ boundary edges across all evaluated models | **`REAL + ANALYTIC`** (Boundary edge traversal) | [`/evidence/summary_b9_mesh_validity.json`](file:///d:/capstone%20project/evidence/summary_b9_mesh_validity.json) | ✅ VERIFIED |
| CL-08 | Zero non-manifold edges | $0$ non-manifold edges (every edge shared by exactly 2 faces) | **`REAL + ANALYTIC`** (Half-edge adjacency audit) | [`/evidence/summary_b9_mesh_validity.json`](file:///d:/capstone%20project/evidence/summary_b9_mesh_validity.json) | ✅ VERIFIED |
| CL-09 | Exact volume calculation via Divergence Theorem | $0.000\%$ analytical discrepancy on evaluated polyhedra | **`REAL + ANALYTIC`** (Gauss surface integral vs analytical volume) | [`/evidence/summary_b9_mesh_validity.json`](file:///d:/capstone%20project/evidence/summary_b9_mesh_validity.json) | ✅ VERIFIED |

---

## 3. Shape Regularization & Geometric Snapping Claims

| # | Claim | Reported Value / Range | Data Source / Provenance | Evidence File | Status |
|---|---|---|---|---|---|
| CL-10 | Heuristic shape regularizer recognizes standard primitives under tremor | $100.0\%$ accuracy for distortion $\le 0.08$; degrades gracefully to $97.5\%$ at $0.20$ and $92.1\%$ at $0.25$ | **`SIMULATED (Sweep)`** (6 distortion levels $\times$ 30 seeds, 18 000 strokes) | [`/evidence/summary_b10_sweep.json`](file:///d:/capstone%20project/evidence/summary_b10_sweep.json) | ✅ VERIFIED (Swept) |
| CL-11 | Snapping captures imprecise user hand gestures | $84.48\%$ mean capture rate [$95\%$ CI: $83.05\%$–$85.92\%$, range: $60.5\%$–$95.0\%$] | **`SIMULATED (Sweep)`** (6 dispersion levels $\times$ 30 seeds, 36 000 queries) | [`/evidence/summary_b11_sweep.json`](file:///d:/capstone%20project/evidence/summary_b11_sweep.json) | ✅ VERIFIED (Swept) |
| CL-12 | Snapping reduces positional targeting error | $79.74\%$ mean error reduction [$95\%$ CI: $77.28\%$–$82.20\%$, range: $41.73\%$–$95.74\%$] | **`SIMULATED (Sweep)`** (6 dispersion levels $\times$ 30 seeds, 36 000 queries) | [`/evidence/summary_b11_sweep.json`](file:///d:/capstone%20project/evidence/summary_b11_sweep.json) | ✅ VERIFIED (Swept) |

---

## 4. End-to-End Latency & Physical Deployment Claims

| # | Claim | Status & Methodological Notes | Data Source / Provenance | Evidence File | Status |
|---|---|---|---|---|---|
| CL-13 | Physical Motion-to-Photon End-to-End Latency | **UNMEASURED**. Requires high-speed camera or photodiode timing. Cumulative software CAD latency is measured at $0.199\text{ ms}$; end-to-end hardware chain is unverified. | **`NOT RUN`** (Measurement protocol defined in §6.1) | — | ⚠️ `[UNMEASURED]` |
| CL-14 | Continuous 60 FPS Viewport Rendering | **TARGET BUDGET**. Software stages take $0.199\text{ ms}$ ($1.2\%$ of $16.6\text{ ms}$ budget). Continuous rendering trace with Chrome DevTools has not been formally profiled. | **`TARGET / BUDGET`** | — | ⚠️ `[DESIGN TARGET]` |

---

## 5. Human Factors & Usability Claims

| # | Claim | Status & Methodological Notes | Data Source / Provenance | Evidence File | Status |
|---|---|---|---|---|---|
| CL-15 | System Usability Scale (SUS) Score | **UNMEASURED**. Protocol, consent forms, and questionnaires designed in `/study/`. Human trials not yet executed. | **`NOT RUN`** (Protocol specified in `/study/protocol.md`) | — | 🔴 `[PENDING USER STUDY]` |
| CL-16 | NASA-TLX Workload Distribution | **UNMEASURED**. | **`NOT RUN`** | — | 🔴 `[PENDING USER STUDY]` |
| CL-17 | Task Completion Time vs. Mouse CAD | **UNMEASURED**. | **`NOT RUN`** | — | 🔴 `[PENDING USER STUDY]` |
| CL-18 | Qualitative User Preference | **UNMEASURED**. | **`NOT RUN`** | — | 🔴 `[PENDING USER STUDY]` |

---

## Provenance Ledger Summary

| Scientific Category | Number of Claims | Verified Status |
|---|:---:|:---:|
| **`REAL` / `REAL + ANALYTIC`** | 6 | ✅ 6 / 6 Verified |
| **`SIMULATED (Parameter Sweeps)`** | 6 | ✅ 6 / 6 Verified with 95% CIs |
| **`NOT RUN / UNMEASURED`** | 6 | ⚠️ Clearly labeled as unmeasured / pending physical apparatus or participant recruitment |
| **Total** | **18** | **100% Traceable** |
