# GestureCAD Research Agent Execution Log

| Timestamp | Phase | Action / Task | Files Touched / Created | Outcome / Status |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-05 19:08 | Phase 0 | Directory structure creation | `/paper/`, `/evidence/`, `/evidence/raw/`, `/evidence/figures/`, `/evidence/scripts/`, `/study/` | SUCCESS |
| 2026-10-05 19:08 | Phase 0 | Environment detection & JSON logging | `/evidence/environment.json` | Recorded OS, CPU, RAM, GPU, Python, Node, Git commit |
| 2026-10-05 19:09 | Phase 0 | Agent log initialized | `/evidence/agent_log.md` | Active |
| 2026-10-05 19:12 | Phase 2 | Benchmark scripts execution | `/evidence/scripts/benchmark_*.mjs`, `benchmark_b6.py` | B1, B3, B4, B6, B9, B10, B11 benchmarks computed |
| 2026-10-05 19:15 | Phase 2 | JSON summary export | `/evidence/summary_*.json`, `summary_ablation.json` | All benchmarks and ablation results saved |
| 2026-10-05 19:17 | Phase 3 | User study protocol & kit | `/study/protocol.md`, `/study/tasks.md`, `/study/consent_form.md` | Formal 12-participant study design drafted |
| 2026-10-05 19:22 | Phase 3 | Questionnaires & analysis script | `/study/demographics_questionnaire.md`, `/study/post_task_questionnaire.md`, `/study/data_schema.csv`, `/study/analysis.py` | Complete reproducible study package |
| 2026-10-05 19:24 | Phase 4 | Claims ledger & related work | `/paper/claims_ledger.md`, `/paper/related_work_table.md`, `/paper/references.bib`, `/paper/open_items.md` | Traceable evidence matrix and 22+ bib entries |
| 2026-10-05 19:25 | Phase 4 | Full research paper manuscript | `/paper/gesturecad_paper.md`, `/paper/main.tex` | Initial manuscript drafts |
| 2026-10-05 19:35 | Phase 5 | Real landmark recording on host | `/evidence/scripts/record_real_landmarks.py`, `/evidence/raw/real_landmarks_session.json` | Captured 141 frames @ 26.68 FPS with real MediaPipe tracking |
| 2026-10-05 19:41 | Phase 5 | Sensitivity sweeps (6 noise levels x 30 seeds) | `/evidence/scripts/sweep_*.mjs`, `/evidence/summary_*_sweep.json` | B3 (52.4% CI), B4 (85.6% CI), B10 (100% to 92.1%), B11 (84.5% capture) |
| 2026-10-05 19:44 | Phase 5 | Provenance table creation | `/evidence/provenance_table.md` | Explicit REAL / SIMULATED / ANALYTIC / NOT RUN labeling |
| 2026-10-05 19:45 | Phase 5 | Claims ledger update | `/paper/claims_ledger.md` | Added Data Source / Provenance column; removed unverified estimates |
| 2026-10-05 19:45 | Phase 5 | Citation audit & correction | `/paper/references.bib`, `/paper/related_work_table.md` | Verified Vinayak et al. (CAD 2013) and all 22 bibliographic entries |
| 2026-10-05 19:46 | Phase 5 | Paper & TeX revisions | `/paper/gesturecad_paper.md`, `/paper/main.tex` | Removed 29ms/60FPS/camera-ready/underway claims; consolidated 3 contributions |
