# GestureCAD: A Contactless, Web-Based 3D Computer-Aided Design Kernel with Direct-Manipulation B-Rep Extrusion, Topological Invariant Validation, and Multi-Surface Parametric Sketching

**Authors**: Alish Laimayum et al.  
**Affiliation**: Department of Computer Science & Engineering  
**Target Venues**: IEEE TVCG / ACM UIST / Computer-Aided Design (Elsevier)  
**Manuscript Status**: Research Draft & Technical Evaluation (Under Continuous Audit)

---

## Abstract

Traditional Computer-Aided Design (CAD) workflows remain constrained to classical WIMP (Windows, Icons, Menus, Pointer) interfaces, requiring specialized 2D hardware peripherals and indirect multi-view projection manipulation to author 3D spatial geometry. While immersive Virtual and Augmented Reality (VR/AR) solutions provide spatial input, they impose substantial economic burdens, cumbersome head-mounted displays, and fatigue-inducing interaction paradigms. In this paper, we present **GestureCAD**, a contactless, hardware-agnostic, browser-based 3D CAD modeling system and geometric kernel driven by monocular RGB hand tracking. We introduce a decoupled dual-engine architecture that bridges a multi-threaded edge computer vision pipeline with a zero-reconciliation WebGL/Three.js rendering kernel designed for a $16.6\text{ ms}$ ($60\text{ FPS}$) budget.

To resolve spatial ambiguity and hand tremor without tactile feedback, GestureCAD incorporates:
1. An anatomical scale-invariant normalized metric space using wrist-to-MCP Euclidean baselines ($0.0\%$ coefficient of variation across $30$--$100\text{ cm}$ camera ranges);
2. A dual-threshold hysteresis state machine reducing spurious pinch state transitions by a mean of $85.55\%$ [$95\%$ CI: $84.01\%$–$87.10\%$] across stochastic sensitivity sweeps;
3. A velocity-adaptive exponential moving average (EMA) filter with dead-zone noise gating that attenuates cursor jitter by a mean of $52.43\%$ [$95\%$ CI: $52.16\%$–$52.71\%$];
4. An unconstrained 3D geometric snapping and heuristic shape-regularization engine capturing $84.48\%$ of targeting attempts and reducing positional error by $79.74\%$ [$95\%$ CI: $77.28\%$–$82.20\%$];
5. A direct-manipulation 3D extrusion engine (*Z-Hold Mode*) that enables continuous spatial sweeping of planar profiles into watertight, 2-manifold Boundary Representation (B-Rep) solids.

Furthermore, we present an automatic face-decomposition and surface-attached coordinate mapping pipeline that constructs local orthonormal bases $\mathbf{R} \in SO(3)$ on existing 3D polyhedra and curved cylindrical boundaries, permitting hierarchical sketch-on-face operations directly in 3D space. Comprehensive empirical evaluations demonstrate sub-millisecond cumulative software CAD processing ($0.1994\text{ ms}$ mean), $100\%$ topological invariant compliance ($\chi = V - E + F = 2$) across generated polyhedra, exact Divergence Theorem volumetric integration ($0.000\%$ analytical discrepancy), and native export to industry-standard CAD persistence formats (Wavefront OBJ, AutoCAD DXF, and stereolithography STL).

**Keywords**: Computer-Aided Design, Gesture-Based Interaction, Monocular Hand Tracking, Boundary Representation (B-Rep), Topological Invariants, Divergence Theorem, WebGL, Zero-Reconciliation Rendering.

---

## 1. Introduction

Since Sutherland's introduction of *Sketchpad* in 1963 [@sutherland1963sketchpad], Computer-Aided Design (CAD) systems have revolutionized engineering, product design, and architectural fabrication. However, the foundational interaction paradigm for desktop CAD has remained fundamentally stagnant: three-dimensional spatial concepts are continuously translated through two-dimensional planar controllers (mouse, trackball, tablet) and multiplexed across four disjoint 2D projection viewports (Top, Front, Right, Isometric). This cognitive translation gap introduces notable friction, disrupting the ideation workflow of engineers and novice creators alike.

To bridge this spatial rift, researchers have actively explored immersive spatial interfaces, including stereoscopic Virtual Reality (VR) head-mounted displays and optical tracker controllers [@gravitysketch, @tiltbrush]. Although these systems offer unconstrained six-degree-of-freedom ($6$-DoF) spatial authoring, they suffer from practical limitations:
1. **Economic and Setup Friction**: Commercial VR/AR headsets require substantial capital investments, spatial room calibration, and heavy headgear.
2. **Physiological Fatigue**: Continuous mid-air arm suspension in immersive environments induces rapid musculoskeletal exhaustion, colloquially documented as "Gorilla Arm" syndrome [@song2014air].
3. **Geometric Imprecision**: VR sketching tools predominantly yield unconstrained polygonal ribbons, triangle soup, or open non-manifold surface approximations suitable for artistic conceptualization, but wholly invalid for engineering manufacture, volumetric analysis, or computational fluid simulation.

Concurrently, while computer vision frameworks such as Google MediaPipe [@zhang2020mediapipe] and TensorFlow.js [@ACP2020handpose] have democratized real-time articulated hand pose estimation on commodity RGB sensors, applying raw landmark streams to precision solid modeling introduces critical signal challenges. Monocular hand tracking exhibits high-frequency physiological tremor ($\sigma > 3\text{ mm}$), optical quantization noise, distance-dependent landmark scaling, and rapid limit-cycle flutter near discrete gesture thresholds. Furthermore, web-based CAD architectures implemented atop declarative UI layers (e.g., React virtual DOM) suffer from garbage collection (GC) pauses and reconciliation latency when ingesting streaming landmark coordinates at high frequencies.

To resolve this dilemma, we present **GestureCAD**, a contactless, web-native 3D CAD modeling system and solid geometry kernel. GestureCAD executes directly on standard consumer devices equipped with an everyday monocular webcam, requiring zero proprietary infrared peripherals or wearable markers.

### Core Verified Contributions

- **Contribution 1: Decoupled Client-Edge WebCAD Architecture**: A client-edge microservice topology separating a multi-threaded Python/OpenCV/MediaPipe edge vision pipeline from a zero-reconciliation React Three Fiber (R3F) WebGL rendering engine. Direct GPU `BufferGeometry` and typed `Float32Array` mutations execute within $0.1994\text{ ms}$ cumulative CPU time per frame, well within the $16.6\text{ ms}$ budget without virtual DOM reconciliation bottlenecks.
- **Contribution 2: Multi-Stage Kinematic Conditioning Stack**: An anatomical normalization baseline derived from the wrist-to-middle metacarpophalangeal (MCP) Euclidean distance ($0.0\%$ CV across $30$--$100\text{ cm}$), coupled with a dual-threshold state automaton reducing spurious flips by $85.55\%$ [$95\%$ CI: $84.01\%$–$87.10\%$] and a velocity-adaptive EMA filter reducing RMS cursor jitter by $52.43\%$ [$95\%$ CI: $52.16\%$–$52.71\%$].
- **Contribution 3: Watertight B-Rep Solid Kernel with Multi-Surface Sketching**: A swept-volume boundary representation kernel that extrudes planar 2D profiles into closed 2-manifold polyhedral meshes with guaranteed topological validity ($\chi = V - E + F = 2$, zero open boundary edges, zero non-manifold edges), exact Divergence Theorem volumetric integration, and $SO(3)$ orthonormal frame derivation for sketch-on-face operations on planar and cylindrical surfaces.

---

## 2. Related Work

Our research synthesizes three distinct literature threads: vision-based gesture interaction, spatial/immersive CAD systems, and web-based computational geometry kernels.

### 2.1 Vision-Based Hand Tracking and Signal Conditioning
Optical markerless hand pose estimation has evolved from early color segmentation and depth-map skeletons [@suma2011faast] to deep learning regression frameworks. Ultraleap's Leap Motion [@leapmotion2013] demonstrated sub-millimeter infrared finger tracking, but required dedicated desk-mounted stereo hardware. The release of Google MediaPipe Hands [@zhang2020mediapipe, @lugaresi2019mediapipe] enabled monocular 2.5D landmark inference directly from commodity RGB streams at interactive frame rates. 

However, raw landmark streams are insufficient for CAD interaction. Signal filtering techniques such as the $1€$ Filter [@casiez2012oneeuro] and double exponential smoothing [@laviola2003double] demonstrated the value of speed-adaptive low-pass filters in reducing human motor jitter. In GestureCAD, we expand these concepts into an integrated kinematic conditioning layer combining anatomical baseline normalization, dual-threshold hysteresis, dead-zone gating, and velocity-clamped dynamic EMA smoothing.

### 2.2 Spatial, Gesture-Driven, and Immersive 3D CAD
Early attempts to introduce spatial gestures into CAD include Shape-It-Up [@vinayak2013shapeitup], which leveraged depth cameras for generalized cylinder deformation. In commercial VR, tools such as Gravity Sketch [@gravitysketch] and Google Tilt Brush [@tiltbrush] introduced sweeping spatial brush strokes. While visually compelling, these immersive tools create non-manifold polygonal ribbons rather than mathematically closed, watertight solids required for finite element analysis (FEA), computer-aided manufacturing (CAM), or 3D printing. Conversely, industrial desktop CAD platforms (e.g., SolidWorks [@solidworks], AutoCAD [@autocad], FreeCAD [@freecad]) enforce rigorous Boundary Representation (B-Rep) and Constructive Solid Geometry (CSG) standards [@mantyla1988, @hoffmann1989geometric], but remain tethered to the 2D mouse and keyboard. GestureCAD bridges this divide by delivering verified, manifold B-Rep solids directly from natural hand gestures.

### 2.3 Web-Based Computational Geometry and Real-Time Graphics
The emergence of WebGL and WebAssembly (WASM) has enabled sophisticated geometric modeling in the web browser. Three.js [@threejs] provides low-level scenegraph rendering, while React Three Fiber (R3F) [@r3f] introduces declarative component composition. For solid modeling, WebAssembly ports of industrial kernels like OpenCASCADE.js [@opencascadejs] and ManifoldCAD [@manifoldcad] have demonstrated complex boolean evaluation in the browser. GestureCAD avoids the common web-CAD pitfall of routing high-frequency tracking data through React's virtual DOM reconciler, using in-place `Float32Array` buffer mutations via Three.js `useFrame()` refs for high-frequency rendering.

---

## 3. Mathematical & Algorithmic Formulation

### 3.1 Anatomical Scale Invariance and Dual-Threshold Hysteresis
Let $\mathcal{L} = \{\mathbf{l}_i = (x_i, y_i, z_i) \in \mathbb{R}^3\}_{i=0}^{20}$ represent the 21 articulated skeletal hand landmarks estimated by MediaPipe, where $\mathbf{l}_0$ is the carpal wrist joint, $\mathbf{l}_4$ the thumb tip, $\mathbf{l}_8$ the index fingertip, and $\mathbf{l}_9$ the middle finger metacarpophalangeal (MCP) joint.

Because monocular camera perspective causes apparent pixel dimensions to vary inversely with distance $Z_{\text{cam}}$, raw Euclidean finger distances $\|\mathbf{l}_4 - \mathbf{l}_8\|_2$ vary dramatically as the user shifts relative to the webcam. To render gesture thresholds invariant to camera distance and user anthropometry, we define the anatomical reference normalization baseline $S_{\text{hand}}$:
$$\begin{equation}
S_{\text{hand}} = \|\mathbf{l}_9 - \mathbf{l}_0\|_2 = \sqrt{(x_9 - x_0)^2 + (y_9 - y_0)^2 + (z_9 - z_0)^2}
\end{equation}$$

The normalized pinch interaction metric $d_{\text{pinch}}$ is computed as:
$$\begin{equation}
d_{\text{pinch}} = \frac{\|\mathbf{l}_4 - \mathbf{l}_8\|_2}{S_{\text{hand}}}
\end{equation}$$

To eliminate limit-cycle chatter at the decision boundary, transitions between `IDLE` and `PINCH` are governed by asymmetric thresholds ($\tau_{\text{start}} = 0.44$, $\tau_{\text{release}} = 0.54$) combined with persistence debouncing:
$$\begin{equation}
\sigma_{t} = \begin{cases}
\text{PINCH}, & \text{if } \sigma_{t-1} = \text{IDLE} \land d_{\text{pinch}} < \tau_{\text{start}} \land \text{State} \neq \text{FIST} \\
\text{IDLE}, & \text{if } \sigma_{t-1} = \text{PINCH} \land d_{\text{pinch}} > \tau_{\text{release}} \\
\sigma_{t-1}, & \text{otherwise}
\end{cases}
\end{equation}$$

### 3.2 Dynamic Velocity-Adaptive Tremor Attenuation
Raw landmark streams contain optical noise and human micro-tremor: $\tilde{\mathbf{p}}_t = \mathbf{p}_t + \boldsymbol{\epsilon}_t$. GestureCAD conditions this signal through a sequential three-stage pipeline:

**Stage 1: Micro-Tremor Dead-Zone Gating.** Small involuntary tremors are eliminated by rejecting displacements below $\epsilon_{\text{dead}} = 0.003\text{ m}$ ($3\text{ mm}$):
$$\begin{equation}
\hat{\mathbf{p}}_t = \begin{cases} 
\mathbf{p}_{t-1}, & \text{if } \|\tilde{\mathbf{p}}_t - \mathbf{p}_{t-1}\|_2^2 < \epsilon_{\text{dead}}^2 \\ 
\tilde{\mathbf{p}}_t, & \text{otherwise} 
\end{cases}
\end{equation}$$

**Stage 2: Velocity-Clamped Outlier Rejection.** To prevent tracking anomalies caused by momentary occlusion, inter-frame displacement is capped at $\delta_{\max} = 2.5\text{ m/frame}$:
$$\begin{equation}
\mathbf{p}^*_t = \mathbf{p}_{t-1} + \min\left(1.0, \, \frac{\delta_{\max}}{\|\hat{\mathbf{p}}_t - \mathbf{p}_{t-1}\|_2}\right) (\hat{\mathbf{p}}_t - \mathbf{p}_{t-1})
\end{equation}$$

**Stage 3: Velocity-Adaptive Exponential Moving Average (EMA).** The dynamic smoothing factor $\alpha(v_t)$ scales monotonically with instantaneous hand speed $v_t = \|\mathbf{p}^*_t - \mathbf{p}_{t-1}\|_2$:
$$\begin{equation}
\alpha(v_t) = \min\left(1.0, \, \alpha_0 + \min(0.25, \, 0.5 \cdot v_t)\right), \quad \alpha_0 = 0.35
\end{equation}$$
$$\begin{equation}
\mathbf{p}_t = \mathbf{p}_{t-1} + \alpha(v_t) \cdot (\mathbf{p}^*_t - \mathbf{p}_{t-1})
\end{equation}$$

### 3.3 Perspective Unprojection and Ray-Plane Intersection
A 2D normalized screen position $(x, y) \in [0, 1]^2$ is mapped to Normalized Device Coordinates (NDC):
$$\begin{equation}
\mathbf{x}_{\text{ndc}} = \begin{bmatrix} 2x - 1 \\ -(2y - 1) \\ 1 \end{bmatrix}
\end{equation}$$

The world-space ray origin $\vec{r}_0$ and unit direction vector $\vec{d}$ are evaluated using the camera position $\mathbf{C}_{\text{camera}}$ and inverse view-projection matrix $\mathbf{M}_{\text{vp}}^{-1} = (\mathbf{P}_{\text{proj}} \mathbf{V}_{\text{view}})^{-1}$:
$$\begin{equation}
\vec{r}_0 = \mathbf{C}_{\text{camera}}, \quad \vec{d} = \frac{\mathbf{M}_{\text{vp}}^{-1} \mathbf{x}_{\text{ndc}}}{\|\mathbf{M}_{\text{vp}}^{-1} \mathbf{x}_{\text{ndc}}\|_2}
\end{equation}$$

Given an active parametric working plane $\Pi$ defined by center $\vec{p}_0 \in \mathbb{R}^3$ and unit normal $\vec{n} \in \mathbb{R}^3$, the intersection parameter $t^*$ is given by:
$$\begin{equation}
t^* = \frac{(\vec{p}_0 - \vec{r}_0) \cdot \vec{n}}{\vec{d} \cdot \vec{n}}, \quad \text{valid for } |\vec{d} \cdot \vec{n}| > 10^{-6} \land t^* \ge 0
\end{equation}$$

The 3D intersection point $\vec{p}_{\text{hit}} = \vec{r}_0 + t^* \vec{d}$ is projected onto planar coordinates $(u, v)$ via orthonormal in-plane basis vectors $\vec{u}_{\text{tangent}}, \vec{v}_{\text{bitangent}}$:
$$\begin{equation}
u = (\vec{p}_{\text{hit}} - \vec{p}_0) \cdot \vec{u}_{\text{tangent}}, \quad v = (\vec{p}_{\text{hit}} - \vec{p}_0) \cdot \vec{v}_{\text{bitangent}}
\end{equation}$$

### 3.4 2D Planar Profile Parameterization & Winding Orientation
A 2D sketch profile $\mathcal{P} = \{\mathbf{q}_i = (u_i, 0, v_i)\}_{i=0}^{N-1}$ is evaluated for closure. Its signed planar area $A(\mathcal{P})$ is computed using the Gauss-Green / Shoelace theorem in the $u-v$ plane:
$$\begin{equation}
A(\mathcal{P}) = \frac{1}{2} \sum_{i=0}^{N-1} (u_i v_{i+1} - u_{i+1} v_i), \quad \text{where } \mathbf{q}_N \equiv \mathbf{q}_0
\end{equation}$$
To enforce counter-clockwise (CCW) winding:
$$\begin{equation}
\text{If } A(\mathcal{P}) < 0 \implies \mathcal{P} \leftarrow \text{reverse}(\mathcal{P})
\end{equation}$$

### 3.5 B-Rep Extrusion and Watertight 2-Manifold Construction
Linear extrusion sweeps the planar profile $\mathcal{P}$ along the working plane normal vector $\vec{n}_{\text{plane}}$ by an extrusion height $h \in \mathbb{R}^+$:
$$\begin{equation}
\Omega = \mathcal{P} \times [0, h] \cdot \vec{n}_{\text{plane}}
\end{equation}$$

Total vertices: $V = 2N$. Total triangular faces: $F = 4N - 4$. Total edges: $E = 6N - 6$.
For any closed, orientable 2-manifold polyhedron of genus $g = 0$:
$$\begin{equation}
\chi = V - E + F = (2N) - (6N - 6) + (4N - 4) = 2
\end{equation}$$

By applying Gauss's Divergence Theorem with vector field $\vec{F}(\mathbf{x}) = \frac{1}{3}\mathbf{x}$ ($\nabla \cdot \vec{F} = 1$), the closed domain volume $V(\Omega)$ is computed exactly over triangular faces $\mathcal{F}_k = (\mathbf{a}_k, \mathbf{b}_k, \mathbf{c}_k)$:
$$\begin{equation}
V(\Omega) = \iiint_{\Omega} (\nabla \cdot \vec{F}) \, dV = \frac{1}{6} \sum_{k=1}^{F} \mathbf{a}_k \cdot (\mathbf{b}_k \times \mathbf{c}_k)
\end{equation}$$

### 3.6 Multi-Surface Decomposition and Orthonormal Tangent Bases
To construct a singularity-free orthonormal basis for parametric sketch attachment:
$$\begin{equation}
\vec{r}_{\text{ref}} = \begin{cases} [0, 1, 0]^T, & \text{if } |\vec{n} \cdot [0, 1, 0]^T| < 0.9 \\ [1, 0, 0]^T, & \text{otherwise} \end{cases}
\end{equation}$$
$$\begin{equation}
\vec{t} = \frac{\vec{n} \times \vec{r}_{\text{ref}}}{\|\vec{n} \times \vec{r}_{\text{ref}}\|}, \quad \vec{b} = \vec{t} \times \vec{n}
\end{equation}$$
$$\begin{equation}
\mathbf{R}_{\text{face}} = \begin{bmatrix} \vec{t} & \vec{n} & \vec{b} \end{bmatrix}, \quad \det(\mathbf{R}_{\text{face}}) = +1, \quad \mathbf{R}_{\text{face}}^T \mathbf{R}_{\text{face}} = \mathbf{I}
\end{equation}$$

---

## 4. System Architecture & Implementation

The GestureCAD architecture comprises two primary tiers:
1. **Edge Vision Microservice**: Implemented in Python 3.10+ using OpenCV and MediaPipe. In empirical recording on physical hardware (Camera index 0), the acquisition loop captured 141 frames at an average of 26.68 FPS with full 21 3D landmark inference (`real_landmarks_session.json`). Telemetry packets are serialized as JSON and pushed across `ws://localhost:8000/ws/tracking`.
2. **Browser CAD Engine**: Implemented in React 18 with Three.js and React Three Fiber (R3F). Position streams bypass React state entirely, updating mutable `useRef` instances and mutating WebGL `BufferGeometry.attributes.position.array` (`Float32Array`) directly inside Three.js's native `useFrame()` render loop. Discrete transactional boundary events commit to a Zustand store.

---

## 5. Provenance & Evaluation Methodology

To maintain complete scientific integrity, every benchmark and claim is explicitly classified by scientific provenance:

**Table 1**: Scientific provenance and evaluation methodology of all system benchmarks.

| Benchmark ID | Dimension Evaluated | Methodology | Sample Scope | Primary Finding | Reference |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **B1** | Software CAD Subsystem Latency | **`REAL`** | 5 000 runs | Cumulative CAD stages take $0.1994\text{ ms}$ mean | `summary_b1_latency.json` |
| **B2** | Physical Motion-to-Photon Latency | **`NOT RUN`** | — | Unmeasured pending physical photodiode setup | Protocol in §6.1 |
| **B3** | Cursor Jitter Attenuation | **`SIMULATED`** | 180 runs (90k pts) | $52.43\%$ mean RMS reduction [$95\%$ CI: $52.16\%$–$52.71\%$] | `summary_b3_sweep.json` |
| **B4** | Hysteresis Pinch Chatter | **`SIMULATED`** | 180 runs (450k frames) | $85.55\%$ mean flip reduction [$95\%$ CI: $84.01\%$–$87.10\%$] | `summary_b4_sweep.json` |
| **B6** | Distance Scale Invariance | **`REAL / EMP.`** | 4 dists, 3 sizes | $0.0\%$ CV across $30$--$100\text{ cm}$ (vs $70\%$ raw) | `summary_b6_scale_invariance.json` |
| **B9** | B-Rep Topology & Volume | **`REAL + ANALYTIC`** | 20 solid models | $100\%$ pass: $\chi=2$, 0 boundary edges, $0.000\%$ volume error | `summary_b9_mesh_validity.json` |
| **B10** | Heuristic Shape Recognition | **`SIMULATED`** | 180 runs (18k strokes) | $100\%$ accuracy for $\sigma \le 0.08$; degrades to $92.1\%$ at $0.25$ | `summary_b10_sweep.json` |
| **B11** | Geometric Snapping Precision | **`SIMULATED`** | 180 runs (36k queries) | $84.48\%$ capture rate; $79.74\%$ targeting error reduction | `summary_b11_sweep.json` |
| **RL-1** | Real Video Landmark Stream | **`REAL`** | 141 frames | Captured real session at 26.68 FPS on physical host camera | `real_landmarks_session.json` |
| **STUDY** | Human Usability Evaluation | **`NOT RUN`** | 0 participants | Protocol designed in `/study/`; trials not yet conducted | Proposed in §8 |

---

## 6. Experimental Evaluation & Benchmark Results

### 6.1 Subsystem Computational Latency (Benchmark B1)

We evaluated the computational latency of each software CAD stage over $5\,000$ consecutive iterations on an Intel Core i7-12700H CPU. Table 2 reports the execution time breakdown.

**Table 2**: Software CAD pipeline subsystem latency breakdown ($N = 5\,000$ iterations, values in milliseconds).

| Subsystem Stage | Mean (ms) | Median (ms) | 95th %ile (ms) | 99th %ile (ms) | Std Dev (ms) | Provenance |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Ray-Plane Unprojection | 0.0045 | 0.0032 | 0.0073 | 0.0219 | 0.0171 | **`REAL`** |
| Snapping Inference | 0.0024 | 0.0015 | 0.0034 | 0.0068 | 0.0107 | **`REAL`** |
| Shape Regularization | 0.0836 | 0.0598 | 0.2001 | 0.3769 | 0.1035 | **`REAL`** |
| B-Rep Extrusion & Validation | 0.1009 | 0.0826 | 0.1992 | 0.4573 | 0.0803 | **`REAL`** |
| Face Enumeration & $SO(3)$ Basis | 0.0080 | 0.0041 | 0.0185 | 0.0324 | 0.0279 | **`REAL`** |
| **Cumulative Software CAD** | **0.1994** | **0.1512** | **0.4285** | **0.8953** | **0.2395** | **`REAL`** |

*Result*: The cumulative computational latency of the entire CAD pipeline is $0.1994\text{ ms}$ per frame, consuming only $1.2\%$ of the standard $16.6\text{ ms}$ ($60\text{ FPS}$) budget.

#### Physical End-to-End Latency Measurement Protocol (Benchmark B2 — Future Work)
To measure physical motion-to-photon latency without estimation, the following laboratory protocol is defined:
1. An LED indicator is mechanically coupled to the user's index finger, triggered upon physical movement onset via an accelerometer or microswitch.
2. A high-speed digital camera recording at 240 FPS (temporal resolution $\Delta t = 4.17\text{ ms}$) captures both the physical finger/LED and the monitor display within a single optical field of view.
3. Total motion-to-photon latency is computed as:
   $$\Delta t_{\text{e2e}} = (F_{\text{display\_pixel\_change}} - F_{\text{led\_activation}}) \times 4.167\text{ ms}$$
This apparatus isolates physical sensor exposure, USB transfer, MediaPipe neural inference, WebSocket network stack, WebGL rendering, and display monitor scanout. Until this physical test is conducted, end-to-end latency remains formally unmeasured.

### 6.2 Tremor Attenuation Sensitivity Sweep (Benchmark B3)

We conducted a parameter sweep across 6 noise levels ($\sigma \in [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]\text{ mm}$) and 30 random seeds ($180$ trials, $90\,000$ samples total).

**Table 3**: Tremor filter jitter sensitivity sweep across 6 noise levels ($30$ seeds each).

| Noise Level ($\sigma$) | Raw RMS Jitter (mm) | Filtered RMS Jitter (mm) | Mean RMS Reduction (%) | 95% Confidence Interval |
| :---: | :---: | :---: | :---: | :---: |
| $1.0\text{ mm}$ | $1.060 \pm 0.030$ | $0.573 \pm 0.013$ | $45.92\%$ | $[45.74\%, 46.10\%]$ |
| $2.0\text{ mm}$ | $2.119 \pm 0.061$ | $1.026 \pm 0.023$ | $51.58\%$ | $[51.42\%, 51.74\%]$ |
| $3.0\text{ mm}$ | $3.179 \pm 0.091$ | $1.493 \pm 0.034$ | $53.04\%$ | $[52.88\%, 53.20\%]$ |
| $4.0\text{ mm}$ | $4.238 \pm 0.122$ | $1.967 \pm 0.046$ | $53.58\%$ | $[53.42\%, 53.74\%]$ |
| $5.0\text{ mm}$ | $5.298 \pm 0.152$ | $2.446 \pm 0.057$ | $53.83\%$ | $[53.67\%, 53.99\%]$ |
| $6.0\text{ mm}$ | $6.358 \pm 0.183$ | $2.927 \pm 0.069$ | $53.96\%$ | $[53.79\%, 54.13\%]$ |
| **Aggregate** | — | — | **52.43%** | **[52.16%, 52.71%] (Range: 45.0% - 58.6%)** |

*Result*: Across all 180 runs, the filter achieves a mean jitter reduction of $52.43\%$, with performance scaling from $45.92\%$ on sub-millimeter noise to $53.96\%$ on high noise.

### 6.3 Hysteresis State Chatter Sensitivity Sweep (Benchmark B4)

We evaluated gesture stability across 6 boundary noise levels ($\sigma \in [0.015, 0.090]$) and 30 seeds ($180$ runs, $450\,000$ boundary frames total).

**Table 4**: Gesture state chatter sensitivity sweep ($5\,000$ boundary frames per trial).

| Noise Sigma ($\sigma$) | Naive State Flips | Hysteresis State Flips | Mean Flip Reduction (%) | 95% Confidence Interval |
| :---: | :---: | :---: | :---: | :---: |
| $0.015$ | $66.1 \pm 38.3$ | $0.3 \pm 0.6$ | $99.48\%$ | $[99.37\%, 99.59\%]$ |
| $0.030$ | $440.7 \pm 78.4$ | $20.9 \pm 12.0$ | $95.34\%$ | $[94.41\%, 96.27\%]$ |
| $0.045$ | $959.0 \pm 83.2$ | $88.5 \pm 23.3$ | $90.76\%$ | $[89.87\%, 91.65\%]$ |
| $0.060$ | $1326.6 \pm 77.2$ | $193.3 \pm 31.9$ | $85.42\%$ | $[84.50\%, 86.34\%]$ |
| $0.075$ | $1535.1 \pm 73.1$ | $328.6 \pm 35.1$ | $78.59\%$ | $[77.68\%, 79.50\%]$ |
| $0.090$ | $1641.5 \pm 67.9$ | $466.8 \pm 34.6$ | $71.55\%$ | $[70.62\%, 72.48\%]$ |
| **Aggregate** | — | — | **85.55%** | **[84.01%, 87.10%] (Range: 67.62% - 99.48%)** |

*Result*: GestureCAD's hysteresis automaton eliminates an average of $85.55\%$ of spurious transitions, providing near-perfect ($> 95\%$) suppression under typical human tremor ($\sigma \le 0.030$).

### 6.4 Shape Regularization & Snapping Sweeps (Benchmarks B10 & B11)

- **Shape Regularization (B10)**: Evaluated across 6 distortion levels $\times$ 30 seeds ($18\,000$ strokes total). Under low tremor ($\sigma \le 0.08$), accuracy is $100.0\%$; under moderate distortion ($\sigma = 0.12$--$0.16$), accuracy is $99.73\%$--$100.0\%$; under severe distortion ($\sigma = 0.20$--$0.25$), accuracy degrades gracefully to $97.5\%$ and $92.07\%$.
- **Geometric Snapping (B11)**: Evaluated across 6 dispersion radii $\times$ 30 seeds ($36\,000$ targeting queries). Across all runs, snapping captured an average of $84.48\%$ [$95\%$ CI: $83.05\%$–$85.92\%$] of queries, reducing positional targeting error by an average of $79.74\%$ [$95\%$ CI: $77.28\%$–$82.20\%$, range: $41.73\%$–$95.74\%$].

### 6.5 Topological Validity & Invariant Compliance (Benchmark B9)

We verified topological integrity across 20 extruded CAD models comprising regular polygons, stars, and arbitrary irregular profiles ($N \in [3, 64]$ vertices).
- **Euler Characteristic ($\chi$)**: $2.000 \pm 0.000$ ($100.0\%$ pass).
- **Boundary Edges ($\partial \Omega$)**: $0$ unshared edges ($100.0\%$ pass, guaranteed watertightness).
- **Manifold Edge Degree**: Exactly 2 faces per edge ($100.0\%$ pass).
- **Divergence Theorem Volume Error**: $0.000\%$ analytical discrepancy.

---

## 7. Comprehensive Component Ablation Study

**Table 5**: Component-by-component ablation study based on sensitivity sweeps.

| Configuration | RMS Jitter (mm) | State Flips / 5k Frames | Targeting Error Reduction | Scale Invariance (CV) | Architectural Impact |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Full System** | **$1.251\text{ mm}$** | **$85.6\%$ reduction** | **$79.7\%$ reduction** | **$0.0\%$** | Full stabilization, state filtering, and snapping enabled. |
| - Hysteresis (Single Threshold) | $1.251\text{ mm}$ | $0.0\%$ reduction | $79.7\%$ reduction | $0.0\%$ | Spurious state flips increase by up to $99.5\%$, causing severe chatter. |
| - Adaptive Smoothing (Dead-Zone Only) | $3.176\text{ mm}$ | $85.6\%$ reduction | $79.7\%$ reduction | $0.0\%$ | Active strokes suffer raw optical tremor ($0\%$ jitter reduction). |
| - Dead-Zone (Static LERP Only) | $1.193\text{ mm}$ | $85.6\%$ reduction | $79.7\%$ reduction | $0.0\%$ | Stationary noise suppressed, but velocity drag and resting micro-drift persist. |
| - Scale Normalization (Raw Pixels) | $1.251\text{ mm}$ | $85.6\%$ reduction | $79.7\%$ reduction | $70.0\%$ | Pinch metric varies by $70\%$ between $30\text{ cm}$ and $100\text{ cm}$ camera depths. |
| - Snapping (Raw Positioning) | $1.251\text{ mm}$ | $85.6\%$ reduction | $0.0\%$ reduction | $0.0\%$ | Human motor error leaves open gaps at vertex intersections. |
| **Baseline (Unconditioned)** | **$3.176\text{ mm}$** | **$0.0\%$ reduction** | **$0.0\%$ reduction** | **$70.0\%$** | Severe jitter, pen chatter, scale drift, and coarse targeting. |

---

## 8. Proposed Usability Study Protocol

To evaluate human factors and cognitive workload, a standardized 12-participant within-subjects study protocol has been designed (`/study/protocol.md`), accompanied by informed consent forms (`/study/consent_form.md`), demographics questionnaires (`/study/demographics_questionnaire.md`), and post-task instruments (`/study/post_task_questionnaire.md`).

The protocol defines 5 modeling challenges:
1. **Task 1: Basic 2D Precision Sketching** (Draw a square and circle with snapping);
2. **Task 2: Direct 3D Extrusion** (Extrude a closed rectangle into a prism using Z-Hold Mode);
3. **Task 3: Multi-Surface Feature Addition** (Select the top face of the prism and draw an aligned cylinder boss);
4. **Task 4: Cylindrical Surface Attachment** (Select the curved face of a cylinder and construct a tangent feature);
5. **Task 5: Mechanical Part Assembly** (Model a bracket component from a reference engineering drawing).

Participants will complete the System Usability Scale (SUS) [@brooke1996sus] and raw NASA Task Load Index (NASA-TLX) [@hart1988nasa]. Formal execution of this protocol with human participants is planned for subsequent work.

---

## 9. Limitations

1. **Monocular Depth Ambiguity**: While the wrist-to-MCP anatomical baseline provides distance scale invariance, extreme out-of-plane hand tilt introduces perspective foreshortening that affects landmark estimation. Integrating temporal Kalman filtering with biomechanical kinematic joint constraints would improve tilt robustness.
2. **Topological Genus Constraint**: The current B-Rep extrusion kernel enforces the Euler characteristic $\chi = 2$, valid for simply connected polyhedra homeomorphic to a 2-sphere ($g = 0$). Extending the kernel to support through-holes requires generalizing the invariant to $\chi = 2(1 - g)$ and implementing 2D polygon nesting with hole triangulation.
3. **Constructive Solid Geometry (CSG) Booleans**: Currently, overlapping extruded features remain discrete solid meshes. Integrating real-time CSG boolean operations (Union, Difference, Intersection) via BSP tree decomposition (e.g., leveraging ManifoldCAD WASM kernels [@manifoldcad]) will enable subtractive manufacturing workflows like drilling and pocketing.
4. **Physical Latency Characterization**: Although software execution latency is verified at $0.1994\text{ ms}$, total physical motion-to-photon latency remains unverified by external optical hardware.
5. **Single-Hand Input**: The current tracking pipeline tracks a single hand (`max_num_hands=1`). Expanding to two-handed interaction (e.g., non-dominant hand controlling camera orbit/pan/zoom while dominant hand sketches) represents a compelling natural progression.

---

## 10. Conclusion

In this paper, we presented **GestureCAD**, a contactless, web-based 3D Computer-Aided Design kernel driven by monocular hand gestures. By coupling an edge vision microservice with a zero-reconciliation WebGL/Three.js rendering engine, GestureCAD eliminates the performance penalties typical of web-based spatial applications, achieving cumulative software CAD latencies under $0.2\text{ ms}$ per frame.

Through an integrated kinematic conditioning stack, GestureCAD resolves the spatial ambiguity and jitter inherent to contactless interaction, attenuating tremor by a mean of $52.43\%$, eliminating spurious gesture transitions by $85.55\%$, and reducing targeting error by $79.74\%$. Crucially, GestureCAD guarantees the mathematical validity of its authored solids, achieving $100\%$ compliance with the Euler characteristic ($\chi = 2$), zero boundary edge defects, and exact volumetric calculation via Gauss's Divergence Theorem. By removing the financial and physical barriers of specialized hardware and heavyweight desktop software, GestureCAD democratizes 3D spatial modeling, taking a meaningful step toward Sutherland's vision of direct, natural man-machine graphical communication.

---

## References

*(Compiled from [`references.bib`](file:///d:/capstone%20project/paper/references.bib))*

- [@sutherland1963sketchpad] Sutherland, I. E. (1963). Sketchpad: A Man-Machine Graphical Communication System. *AFIPS Spring Joint Computer Conference*, 329–346.
- [@zhang2020mediapipe] Zhang, F., Bazarevsky, V., Vakunov, A., et al. (2020). MediaPipe Hands: On-device Real-time Hand Tracking. *CVPR Workshop on Computer Vision for AR/VR*.
- [@casiez2012oneeuro] Casiez, G., Roussel, N., & Vogel, D. (2012). 1€ Filter: A Simple Speed-Based Low-Pass Filter for Noisy Input in Interactive Systems. *ACM CHI*, 2527–2530.
- [@mantyla1988] Mäntylä, M. (1988). *An Introduction to Solid Modeling*. Computer Science Press.
- [@hoffmann1989geometric] Hoffmann, C. M. (1989). *Geometric and Solid Modeling: An Introduction*. Morgan Kaufmann.
- [@vinayak2013shapeitup] Vinayak, Devanathan, N., Chi, Z., & Ramani, K. (2013). Shape-It-Up: Hand Gesture Based Creative Expression of 3D Shapes Using Intelligent Generalized Cylinders. *Computer-Aided Design*, 45(2), 277–287.
- [@brooke1996sus] Brooke, J. (1996). SUS: A Quick and Dirty Usability Scale. *Usability Evaluation in Industry*, 189, 4–7.
- [@hart1988nasa] Hart, S. G., & Staveland, L. E. (1988). Development of NASA-TLX. *Advances in Psychology*, 52, 139–183.
- [@threejs] Cabello, R. (2024). Three.js: JavaScript 3D Library.
- [@r3f] Poimandres. (2024). React Three Fiber: A React Renderer for Three.js.
- [@opencascadejs] Nicola, S. et al. (2021). OpenCASCADE.js: WASM Port of the Open CASCADE B-Rep Kernel.
- [@manifoldcad] Atkinson, E. (2022). ManifoldCAD: Fast Boolean Operations on Manifold Meshes.
