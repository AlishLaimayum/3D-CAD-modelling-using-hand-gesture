# GestureCAD — Scientific Provenance & Evaluation Methodology Matrix

Every benchmark, metric, and claim in the GestureCAD research project is explicitly classified into one of four methodological categories:
1. **`REAL`**: Measured directly on real running software components executing actual codebase logic or real physical hardware (e.g., webcam capture, CPU execution timer `performance.now()`).
2. **`SIMULATED`**: Evaluated using stochastic models of human hand motion, tremor, and drawing distortion, subjected to parameter sweeps across multiple noise levels and random seeds with confidence intervals.
3. **`ANALYTIC`**: Derived through exact mathematical proof, closed-form calculus, or topological theorems.
4. **`NOT RUN / UNMEASURED`**: Empirical studies or physical instrument setups that have not been physically executed.

---

## Detailed Benchmark Provenance Matrix

| Benchmark ID | Benchmark Name | Category | Exact Data Source / Method | Number of Iterations / Scope | Notes & Verification Reference |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **B1** | Software CAD Subsystem Latency | **`REAL`** | Real Node.js execution of actual frontend modules (`Profile2D`, `ExtrusionEngine`, `SolidMesh`, `FaceEnumerator`, `SnappingEngine`, `shapeRecognizer`) timed via `performance.now()`. | 5 000 iterations | Cumulative mean: $0.199\text{ ms}$. Verifies software CPU budget. [`summary_b1_latency.json`](file:///d:/capstone%20project/evidence/summary_b1_latency.json) |
| **B2** | Physical Motion-to-Photon Latency | **`NOT RUN`** | Requires external high-speed camera (e.g., 240 FPS) or photodiode oscilloscope recording physical hand displacement to screen pixel color update. | Unmeasured | **NOT measured**. Prior 29 ms was an unverified estimate and has been removed from all claims. Protocol documented in §6.1. |
| **B3** | Tremor Jitter & Filter Attenuation | **`SIMULATED`** | Simulated physiological resting tremor (Gaussian noise + spectral oscillation) processed through `PositionSmoother`. Evaluated across 6 noise levels ($1.0$--$6.0\text{ mm}$) $\times$ 30 seeds. | 180 runs (90 000 samples) | Mean RMS reduction: $52.43\%$ [$95\%$ CI: $52.16\%$–$52.71\%$, range: $45.0\%$–$58.6\%$]. [`summary_b3_sweep.json`](file:///d:/capstone%20project/evidence/summary_b3_sweep.json) |
| **B4** | Pinch State Chatter & Hysteresis | **`SIMULATED`** | Simulated stochastic walk in boundary zone $[0.44, 0.54]$ with noise $\sigma \in [0.015, 0.090]$ comparing naive vs dual-threshold FSM across 30 seeds. | 180 runs (450 000 frames) | Mean flip reduction: $85.55\%$ [$95\%$ CI: $84.01\%$–$87.10\%$, range: $67.62\%$–$99.48\%$]. [`summary_b4_sweep.json`](file:///d:/capstone%20project/evidence/summary_b4_sweep.json) |
| **B6** | Anthropometric & Distance Scale Invariance | **`REAL / EMPIRICAL`** | Verified on pinhole camera perspective geometry and physical MediaPipe landmark telemetry from real webcam session. | 4 distances, 3 hand sizes | Normalized metric $d_{\text{pinch}}$ has $0.0\%$ CV across distances, vs $70.0\%$ CV for raw pixel distance. [`summary_b6_scale_invariance.json`](file:///d:/capstone%20project/evidence/summary_b6_scale_invariance.json) |
| **B9** | B-Rep Mesh Topological Validity & Volume | **`REAL + ANALYTIC`** | Actual geometric mesh construction by `ExtrusionEngine` and topology audit by `SolidMesh`. Exact volume integration via Divergence Theorem. | 20 distinct 3D models | $100\%$ pass: Euler characteristic $\chi = 2$, 0 boundary edges, 0 non-manifold edges, $0.000\%$ volume error. [`summary_b9_mesh_validity.json`](file:///d:/capstone%20project/evidence/summary_b9_mesh_validity.json) |
| **B10** | Heuristic Shape Regularization | **`SIMULATED`** | Synthetic noisy strokes evaluated across 6 distortion levels ($0.04$--$0.25$) $\times$ 30 seeds processed through `recognizeShape()`. | 180 runs (18 000 strokes) | Accuracy: $100\%$ for noise $\le 0.08$; degrades gracefully to $97.5\%$ at noise $0.20$ and $92.1\%$ at noise $0.25$. [`summary_b10_sweep.json`](file:///d:/capstone%20project/evidence/summary_b10_sweep.json) |
| **B11** | Geometric Snapping Precision | **`SIMULATED`** | Synthetic targeting queries against active polygon vertices and edges across 6 dispersion radii $\times$ 30 seeds through `SnappingEngine`. | 180 runs (36 000 queries) | Mean capture rate: $84.48\%$ [$95\%$ CI: $83.05\%$–$85.92\%$]; mean error reduction: $79.74\%$ [$95\%$ CI: $77.28\%$–$82.20\%$]. [`summary_b11_sweep.json`](file:///d:/capstone%20project/evidence/summary_b11_sweep.json) |
| **RL-1** | Real Landmark Streaming Capture | **`REAL`** | Real OpenCV + MediaPipe `HandTracker` session recorded from physical camera 0 on host system. | 141 frames @ 26.7 FPS | Verified physical webcam streaming and landmark inference pipeline on host. [`real_landmarks_session.json`](file:///d:/capstone%20project/evidence/raw/real_landmarks_session.json) |
| **FPS** | Viewport Rendering Frame Rate | **`TARGET / BUDGET`** | Target refresh rate ($60\text{ FPS} \implies 16.6\text{ ms}$ budget). Unmeasured by formal DevTools GPU profiling. | Design Target | Software stages require $0.199\text{ ms}$ ($1.2\%$ of budget); full continuous rendering profile not formally recorded. |
| **STUDY** | Human Usability Evaluation (SUS / NASA-TLX) | **`NOT RUN`** | Protocol, tasks, questionnaires, and analysis scripts fully designed in `/study/`. Physical human trials have not yet been conducted. | 0 participants run | All human usability metrics are designated as pending empirical study execution. |

---

## Architectural Provenance Summary

- **Core Vision Pipeline**: Python 3.10+ / OpenCV / MediaPipe running on edge host (`REAL`).
- **Telemetry Transport**: WebSocket JSON packets @ 25--30 Hz (`REAL`).
- **Rendering & CAD State**: React Three Fiber / WebGL buffer direct mutations (`REAL`).
- **Signal Filtering & State Machine**: Implemented in frontend JavaScript; validated under both real landmark streams and sensitivity-swept stochastic simulations (`REAL + SIMULATED`).
- **Geometric B-Rep Kernel**: Custom JavaScript boundary representation engine; validated under mathematical topology theorems (`REAL + ANALYTIC`).
