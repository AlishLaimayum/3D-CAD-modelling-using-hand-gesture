# GestureCAD Comparative User Study: Protocol Specification

## 1. Study Overview
- **Design**: Within-subjects, counterbalanced $2 \times 4$ factorial design.
- **Conditions**:
  1. **Condition A (GestureCAD)**: Contactless monocular hand gesture interaction.
  2. **Condition B (Mouse Baseline - e.g., Autodesk Tinkercad / Web CAD)**: Standard 2D mouse and keyboard shortcuts.
- **Target Sample Size**: $N = 16$ participants (minimum 12, target 16–20), balanced across gender and prior 3D CAD experience.
- **Counterbalancing**: Latin Square or AB/BA alternation across participant IDs (odd IDs start with GestureCAD, even IDs start with Mouse baseline).

---

## 2. Experimental Apparatus
- **Host Workstation**: Windows 11 / macOS / Linux with Intel Core i7 / AMD Ryzen 7, $\ge 16\text{ GB}$ RAM, dedicated or integrated GPU.
- **Display**: 24-inch or 27-inch 1080p / 1440p monitor at eye level.
- **Webcam**: Standard USB / integrated 720p 30 FPS webcam placed on top of display facing participant.
- **Input Peripherals**: Standard optical 3-button mouse with scroll wheel, QWERTY keyboard.
- **Lighting**: Standard indoor office illumination ($\approx 300 - 500\text{ lux}$), avoiding direct backlight glare.

---

## 3. Session Procedure (Estimated Duration: 45–60 minutes)

1. **Phase 1: Welcome & Informed Consent (5 min)**
   - Participant receives briefing, reads and signs `consent_form.md`.
   - Complete `demographics_questionnaire.md` (age, handedness, 3D gaming/CAD familiarity).

2. **Phase 2: Training & Calibration (10 min)**
   - **GestureCAD Training**: Demonstration of Open Palm (plane rotation), Fist (plane lock), Pinch (pen down), Z-Hold (extrusion), and Face Selection.
   - 5-minute freeform sandbox drafting session until participant successfully completes 1 rectangle and 1 extrusion.
   - **Baseline Training**: 3-minute orientation to the mouse baseline tool.

3. **Phase 3: Formal Experimental Tasks (20–25 min)**
   - Participant performs Tasks T1 through T4 in Condition 1.
   - 3-minute mandatory arm rest.
   - Participant performs Tasks T1 through T4 in Condition 2.
   - Timers recorded automatically or via stopwatch. Errors (mis-pinches, accidental deletions) logged by evaluator.

4. **Phase 4: Subjective Questionnaires (10 min)**
   - System Usability Scale (SUS, 10 items) for each condition.
   - NASA Task Load Index (NASA-TLX, 6 raw subscales: Mental, Physical, Temporal, Performance, Effort, Frustration).
   - Borg CR10 Arm Fatigue Scale (0–10 scale rating perceived exertion).
   - Semi-structured qualitative exit interview.
