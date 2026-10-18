# GestureCAD: Figure Specifications & Replacement Guide

This directory holds the figures for the GestureCAD IEEE research paper (`paper/main.tex`).

The LaTeX manuscript uses a conditional loading macro:
- **If the image file exists in this directory**, LaTeX automatically includes the image via `\includegraphics`.
- **If the image file is missing**, LaTeX automatically compiles a formatted, dimensioned placeholder box with the planned figure caption and label.

---

## Required Figures Inventory

| Figure ID | Planned Filename | Recommended Format & Aspect Ratio | Purpose & Content Description | LaTeX Reference Label |
|---|---|:---:|---|---|
| **Figure 1** | `fig1_overview.png` | PNG / PDF, 16:9 or 4:3 | **Application Overview**: High-resolution screenshot of the GestureCAD user interface showing the 3D WebGL viewport, active grid plane, current drawing stroke, gesture status indicator (Pinch/Idle/Fist), and command toolbar. | `\label{fig:overview}` |
| **Figure 2** | `fig2_architecture.png` | Vector PDF / High-DPI PNG, 16:9 | **System Architecture**: Block diagram illustrating the decoupled client-edge architecture: Webcam $\to$ OpenCV capture $\to$ MediaPipe Hands inference $\to$ Kinematic conditioning $\to$ WebSocket JSON stream $\to$ Three.js typed array rendering loop + Zustand CAD state dispatcher. | `\label{fig:architecture}` |
| **Figure 3** | `fig3_fsm_workflow.png` | Vector PDF / PNG, 3:2 | **Gesture Interaction Workflow**: State transition diagram / flowchart showing the 5-state automaton (`IDLE`, `OPEN_PALM`, `FIST`, `PINCH`, `PEACE`), the hysteresis boundary thresholds ($\tau_{\text{start}}=0.44$, $\tau_{\text{release}}=0.54$), frame debouncing, and gesture-to-CAD command mapping. | `\label{fig:gesture_workflow}` |
| **Figure 4** | `fig4_working_planes.png` | PNG / PDF, 16:9 | **Working Planes and Coordinate Systems**: Viewport composite showing the three principal coordinate working planes ($XY$, $YZ$, $XZ$), the plane-rotation controller widget, and perspective unprojection from 2D screen coordinates to 3D plane coordinates. | `\label{fig:working_planes}` |
| **Figure 5** | `fig5_sketch_to_solid.png` | PNG / PDF, 16:5 (horizontal strip) | **Sketch-to-Solid Pipeline**: Step-by-step sequential visual progression: (a) 2D planar profile sketching with vertex snapping; (b) Counter-clockwise winding orientation and closure detection; (c) Direct-manipulation linear extrusion along normal vector into a 3D solid; (d) Rotational sweeping (Revolve) around an axis with seamless seam stitching. | `\label{fig:sketch_to_solid}` |
| **Figure 6** | `fig6_mesh_validation.png` | PNG / PDF, 16:9 | **Geometry & Topology Validation**: Detailed view of a generated solid mesh showing the triangulated surface, wireframe edges, outward-pointing face normal arrows, and the validation panel verifying Euler characteristic $\chi = 2$, zero boundary edges, and exact Divergence Theorem volume. | `\label{fig:mesh_validation}` |
| **Figure 7** | `fig7_sketch_on_face.png` | PNG / PDF, 16:9 | **Multi-Surface Sketching Workflow**: Viewport demonstration of the face-attachment pipeline: user raycasts onto an existing polyhedron face or cylindrical tangent point $\to$ local orthonormal basis $\mathbf{R} \in SO(3)$ is dynamically constructed $\to$ a new sketch plane is aligned with the face $\to$ a secondary extruded boss or cylinder is constructed directly on the surface. | `\label{fig:sketch_on_face}` |
| **Figure 8** | `fig8_experimental_results.png` | Vector PDF / High-DPI PNG, 16:9 (dual-panel plot) | **Experimental Benchmark Results**: Two-panel benchmark visualization generated from reproducible sweeps: (a) RMS cursor jitter attenuation across varying noise levels ($\sigma = 1.0$ to $6.0\text{ mm}$), comparing raw vs. filtered trajectory; (b) Hysteresis state-transition chatter suppression across decision-boundary noise levels ($\sigma = 0.015$ to $0.090$). | `\label{fig:experimental_results}` |

---

## Instructions for Adding Images

1. Save or export your screenshot/diagram as a `.png` or `.pdf` file.
2. Place the file inside this directory (`paper/figures/`) using the exact filename specified above (e.g., `fig1_overview.png`).
3. Recompile `paper/main.tex` using `pdflatex main.tex` (or upload the `paper/` folder to Overleaf).
4. LaTeX will automatically replace the placeholder box with your actual figure.
