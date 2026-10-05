# GestureCAD — Open Items & Remaining Work

> Items that must be completed before the paper is submission-ready.

---

## 🔴 BLOCKING (Paper cannot be submitted without these)

### OI-01: Physical End-to-End Latency Measurement (B2)
- **What**: Measure actual motion-to-photon latency by physical observation (e.g., high-speed camera recording LED trigger → screen update, or Chrome DevTools performance timeline).
- **Why**: CL-16 claims < 30 ms total latency. The software sub-stages (B1) are verified at ~0.2 ms, but the full chain (webcam capture + MediaPipe inference + WS transport + render) needs an empirical timing.
- **Method options**:
  1. **DevTools approach**: Open Chrome Performance tab → record 5-second interaction → export JSON → compute mean frame time.
  2. **Instrumented timestamps**: Add `performance.now()` logging in `useGestureInteraction.js` at message receive → stroke render → compute delta.
  3. **Physical camera approach** (gold standard): Record screen + hand simultaneously with 240 FPS phone camera → count frames between hand movement and screen update.
- **Owner**: Human user
- **Evidence file to produce**: `/evidence/summary_b2_e2e_latency.json`

### OI-02: User Study Execution
- **What**: Run the 12-participant study per the protocol in `/study/protocol.md`.
- **Why**: Claims CL-18 through CL-21 (SUS, NASA-TLX, task time, satisfaction) are currently `[PENDING-STUDY]`.
- **Materials ready**: ✅ `protocol.md`, `tasks.md`, `consent_form.md`, `demographics_questionnaire.md`, `post_task_questionnaire.md`
- **Owner**: Human user
- **Evidence files to produce**: `/evidence/raw/study_data.csv`, `/evidence/summary_user_study.json`

---

## ⚠️ IMPORTANT (Significantly strengthens the paper)

### OI-03: 60 FPS Rendering Verification (CL-17)
- **What**: Capture a Chrome DevTools Performance trace showing sustained 60 FPS during active hand tracking.
- **Method**: `Performance` tab → Record 10 s of active drawing → export → check frame timing.
- **Evidence file**: `/evidence/summary_fps_trace.json`

### OI-04: Real Hand-Drawn Shape Recognition Accuracy
- **What**: B10 used clean synthetic strokes (100% accuracy). Paper should acknowledge this and optionally test with real noisy hand-drawn strokes.
- **Method**: Record 50 real hand-drawn shapes via the system → compare recognized vs. intended → report accuracy.
- **Evidence file**: `/evidence/summary_b10_real_strokes.json`

### OI-05: Video Demo Recording
- **What**: Create a 2–3 minute narrated screen recording demonstrating all three workflows:
  - Workflow A: 2D sketching with snapping
  - Workflow B: Z-Hold extrusion
  - Workflow C: Face selection → sketch-on-face
- **Why**: Required for UIST/CHI/SIGGRAPH supplementary material.
- **Owner**: Human user

---

## 🟡 NICE-TO-HAVE (Polish & completeness)

### OI-06: Statistical Significance Tests for User Study
- Once study data is collected, run Wilcoxon signed-rank tests (paired) or Mann-Whitney U tests (independent) with Bonferroni correction.
- Script ready: `/study/analysis.py` (will be created with OI-02 data).

### OI-07: Multi-User / Multi-Hand Support Discussion
- Currently limited to `max_num_hands=1`. Discuss future work extension to two-hand bimanual interaction.

### OI-08: Depth Ambiguity Limitation Analysis
- Quantify the monocular depth estimation error at various camera distances and hand tilt angles.
- Relevant for the Limitations section.

### OI-09: CSG Boolean Operations (Future Work)
- Discuss the extension to Union/Difference/Intersection via BSP tree decomposition.
- Reference ManifoldCAD and OpenCASCADE.js as potential integration targets.

---

## Checklist for Final Paper Compilation

- [ ] OI-01: B2 latency measurement completed
- [ ] OI-02: User study executed, data collected
- [ ] OI-03: 60 FPS trace captured
- [ ] OI-04: Real stroke accuracy tested (optional)
- [ ] OI-05: Video demo recorded
- [ ] All `[TODO-MEASURE]` and `[TODO-STUDY]` tags resolved in claims ledger
- [ ] `references.bib` finalized (all cited works present)
- [ ] Paper compiled (LaTeX or Word) from `RESEARCH_README.md` structure
- [ ] Figures generated (architecture diagram, ablation bar chart, latency breakdown)
- [ ] Supplementary materials packaged (code, data, video)
