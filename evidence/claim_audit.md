# GestureCAD: Comprehensive Technical Codebase Audit & Evidence Ledger

**Project**: GestureCAD — Gesture-Controlled 3D CAD Modeling Application  
**Auditor**: Senior Academic CAD & Vision Research Auditor  
**Date**: October 2026  
**Repository**: `AlishLaimayum/3D-CAD-modelling-using-hand-gesture`

---

## 1. Repository Inventory

The codebase consists of three primary functional directories:
1. **`backend/`**: Python edge vision service
   - `main.py`: FastAPI / WebSocket server listening on `ws://localhost:8000/ws/tracking`. Spawns the capture thread and broadcasts tracking telemetry packets.
   - `tracking/hand_tracker.py`: OpenCV webcam capture wrapper with Google MediaPipe Hands inference (`max_num_hands=1`, model complexity 1).
   - `tracking/gesture_recognizer.py`: Kinematic feature extraction, 2D distance calculation, 5-state automaton (`IDLE`, `OPEN_PALM`, `FIST`, `PINCH`, `PEACE`), and cursor smoothing.
2. **`frontend/`**: React 18 / Three.js / React Three Fiber (R3F) application
   - `src/cad/geometry/`: Custom computational geometry classes:
     - `SolidMesh.js`: Polygonal mesh data structure with half-edge adjacency, bounding box, face normal computation, Divergence Theorem volume and surface area calculation, and topological invariant validation ($\chi = V - E + F$, boundary edges, manifold degree).
     - `ExtrusionEngine.js`: Sweeps planar 2D profiles along the working-plane normal vector into polyhedral meshes.
     - `RevolveEngine.js`: Sweeps 2D cross-sections around arbitrary in-plane axes, using Rodrigues' rotation formula and Earcut triangulation for partial end caps.
     - `FaceEnumerator.js`: Identifies planar boundary faces on generated polyhedra and constructs local orthonormal coordinate frames $\mathbf{R} \in SO(3)$ for sketch-on-face operations.
     - `Profile2D.js` & `ProfileDetector.js`: 2D closed polygon construction, winding orientation, Shoelace area calculation, and primitive classification.
     - `BooleanEngine.js`: Stub / placeholder for constructive solid geometry (CSG).
   - `src/cad/PlaneManager.js` & `PlaneRotationController.js`: Manages active working planes (XY, YZ, XZ, or face-attached) and ray-plane unprojection.
   - `src/cad/CommandManager.js`: Command-pattern transaction management with Undo/Redo support.
   - `src/utils/shapeRecognizer.js`: Heuristic stroke classifier (Line, Circle, Rectangle, Triangle).
   - `src/utils/exportUtils.js`: Implements export to Wavefront OBJ (`v`, `f`, `l`), AutoCAD DXF (`LINE`, `3DFACE`), and JSON project state.
3. **`evidence/`**: Benchmark scripts and raw measurement data
   - `scripts/`: Node.js and Python micro-benchmarks (`benchmark_b1_latency.mjs`, `benchmark_b3_jitter.mjs`, `benchmark_b4_hysteresis.mjs`, `benchmark_b6_scale_invariance.py`, `benchmark_b9_mesh_validity.mjs`, `benchmark_b10_shape_recognition.mjs`, `benchmark_b11_snapping.mjs`, and associated sensitivity sweeps).
   - `summary_*.json` & `raw/`: Output logs of latency, sweeps, and real webcam recording sessions.

---

## 2. Actual System Architecture and Execution Flow

```
+-------------------------------------------------------------------------------+
|                           EDGE VISION SUBSYSTEM (Python)                      |
|                                                                               |
|  [Commodity RGB Webcam]                                                       |
|           | (cv2.VideoCapture @ ~26.7 FPS)                                    |
|           v                                                                   |
|  [MediaPipe Hands Inference]  --->  21 Landmarks (x, y, z)                    |
|           |                                                                   |
|           v                                                                   |
|  [Kinematic Signal Conditioning]                                              |
|      - Anatomical Normalization: S_hand = ||l_9 - l_0||_2                     |
|      - Pinch Metric: d_pinch = ||l_4 - l_8||_2 / S_hand                       |
|      - State FSM Debounce & Thresholding (0.48 threshold, persistence)        |
|      - Cursor Dead-Zone (0.002) + EMA (alpha = 0.55)                           |
+-------------------------------------------------------------------------------+
                                    |
                         WebSocket (JSON packets)
                                    v
+-------------------------------------------------------------------------------+
|                       BROWSER CAD CLIENT (React 18 + Three.js)                |
|                                                                               |
|  [WebSocket Receiver Hook] (useGestureInteraction.js)                         |
|           |                                                                   |
|           +---> High-Frequency Render Loop (Three.js useFrame)                |
|           |         * In-place Float32Array BufferGeometry mutation           |
|           |         * Direct viewport pointer / cursor positioning            |
|           |         * Bypass React virtual DOM reconciliation                 |
|           |                                                                   |
|           +---> Transactional CAD Event Dispatcher (Zustand store)            |
|                     * Drawing Plane Ray-Plane Unprojection                    |
|                     * 3D Geometric Snapping (Vertex, Edge, Midpoint)          |
|                     * Heuristic Shape Regularization                          |
|                     * Command Execution & Undo/Redo History                   |
|                                                                               |
|  [Geometry & Solid Kernel]                                                    |
|      - Profile2D (Shoelace winding, closure check)                            |
|      - ExtrusionEngine (Linear sweeping, side quads, fan caps)                |
|      - RevolveEngine (Rodrigues rotation, axis welding, Earcut caps)          |
|      - SolidMesh (Half-edge adjacency, Divergence volume, chi=2 check)        |
|      - FaceEnumerator (SO(3) frame derivation for sketch-on-face)             |
|                                                                               |
|  [CAD Persistence & Exporters]                                                |
|      - Wavefront OBJ (3D 'f' faces for solids, 'l' polylines for sketches)    |
|      - AutoCAD DXF (3DFACE entities for solids, LINE entities for sketches)   |
|      - Stereolithography STL (Triangulated facet normals and vertices)        |
|      - JSON Project State (Full vertex coordinates and plane metadata)        |
+-------------------------------------------------------------------------------+
```

---

## 3. Feature-by-Feature Implementation Verification Matrix

| Feature Module | Declared Status in Draft | Actual Implementation in Code | Verification Detail | Final Audit Status |
|---|---|---|---|---|
| **Edge Vision Tracking** | Monocular hand tracking @ ~30 FPS | `backend/tracking/hand_tracker.py` | OpenCV capture + MediaPipe Hands. Empirical recording in `real_landmarks_session.json` captured 141 frames at 26.68 FPS. | **VERIFIED** |
| **Pinch Distance Normalization** | Scale-invariant via wrist-MCP metric | `backend/tracking/gesture_recognizer.py` L80-87 | Divides thumb-index Euclidean distance by distance between wrist (0) and middle MCP (9). | **VERIFIED** |
| **Cursor Smoothing** | Dynamic velocity-adaptive EMA + deadzone | `gesture_recognizer.py` L224-235 | Implements deadzone (`dist_sq < 0.000004`) and fixed alpha (`0.55 * raw + 0.45 * prev`). The paper drafts a more elaborate velocity-dependent equation; in actual code alpha is a fixed 0.55 with deadzone. | **PARTIALLY VERIFIED** (Simplified in active Python code; adaptive sweep benchmarked in Node) |
| **Dual-Threshold Hysteresis** | Asymmetric $\tau_1=0.44, \tau_2=0.54$ | `gesture_recognizer.py` L16-43 | Active Python code uses single threshold $0.48$ with frame debounce (`pinch_start=1, unpinch=2`). The dual-threshold automaton was evaluated in `benchmark_b4_hysteresis.mjs`. | **SIMULATED / BENCHMARKED** (Evaluated in benchmark suite; active code uses single threshold + debounce) |
| **Working Plane Management** | XY, YZ, XZ planar raycasting | `frontend/src/cad/PlaneManager.js` | Full ray-plane intersection and local orthonormal basis transformation implemented. | **VERIFIED** |
| **Extrusion Engine** | B-Rep solid extrusion from 2D profile | `frontend/src/cad/geometry/ExtrusionEngine.js` | Sweeps closed 2D profile along plane normal; creates side quads and end caps. | **VERIFIED** |
| **Polygon Cap Triangulation** | Universal cap triangulation | `ExtrusionEngine.js` L74-82 | Naive triangle fan from vertex 0: `[0, i, i+1]`. Valid *only* for strictly convex polygons; self-intersects on concave polygons. | **PARTIALLY VERIFIED** (Convex-only limitation identified) |
| **Revolve Engine** | Rotational solids with seam stitching | `frontend/src/cad/geometry/RevolveEngine.js` | Implements Rodrigues' rotation formula, axis welding, and Earcut triangulation (`THREE.ShapeUtils.triangulateShape`) for partial caps. | **VERIFIED** |
| **Topological Validation** | Closed 2-manifold check ($\chi = 2$) | `frontend/src/cad/geometry/SolidMesh.js` L208-281 | Computes edge adjacency, boundary edges, manifold edge degree, and Euler characteristic $\chi = V - E + F$. | **VERIFIED** (Valid for genus-0 simply connected polyhedra) |
| **Divergence Theorem Volume** | Exact numerical volume calculation | `SolidMesh.js` L167-206 | Sums $\frac{1}{6} \mathbf{a} \cdot (\mathbf{b} \times \mathbf{c})$ across triangular faces. Validated against analytical formulas ($0.000\%$ error). | **VERIFIED** |
| **Sketch-on-Face** | Orthonormal basis on polyhedra faces | `frontend/src/cad/geometry/FaceEnumerator.js` | Constructs local orthonormal frames $\mathbf{R} = [\vec{t}, \vec{n}, \vec{b}]$ on planar faces and tangent planes on cylindrical faces. | **VERIFIED** |
| **Geometric Snapping** | Vertex, midpoint, edge, and grid snapping | `frontend/src/utils/snappingUtils.js` | KD-tree / Euclidean distance search within threshold radius. | **VERIFIED** |
| **Heuristic Shape Recognition** | Regularizes noisy strokes to Line/Circle/Rect/Tri | `frontend/src/utils/shapeRecognizer.js` | Evaluates aspect ratio, closure, perimeter, and area. | **VERIFIED** |
| **CAD Persistence & Export** | OBJ, DXF, STL, JSON | `exportUtils.js` & `SolidMesh.js` | OBJ (`v`, `f`), DXF (`3DFACE`, `LINE`), STL (facets), and JSON format exports fully implemented and functional. | **VERIFIED** |
| **CSG Boolean Operations** | Union, Difference, Intersection | `frontend/src/cad/geometry/BooleanEngine.js` | File is an empty stub / non-functional placeholder. Overlapping solids remain independent meshes. | **NOT IMPLEMENTED** |
| **Zero-Install Web Deployment** | 100% in-browser zero-install | `backend/main.py` required | Requires local Python service for MediaPipe tracking. Not zero-install. | **CONTRADICTED / PARTIALLY IMPLEMENTED** |
| **Human Usability (SUS, NASA-TLX)**| Quantitative human performance | `study/` directory | Comprehensive protocol, consent forms, and questionnaires designed; 0 human trials run. | **UNTESTED (Protocol Designed)** |

---

## 4. Claim-by-Claim Technical Audit & Numerical Reconciliation

### Audit 4.1: Software CAD Pipeline Latency ($0.1994\text{ ms}$)
- **Source**: `evidence/summary_b1_latency.json`, generated by `benchmark_b1_latency.mjs` over 5,000 iterations on an Intel Core i7-12700H CPU.
- **Breakdown**:
  - Ray-plane unprojection: $0.0045\text{ ms}$ (p99: $0.0219\text{ ms}$)
  - Snapping inference: $0.0024\text{ ms}$ (p99: $0.0068\text{ ms}$)
  - Shape regularization: $0.0836\text{ ms}$ (p99: $0.3769\text{ ms}$)
  - Extrusion & topology validation: $0.1009\text{ ms}$ (p99: $0.4573\text{ ms}$)
  - Face enumeration & $SO(3)$ frame: $0.0080\text{ ms}$ (p99: $0.0324\text{ ms}$)
  - **Cumulative Software CAD**: $0.1994\text{ ms}$ mean, $0.1512\text{ ms}$ median, $0.8953\text{ ms}$ 99th percentile.
- **Audit Verdict**: **VERIFIED** as an isolated *software CPU execution benchmark*.
- **Critical Boundary**: This number accounts *only* for the in-memory geometric and algorithmic transformations in JavaScript/Node.js. It does **not** include physical camera frame integration time ($\sim 33.3\text{ ms}$ at 30 FPS), MediaPipe neural inference time ($\sim 15$--$25\text{ ms}$), WebSocket inter-process communication ($\sim 1$--$3\text{ ms}$), WebGL rasterization ($\sim 2$--$5\text{ ms}$), or monitor display scanout ($\sim 16.6\text{ ms}$). Total physical motion-to-photon latency is unmeasured and estimated to lie between $60$ and $100\text{ ms}$. Presenting $0.1994\text{ ms}$ as system responsiveness without explicit qualification is misleading.

### Audit 4.2: Gesture Chatter Reduction ($92.1\%$ vs $90.76\%$ vs $85.55\%$)
- **Source Discrepancy**: The previous manuscript draft reported $92.1\%$ in the text, $90.76\%$ in a noise sweep table row ($\sigma=0.045$), and $85.55\%$ in summary highlights.
- **Audit Reconciliation**:
  1. **$92.11\%$** comes directly from `evidence/summary_b4_hysteresis.json` (`benchmark_b4_hysteresis.mjs`). This was a **single-seed run** ($s=42$, $N=5\,000$ frames) at fixed noise $\sigma=0.045$, where naive thresholding produced 1,990 state flips and dual-threshold hysteresis produced 157 flips ($(1990 - 157) / 1990 = 92.11\%$).
  2. **$88.88\%$** (reported as $\approx 90.76\%$ in an earlier draft) is the mean reduction at noise $\sigma=0.045$ across a **30-seed stochastic parameter sweep** (`evidence/summary_b4_sweep.json`).
  3. **$85.55\%$** [$95\%$ CI: $84.01\%$–$87.10\%$] is the **grand aggregate mean across all 180 runs** encompassing six distinct noise levels ($\sigma \in [0.015, 0.090]$) and 450,000 frames.
- **Audit Verdict**: **RECONCILED**. The discrepancy arose from conflating a single point-estimate benchmark ($92.1\%$) with multi-seed sensitivity sweep statistics ($85.55\%$ aggregate, $88.88\%$ at $\sigma=0.045$). In the rewritten paper, the multi-seed sweep statistics with confidence intervals must be cited as primary evidence, with the single-seed run contextualized.

### Audit 4.3: Cursor Jitter Attenuation ($52.43\%$ vs $60.61\%$)
- **Source Discrepancy**: Earlier text cited $60.6\%$ reduction, while sweep tables cited $52.43\%$.
- **Audit Reconciliation**:
  1. **$60.61\%$** originates from `evidence/summary_b3_jitter.json` (`benchmark_b3_jitter.mjs`), which was a single trial of 1,000 samples under fixed synthetic noise ($3.176\text{ mm} \to 1.251\text{ mm}$).
  2. **$52.43\%$** [$95\%$ CI: $52.16\%$–$52.71\%$] is the true aggregate mean across 180 simulation runs (6 noise levels $\sigma \in [1.0, 6.0]\text{ mm} \times 30$ seeds, 90,000 samples total in `summary_b3_sweep.json`). At $\sigma=1.0\text{ mm}$, reduction is $45.92\%$; at $\sigma=6.0\text{ mm}$, reduction is $53.96\%$.
- **Audit Verdict**: **RECONCILED**. The $52.43\%$ figure is the defensible multi-condition result.

### Audit 4.4: Snapping Error Reduction ($93.0\%$ vs $79.74\%$)
- **Source Discrepancy**: Text cited $93.0\%$ targeting error reduction, while sweep tables reported $79.74\%$.
- **Audit Reconciliation**:
  1. **$93.01\%$** is from `evidence/summary_b11_snapping.json` (`benchmark_b11_snapping.mjs`), evaluating 500 queries at a fixed narrow dispersion radius.
  2. **$79.74\%$** [$95\%$ CI: $77.28\%$–$82.20\%$] is the aggregate result from `evidence/summary_b11_sweep.json`, testing 36,000 queries across 6 dispersion radii ($0.10$ to $0.35\text{ m}$) and 30 seeds. Across this comprehensive sweep, the average capture rate is $84.48\%$ [$95\%$ CI: $83.05\%$–$85.92\%$].
- **Audit Verdict**: **RECONCILED**. The $79.74\%$ figure reflects robust multi-parameter evaluation.

### Audit 4.5: Pinch Scale Normalization ($0.0\%$ Coefficient of Variation)
- **Source**: `evidence/summary_b6_scale_invariance.json` and `benchmark_b6_scale_invariance.py`.
- **Audit Finding**: Under an idealized pinhole projection model $x_{px} = (X \cdot f) / Z$, both the thumb-index distance and the wrist-MCP baseline scale inversely with depth $Z$:
  $$d_{\text{pinch}} = \frac{p_{\text{pinch}} \cdot f / Z}{S_{\text{hand}} \cdot f / Z} = \frac{p_{\text{pinch}}}{S_{\text{hand}}}$$
  Because $Z$ cancels algebraically in the numerator and denominator, the coefficient of variation across depths is identically $0.0\%$ **by mathematical definition**.
- **Audit Verdict**: **ANALYTIC DERIVATION, NOT EMPIRICAL PHYSICAL MEASUREMENT**. Describing $0.0\%$ CV as an empirical physical measurement of real human hands across depths is inaccurate. In real camera feeds, perspective foreshortening from out-of-plane hand tilt, sensor lens distortion, and landmark regression noise introduce non-zero variation. The paper must present this as a mathematical scale-invariance property under pinhole assumptions, qualified by real-world tilt limitations.

### Audit 4.6: Shape-Recognition Accuracy ($100\%$ on Synthetic Data)
- **Source**: `evidence/summary_b10_shape_recognition.json` and `summary_b10_sweep.json`.
- **Audit Finding**: The $100.0\%$ accuracy is achieved on mathematically synthesized, regular geometric strokes with low Gaussian perturbation ($\sigma \le 0.08$). In the sensitivity sweep (`summary_b10_sweep.json`), as noise increases to $\sigma = 0.20$ and $0.25$, accuracy degrades to $97.5\%$ and $92.1\%$ respectively.
- **Audit Verdict**: **SIMULATED**. The system has not been evaluated against real user hand sketches drawn in free space. The paper must explicitly classify this benchmark as a synthetic noise robustness evaluation, not human drawing accuracy.

### Audit 4.7: Mesh Validation ($100\%$ over 20 Models) & Fan Triangulation Defect
- **Source**: `evidence/summary_b9_mesh_validity.json` and `benchmark_b9_mesh_validity.mjs`.
- **Audit Finding**: All 20 evaluated models (cubes, cylinders, regular pentagon, hexagon, octagon, trapezoid, L-shape, T-shape, U-shape, star 10-gon) report $\chi = 2$, 0 boundary edges, 0 non-manifold edges, and $0.000\%$ volume discrepancy.
- **Deep Geometric Insight**:
  1. **Topological Graph Invariance**: In `ExtrusionEngine.js`, the caps are created by a triangle fan from vertex 0 (`faces.push([0, i, i+1])`). For any closed simple polygon of $N$ vertices, this generates $2(N-2)$ cap triangles and $2N$ side quad triangles, yielding $V = 2N$, $E = 6N - 6$, and $F = 4N - 4$. Hence, $\chi = V - E + F = 2$ **always holds algebraically**, regardless of whether the polygon is convex or concave.
  2. **Volumetric Divergence Cancellation**: In Gauss's Divergence Theorem $\frac{1}{6} \sum \mathbf{a} \cdot (\mathbf{b} \times \mathbf{c})$, triangles that cross outside a concave profile have inverted vertex order relative to the origin, producing signed volumes of opposite sign that algebraically cancel exterior volume contributions. Thus, the algebraic volume matches the analytical volume even for concave polygons!
  3. **Physical / Geometric Failure**: In $\mathbb{R}^3$, fan triangulation on a concave polygon (such as an L-shape or Star) causes cap triangles to **physically overlap and self-intersect**. The resulting mesh is an immersed 2-manifold with self-intersections, not an embedded submanifold. When exported to STL and imported into a 3D-printing slicer or FEA solver, self-intersecting facets cause ray-intersection errors and slicing failures.
  4. In contrast, `RevolveEngine.js` correctly uses `THREE.ShapeUtils.triangulateShape` (Earcut ear-clipping) for its partial revolution end caps.
- **Audit Verdict**: **PARTIALLY VERIFIED & RESTRICTED**. The claim of "universal watertight B-Rep solid validity" must be narrowed. The fan extrusion method guarantees valid, non-intersecting polyhedral embeddings **only for strictly convex profiles**. For general concave profiles, ear-clipping (Earcut) triangulation is mathematically required.

### Audit 4.8: Camera Frame Rate ($26.68\text{ FPS}$)
- **Source**: `evidence/raw/real_landmarks_session.json`.
- **Audit Finding**: A 5.29-second capture session of 141 frames recorded on physical host hardware using a standard USB webcam and MediaPipe Hands yielded a mean frame rate of $26.68\text{ FPS}$. Only 8 of the 141 frames contained a hand detection (diagnostic initialization run).
- **Audit Verdict**: **VERIFIED AS FEASIBILITY TEST**. It confirms that the Python capture loop achieves real-time interactive throughput ($\sim 27\text{ FPS}$) on consumer hardware, but it cannot be claimed as an extended benchmark of hand tracking accuracy.

---

## 5. Comprehensive Evidence Ledger

| Paper Claim | Source File / Function | Available Evidence | Verification Method | Final Status |
|---|---|---|---|---|
| **CL-01**: Software CAD pipeline latency of $0.1994\text{ ms}$ | `PlaneManager.js`, `snappingUtils.js`, `ExtrusionEngine.js`, `SolidMesh.js` | `evidence/summary_b1_latency.json` | Node.js high-resolution timer (`performance.now()`) over 5,000 iterations | **VERIFIED** (Software CPU execution only; excludes hardware/sensor motion-to-photon latency) |
| **CL-02**: Physical motion-to-photon end-to-end latency $< 30\text{ ms}$ | Physical camera-to-display pipeline | No measurement file | Requires 240 FPS optical camera or photodiode rig. Protocol defined in `/study/protocol.md`. | **UNTESTED / UNMEASURED** (Draft claim of $<30\text{ ms}$ removed; stated as unmeasured) |
| **CL-03**: Velocity-adaptive tremor filter reduces RMS jitter by $52.43\%$ | `backend/tracking/gesture_recognizer.py` & Node sweep script | `evidence/summary_b3_sweep.json` | 180 simulation runs (6 noise levels $\times$ 30 seeds, 90,000 samples) | **SIMULATED** (Verified via multi-seed parameter sweep) |
| **CL-04**: Dual-threshold hysteresis suppresses spurious flips by $85.55\%$ | `evidence/scripts/sweep_b4_hysteresis.mjs` | `evidence/summary_b4_sweep.json` | 180 simulation runs (6 noise levels $\times$ 30 seeds, 450,000 boundary frames) | **SIMULATED** (Reconciles single-run $92.1\%$ with grand mean $85.55\%$) |
| **CL-05**: Wrist-MCP scale normalization achieves distance invariance ($0.0\%$ CV) | `backend/tracking/gesture_recognizer.py` L80-87 | `evidence/summary_b6_scale_invariance.json` | Analytical pinhole projection equations across 4 distances (30–100 cm) | **ANALYTIC** (Mathematical property of perspective projection; not real-world empirical) |
| **CL-06**: Heuristic shape regularizer recognizes primitives | `frontend/src/utils/shapeRecognizer.js` | `evidence/summary_b10_sweep.json` | 180 simulation runs (6 noise levels $\times$ 30 seeds, 18,000 synthetic strokes) | **SIMULATED** ($100\%$ at $\sigma \le 0.08$; degrades to $92.1\%$ at $\sigma=0.25$) |
| **CL-07**: Snapping captures gestures ($84.48\%$) and reduces error ($79.74\%$) | `frontend/src/utils/snappingUtils.js` | `evidence/summary_b11_sweep.json` | 180 simulation runs (6 dispersion radii $\times$ 30 seeds, 36,000 queries) | **SIMULATED** (Reconciles single-run $93.0\%$ with sweep mean $79.74\%$) |
| **CL-08**: Extrusion produces Euler-compliant solids ($\chi = 2$) | `frontend/src/cad/geometry/ExtrusionEngine.js`, `SolidMesh.js` | `evidence/summary_b9_mesh_validity.json` | Algorithmic audit on 20 models | **VERIFIED** (Holds for genus-0 simply connected polyhedral meshes) |
| **CL-09**: Watertight solids with zero open boundary edges | `SolidMesh.js` L221-233 | `evidence/summary_b9_mesh_validity.json` | Topological half-edge traversal across 20 models | **VERIFIED** (0 unshared boundary edges) |
| **CL-10**: Manifold topology (every edge shared by exactly 2 faces) | `SolidMesh.js` L224-230 | `evidence/summary_b9_mesh_validity.json` | Edge-face incidence audit | **VERIFIED** (0 non-manifold edges) |
| **CL-11**: Exact volume calculation via Divergence Theorem | `SolidMesh.js` L167-206 | `evidence/summary_b9_mesh_validity.json` | Discrete divergence theorem surface integral compared to analytical formulas | **VERIFIED** ($0.000\%$ discrepancy on tested regular models) |
| **CL-12**: Universal cap triangulation for arbitrary profiles | `ExtrusionEngine.js` L74-82 | Code inspection | Triangle fan from vertex 0 inspected | **CONTRADICTED / RESTRICTED** (Valid for convex profiles; concave profiles self-intersect) |
| **CL-13**: Revolve modeling with axis welding and partial caps | `frontend/src/cad/geometry/RevolveEngine.js` | Code inspection & manual test | Revolve algorithm uses Rodrigues' formula, axis vertex welding, and Earcut caps | **VERIFIED** |
| **CL-14**: Sketch-on-face via local $SO(3)$ orthonormal frames | `frontend/src/cad/geometry/FaceEnumerator.js` | Code inspection & manual test | Gram-Schmidt / cross product basis construction on planar and cylindrical faces | **VERIFIED** |
| **CL-15**: Native export to OBJ, DXF, STL, JSON | `frontend/src/utils/exportUtils.js` | Code inspection & file export tests | Implements OBJ (`v`, `f`), DXF (`3DFACE`), STL, and JSON formats | **VERIFIED** |
| **CL-16**: Constructive Solid Geometry (CSG) Booleans | `frontend/src/cad/geometry/BooleanEngine.js` | File inspection | Empty stub; overlapping solids are not merged | **NOT IMPLEMENTED** |
| **CL-17**: Zero-install, browser-only deployment | Full repository | Architecture inspection | Requires local Python service with OpenCV and MediaPipe | **CONTRADICTED** (Client-edge architecture; not zero-install) |
| **CL-18**: Human Usability (SUS $> 80$, low NASA-TLX) | `study/` directory | Protocol documents | No human trials conducted | **UNTESTED (Protocol Designed)** |
