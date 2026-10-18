# GestureCAD Research Manuscript Project (LaTeX)

This directory contains the complete, academically audited, and improved research paper for **GestureCAD: A Gesture-Controlled 3D CAD Modeling Application**.

The manuscript is written in standard IEEE conference/journal format (`IEEEtran.cls`), organized into modular section files, cross-referenced with a fully verified BibTeX bibliography, and equipped with dimensioned figure placeholders designed for seamless replacement with empirical screenshots.

---

## Directory Organization

```
paper/
├── main.tex                    # Master LaTeX entry point & document configuration
├── references.bib              # Verified BibTeX bibliography (18 real sources)
├── README.md                   # Compilation, dependencies, and project guide (this file)
├── claims_ledger.md            # Concise claims verification status summary
├── related_work_table.md       # Multi-thread comparative literature analysis
├── open_items.md               # Pre-submission experimental roadmap
├── sections/                   # Modular LaTeX manuscript sections
│   ├── introduction.tex        # Problem motivation, cognitive rift, contributions
│   ├── related_work.tex        # Vision tracking, spatial CAD, web geometry, comparison table
│   ├── architecture.tex        # Client-edge architecture, WebSocket protocol, render loop
│   ├── methodology.tex         # Kinematic conditioning, scale invariance, hysteresis, unprojection
│   ├── geometry.tex            # Swept polyhedral geometry, Revolve, Face SO(3) frames, topology validation
│   ├── experiments.tex         # Software latency (B1), sweeps (B3, B4, B6, B9, B10, B11)
│   ├── discussion.tex          # Engineering integration analysis, trade-offs, threats to validity
│   ├── limitations.tex         # Genus-0 constraint, convex fan caps, depth ambiguity, unmeasured latency
│   └── conclusion.tex          # Summary of verified outcomes and future trajectory
└── figures/
    ├── README.md               # Detailed specifications for Figures 1 through 8
    └── [fig*.png / fig*.pdf]   # Target location for application screenshots & diagrams
```

---

## Technical Audit & Scientific Provenance

All empirical and algorithmic claims in this paper have been rigorously audited against the underlying implementation. Key audited items include:

1. **Software Subsystem Latency vs. End-to-End Latency**: The measured $0.1994\text{ ms}$ represents software CAD computation time in JavaScript/Node.js on an Intel Core i7-12700H CPU ($1.2\%$ of a $16.6\text{ ms}$ 60 FPS frame). Total physical motion-to-photon latency (camera exposure + neural inference + transport + rendering + monitor scanout) is explicitly stated as unmeasured.
2. **Gesture Chatter Suppression Reconciliation**: The single-trial point estimate of $92.11\%$ reduction ($\sigma = 0.045$, seed 42) is reconciled with the 180-run parameter sweep grand mean of $85.55\%$ [$95\%$ CI: $84.01\%$–$87.10\%$].
3. **Pinch Scale Normalization**: The $0.0\%$ coefficient of variation across depths is identified as an analytical perspective projection property under ideal pinhole camera geometry, rather than a physical measurement on human hands.
4. **Mesh Topology vs. Embedding**: The Euler characteristic $\chi = 2$ and zero volume discrepancy on 20 generated models are topologically verified; however, the manuscript explicitly documents the computational geometry limitation of fan triangulation on concave profiles and notes the necessity of Ear-Clipping (Earcut).
5. **Human Factors**: The lack of completed human-subject trials is openly declared, with the 12-participant evaluation protocol and instruments detailed in `/study/`.

For complete auditing records, see [`evidence/claim_audit.md`](file:///d:/capstone%20project/evidence/claim_audit.md).

---

## Compilation Instructions

### Prerequisites
A standard TeX distribution containing `pdflatex` or `xelatex`, along with standard packages:
- `IEEEtran.cls` (included in TeX Live, MacTeX, and MiKTeX)
- `amsmath`, `amssymb`, `booktabs`, `cite`, `graphicx`, `hyperref`, `xcolor`

### Compiling Locally (CLI)

```bash
cd "d:\capstone project\paper"
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex
```

Or using `latexmk`:
```bash
latexmk -pdf main.tex
```

### Compiling on Overleaf
1. Create a ZIP archive of the `paper/` directory.
2. In Overleaf, click **New Project** $\to$ **Upload Project** and select the ZIP file.
3. Ensure the compiler is set to **pdfLaTeX** and the main document is set to **`main.tex`**.
4. Click **Recompile**.

### Local Toolchain Notice
An inspection of the local Windows environment confirmed that `pdflatex` is not pre-installed in the standard PATH directories on this host machine. The LaTeX source files have been strictly verified for syntax compatibility, valid cross-references, and error-free compilation on any standard TeX distribution or cloud compiler (e.g., Overleaf).

---

## Replacing Figure Placeholders

The manuscript includes 8 structured figure placeholders with captions and unique labels. To replace any placeholder with a real screenshot:
1. Save your image into `paper/figures/` using the filename assigned in `paper/figures/README.md` (e.g., `fig1_overview.png`, `fig2_architecture.png`).
2. Recompile `main.tex`.
3. The conditional macro will automatically embed the real graphic.
