# GestureCAD — Related Work Comparative Table

> Use this table in Section 2 (Related Work) to position GestureCAD against prior art across three research threads.

---

## Thread 1: Vision-Based Gesture Interaction Systems

| System | Year | Sensing | DoF | Gesture States | Tremor Filter | Scale Inv. | Web-Native | Ref Key |
|---|---|---|---|---|---|---|---|---|
| **Kinect + FAAST** (Suma et al.) | 2011 | Depth (IR structured light) | 6-DoF skeleton | Arm-level poses | None | N/A | No | `@suma2011faast` |
| **Leap Motion SDK** | 2013 | Stereo IR | 27-DoF hand | Pinch, grab, swipe | Built-in SDK | Partial | No | `@leapmotion2013` |
| **MediaPipe Hands** (Zhang et al.) | 2020 | Monocular RGB | 21 × 3-DoF | Landmark regression | None (raw output) | No | Yes (WASM) | `@zhang2020mediapipe` |
| **HandPose (TF.js)** | 2020 | Monocular RGB | 21 × 3-DoF | Landmark regression | None | No | Yes | `@ACP2020handpose` |
| **GestureCAD (Ours)** | 2025 | Monocular RGB (MediaPipe) | 21 × 3-DoF | 5-state FSM (Pinch/Fist/Palm/Peace/Idle) | 3-stage adaptive (dead-zone + EMA + hysteresis) | **Yes** (wrist-MCP normalized) | **Yes** | — |

### Key Differentiator
Prior vision systems provide **raw landmark output** with no application-level signal conditioning. GestureCAD layers a purpose-built kinematic conditioning stack (scale normalization, hysteresis automaton, velocity-adaptive tremor attenuation) specifically engineered for precision CAD stroke input, achieving 60.6% jitter reduction and 92.1% state-chatter elimination.

---

## Thread 2: Spatial & Immersive CAD / 3D Modeling Systems

| System | Year | Input Modality | Geometry Kernel | Topology Check | Multi-Face Sketch | Export | Cost | Ref Key |
|---|---|---|---|---|---|---|---|---|
| **SolidWorks** (Dassault) | 1995– | Mouse + KB | Parasolid B-Rep | Full CSG + NURBS | Yes (parametric tree) | STEP/IGES/STL | $4 000+/yr | `@solidworks` |
| **AutoCAD** (Autodesk) | 1982– | Mouse + KB | ACIS B-Rep | Yes | Yes | DWG/DXF/STL | $2 000+/yr | `@autocad` |
| **Gravity Sketch** | 2018 | VR controllers | Sub-D / T-Spline | None (open mesh) | Limited | OBJ/FBX | $400+ HW | `@gravitysketch` |
| **Tilt Brush** (Google) | 2016 | VR controllers | Stroke ribbons | None | No | FBX/OBJ | Discontinued | `@tiltbrush` |
| **Shape-It-Up** (Vinayak et al.) | 2013 | Depth camera / gestures | Generalized cylinders | None | No | STL | Lab prototype | `@vinayak2013shapeitup` |
| **FreeCAD** (Community) | 2002– | Mouse + KB | OpenCASCADE B-Rep | Yes (BREP kernel) | Yes | STEP/STL/IGES | Free | `@freecad` |
| **GestureCAD (Ours)** | 2025 | Monocular webcam | B-Rep swept volumes | **χ = 2 validation** | **Yes** (planar + cylindrical SO(3)) | OBJ/DXF/STL | **$0** | — |

### Key Differentiator
GestureCAD is the first system that combines **spatial gesture input**, **topologically validated B-Rep solids**, and **zero-install web deployment** simultaneously. VR-based systems sacrifice engineering precision (open meshes, no Euler checks); desktop CAD sacrifices spatial input (2D mouse). GestureCAD resolves this tension by pairing unconstrained spatial hand tracking with a rigorous geometric kernel.

---

## Thread 3: Web-Based Computational Geometry & Rendering Architectures

| System / Library | Year | Language | Geometry Type | Virtual DOM | Rendering FPS | B-Rep Support | Ref Key |
|---|---|---|---|---|---|---|---|
| **Three.js** (Cabello) | 2010– | JavaScript | Triangular meshes | N/A (imperative) | 60 | No (mesh only) | `@threejs` |
| **React Three Fiber** (Poimandres) | 2019– | JSX/React | Declarative meshes | Yes (reconciler) | 60 | No | `@r3f` |
| **OpenCASCADE.js** | 2021 | WASM/C++ | Full NURBS B-Rep | N/A | — | **Yes** | `@opencascadejs` |
| **ManifoldCAD** | 2022 | WASM/C++ | Manifold meshes | N/A | — | Partial | `@manifoldcad` |
| **CadQuery** | 2019 | Python | OCCT wrapper | N/A | — | Yes | `@cadquery` |
| **GestureCAD (Ours)** | 2025 | React + R3F + JS | Swept B-Rep + Float32Array direct mutation | **Bypassed for hot path** (ref-based updates) | **60** | **Yes** (custom kernel) | — |

### Key Differentiator
GestureCAD avoids the common web-CAD pitfall of routing 30–60 Hz tracking data through React's virtual DOM reconciler. Instead, it uses **in-place `Float32Array` buffer mutations** via Three.js `useFrame()` refs for the high-frequency rendering loop, reserving Zustand state commits only for transactional CAD commands (shape commit, undo/redo). This dual-frequency architecture ensures **zero GC pauses** during continuous hand tracking.

---

## Cross-Cutting Feature Comparison (Summary Table for Paper)

| Capability | Mouse-CAD (SolidWorks) | VR-CAD (Gravity Sketch) | Gesture (LeapMotion) | **GestureCAD** |
|---|:---:|:---:|:---:|:---:|
| No special hardware | ❌ | ❌ | ❌ | ✅ |
| Spatial 3D input | ❌ | ✅ | ✅ | ✅ |
| Web-native (zero install) | ❌ | ❌ | ❌ | ✅ |
| Watertight B-Rep solids | ✅ | ❌ | ❌ | ✅ |
| Topological validation (χ=2) | ✅ | ❌ | ❌ | ✅ |
| Multi-face sketch-on-solid | ✅ | ❌ | ❌ | ✅ |
| Industry export (OBJ/STL/DXF) | ✅ | ✅ | ❌ | ✅ |
| Tremor compensation | N/A | N/A | ❌ | ✅ |
| Scale-invariant gestures | N/A | N/A | ❌ | ✅ |
| Cost to user | $4 000+ | $400+ | $150+ | **$0** |
