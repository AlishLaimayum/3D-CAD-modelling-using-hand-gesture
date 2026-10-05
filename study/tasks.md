# GestureCAD Comparative User Study: Standardized Tasks

Each participant performs all 4 tasks under both conditions (GestureCAD vs. Mouse Baseline).

---

### Task T1: 2D Planar Profile Sketching
- **Objective**: Sketch a closed rectangular profile with dimensions approximately $4 \times 3\text{ units}$ on the primary working plane, utilizing snapping or rectangle tool.
- **Start Condition**: Blank workspace with default working plane.
- **Success Criteria**: Profile closed (indicated by green sketch status or watertight indicator), dimensions within $\pm 10\%$ of target.
- **Primary Metric**: Task Completion Time ($T_{\text{T1}}$ in seconds), count of retried strokes.

---

### Task T2: 3D Direct-Manipulation Extrusion
- **Objective**: Extrude the 2D profile from T1 to a target height of $h = 2.5\text{ units}$ along the normal axis.
- **Start Condition**: Completed closed 2D profile selected in workspace.
- **Method in GestureCAD**: Engage Z-Hold mode, pinch and move hand upwards to target height indicator ($h = 2.5$), release pinch.
- **Method in Baseline**: Select extrude handle / type depth box and enter 2.5.
- **Success Criteria**: Solid extruded, watertight status verified ($\chi = 2$), height within $\pm 0.2\text{ units}$ of target.
- **Primary Metric**: Task Completion Time ($T_{\text{T2}}$ in seconds), height deviation $|h - 2.5|$.

---

### Task T3: Multi-Feature Part Construction from Drawing
- **Objective**: Construct a stepped bracket part consisting of:
  1. A base rectangular block ($4 \times 4\times 1\text{ units}$).
  2. A secondary cylindrical boss ($r = 1.0\text{ unit}$, height $h = 2.0\text{ units}$) placed on the base.
- **Start Condition**: Blank workspace.
- **Success Criteria**: Both primitives present, cylinder correctly positioned on base, non-intersecting manifold topology.
- **Primary Metric**: Total Task Time ($T_{\text{T3}}$ in seconds), number of corrective undo operations.

---

### Task T4: Face Selection & Attached Sketching
- **Objective**: 
  1. Select the top planar face of the cylindrical boss created in T3.
  2. Activate the face-attached sketching plane.
  3. Draw a concentric circle ($r \approx 0.5\text{ units}$) on that top face.
  4. Extrude it upwards by $h = 1.0\text{ unit}$.
- **Start Condition**: 3D cylinder solid visible in workspace.
- **Method in GestureCAD**: Click cylinder top face directly in 3D viewport (or select 'Top' in SURFACE SELECTION panel), verify teal highlight, select Circle tool, sketch on face, Z-hold extrude.
- **Success Criteria**: New circular extrusion created coincident with the cylinder top face, correctly oriented along the face normal.
- **Primary Metric**: Task Completion Time ($T_{\text{T4}}$ in seconds), face selection latency, orientation errors.
