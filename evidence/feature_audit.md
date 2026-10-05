# Feature Audit & Implementation Verification

This audit was conducted by inspecting the codebase, running unit verification scripts, and checking runtime data flows.

## 1. Feature Verification Matrix

| # | README Claim | Implemented? | File : Function | Verification Method | Notes |
|---|---|---|---|---|---|
| 1 | Real-time 21-landmark tracking | **YES** | `backend/tracking/hand_tracker.py` : `HandTracker.find_hands()` | Code inspection & execution | Uses Google MediaPipe `mp.solutions.hands.Hands` (max_num_hands=1). |
| 2 | Scale-invariant pinch normalization | **YES** | `backend/tracking/gesture_recognizer.py` : `GestureRecognizer.recognize()` | Code inspection & unit test | Computes $S_{\text{hand}} = \|\mathbf{l}_9 - \mathbf{l}_0\|_2$ (wrist to middle MCP). Pinch metric is $d_{\text{pinch}} = \|\mathbf{l}_4 - \mathbf{l}_8\|_2 / S_{\text{hand}}$. |
| 3 | Dual-threshold hysteresis | **YES** | `frontend/src/utils/gestureStateMachine.js` : `GestureStateMachine.update()` | Code inspection & unit test | $\tau_{\text{start}} = 0.44$, $\tau_{\text{release}} = 0.54$. Debounced: 1 frame start, 2 frames release. |
| 4 | Velocity-adaptive smoothing | **YES** | `frontend/src/utils/smoothing.js` : `PositionSmoother.update()` | Code inspection & unit test | Dynamic $\alpha(v) = \min(1.0, \alpha_0 + \min(0.25, 0.5 \cdot v))$, where $\alpha_0 = 0.35$. |
| 5 | Dead-zone tremor gating | **YES** | `frontend/src/utils/smoothing.js` : `PositionSmoother.update()` | Code inspection & unit test | Suppresses displacements where $\Delta d^2 < 0.003^2\text{ m}^2$ ($3\text{ mm}$ threshold). |
| 6 | B-Rep extrusion kernel | **YES** | `frontend/src/cad/geometry/ExtrusionEngine.js` : `ExtrusionEngine.extrude()` | Code inspection & `testSolid.mjs` | Sweeps closed/open profiles along plane normal, creating bottom cap, top cap, and lateral quad-wall half-edge topology. |
| 7 | Euler characteristic validation | **YES (genus 0)** / **PARTIAL (genus > 0)** | `frontend/src/cad/geometry/SolidMesh.js` : `SolidMesh.validateSolid()` | Code inspection & test script | Validates $\chi = V - E + F = 2$. Currently scoped to genus $g = 0$ polyhedra without through-holes. |
| 8 | Divergence-theorem volume | **YES** | `frontend/src/cad/geometry/SolidMesh.js` : `SolidMesh.computeVolumeAndArea()` | Code inspection & mathematical test | Computes $V = \frac{1}{6}\sum \mathbf{a}_k \cdot (\mathbf{b}_k \times \mathbf{c}_k)$ over all boundary triangle faces. |
| 9 | Z-hold extrusion | **YES** | `frontend/src/hooks/useZElongation.js` : `handleHoldExtrusion()` | Code inspection & interaction trace | Finds closest projected solid, locks on pinch, sweeps height continuously along normal vector. |
| 10 | Face selection + multi-plane sketching | **YES** | `frontend/src/cad/geometry/FaceEnumerator.js` : `enumerateFaces()`, `faceToEuler()`, `getFaceFromHit()` | Code inspection & node execution | Categorizes Top, Bottom, Side for cylinders, Front/Back/Left/Right/Top/Bottom for boxes; sets temporary face plane in $SO(3)$. |
| 11 | Snapping (vertex, midpoint, edge, ortho) | **YES** | `frontend/src/utils/snappingEngine.js` : `SnappingEngine.snap()` | Code inspection & unit test | Geometric inference engine supporting vertex magnetic snap, edge projections, midpoint, and grid locks. |
| 12 | Angular ortho-lock (15/30/45/90) | **YES** | `frontend/src/utils/snappingEngine.js` : `applyAngleSnap()` | Code inspection & unit test | Quantizes vector angle to configurable angular steps ($15^\circ, 30^\circ, 45^\circ, 90^\circ$). |
| 13 | Shape regularization (circle/rect/line) | **YES** | `frontend/src/utils/shapeRecognizer.js` : `recognizeShape()` | Code inspection & unit test | Heuristic recognizer analyzing straightness ratio, radius CV, closure ratio, and corner angles. |
| 14 | Export OBJ / DXF / STL | **YES** | `frontend/src/utils/exportUtils.js`, `frontend/src/cad/geometry/SolidMesh.js` | Code inspection & test script | Exports watertight Wavefront `.OBJ` (3D faces `f`), AutoCAD `.DXF` (POLYLINE), and binary/ASCII `.STL`. |

---

## 2. Inconsistency Resolutions & Architectural Reality

### 2.1 Webcam Acquisition Source
- **Reality**: The webcam is **NOT** accessed via the browser's `navigator.mediaDevices.getUserMedia`. 
- **Actual Architecture**: Video frames are captured directly on the local machine by **Python using OpenCV** (`cv2.VideoCapture(0)`) in `backend/main.py`. The frame is processed through MediaPipe, and landmark telemetry is serialized into JSON and pushed across a localhost WebSocket (`ws://localhost:8000/ws/tracking`) to the React frontend.
- **Academic Reporting Implication**: The paper must truthfully describe this as an edge-server/client decoupled architecture, not a pure client-side in-browser vision system.

### 2.2 System Deployment
- **Reality**: The application requires two concurrent local runtime environments:
  1. Python 3.10+ ASGI service (`uvicorn` / `FastAPI`) running the OpenCV/MediaPipe pipeline.
  2. Node.js Vite server hosting the React/Three.js frontend.
- **Academic Reporting Implication**: Do not describe the system as an unhosted, zero-install website; describe it as a web-native frontend with an edge vision companion microservice.

### 2.3 Topological Euler Characteristic Check Scope
- **Reality**: `SolidMesh.validateSolid()` evaluates:
  $$\chi = V - E + F = 2$$
- **Limitation**: This condition holds for orientable polyhedra homeomorphic to a 2-sphere (genus $g = 0$). For extrusions containing internal holes (genus $g \ge 1$), the generalized Poincaré formula $\chi = 2(1 - g)$ must be applied. The current codebase does not support profiles with interior holes (nested loops). This is documented as a known boundary limitation in Section 7.

### 2.4 Gesture Taxonomy Implemented in Code
`backend/tracking/gesture_recognizer.py` recognizes exactly five discrete states:
1. `IDLE`: Hand present, no specific constraint triggered.
2. `PINCH`: Thumb tip to index tip Euclidean distance ratio $< 0.48$.
3. `FIST`: Four fingers folded with extension ratio $< 0.85$.
4. `OPEN_PALM`: All fingers extended with ratio $> 1.35$.
5. `PEACE`: Index and middle fingers extended, ring and pinky folded.
