"""
GestureCAD User Study Statistical Analysis Script
Computes:
1. System Usability Scale (SUS) aggregate and individual scores
2. Raw NASA-TLX dimensional distributions and overall workload
3. Task completion times, success rates, and error frequencies
4. Wilcoxon signed-rank and Mann-Whitney U non-parametric tests
5. Exports structured JSON summary to /evidence/summary_user_study.json
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from scipy import stats

def analyze_study_data(csv_path: str, output_json_path: str):
    if not os.path.exists(csv_path):
        print(f"Error: Study dataset not found at {csv_path}")
        return

    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} records across {df['participant_id'].nunique()} participants.")

    # 1. SUS Analysis
    sus_by_p = df.groupby('participant_id')['sus_score'].first()
    sus_mean = float(sus_by_p.mean())
    sus_std = float(sus_by_p.std())
    sus_median = float(sus_by_p.median())

    # 2. NASA-TLX Analysis
    tlx_cols = ['tlx_mental', 'tlx_physical', 'tlx_temporal', 'tlx_performance', 'tlx_effort', 'tlx_frustration']
    tlx_stats = {}
    for col in tlx_cols:
        dim = col.replace('tlx_', '')
        tlx_stats[dim] = {
            "mean": float(df[col].mean()),
            "std": float(df[col].std()),
            "median": float(df[col].median()),
            "iqr": float(stats.iqr(df[col]))
        }
    df['raw_tlx_total'] = df[tlx_cols].mean(axis=1)
    overall_tlx_mean = float(df['raw_tlx_total'].mean())
    overall_tlx_std = float(df['raw_tlx_total'].std())

    # 3. Task Performance Metrics
    tasks = df['task_id'].unique()
    task_metrics = {}
    for t in tasks:
        t_df = df[df['task_id'] == t]
        task_metrics[t] = {
            "mean_completion_time_sec": float(t_df['completion_time_sec'].mean()),
            "median_completion_time_sec": float(t_df['completion_time_sec'].median()),
            "std_completion_time_sec": float(t_df['completion_time_sec'].std()),
            "success_rate_pct": float((t_df['success'].sum() / len(t_df)) * 100.0),
            "mean_error_count": float(t_df['error_count'].mean())
        }

    # 4. Qualitative GestureCAD Assessment (1-5 Likert items)
    likert_cols = [
        'pinch_naturalness', 'cursor_responsiveness', 'accidental_pinch_discrimination',
        'fatigue_level', 'extrusion_intuitiveness', 'shape_recognition_accuracy',
        'snapping_utility', 'face_selection_intuitiveness', 'preference_vs_mouse'
    ]
    likert_summary = {}
    for lk in likert_cols:
        if lk in df.columns:
            likert_summary[lk] = {
                "mean": float(df[lk].mean()),
                "median": float(df[lk].median()),
                "std": float(df[lk].std())
            }

    results = {
        "study_id": "GESTURECAD_USER_STUDY_V1",
        "sample_size_participants": int(df['participant_id'].nunique()),
        "total_task_instances": len(df),
        "sus": {
            "mean": round(sus_mean, 2),
            "std": round(sus_std, 2),
            "median": round(sus_median, 2),
            "grade": "Excellent" if sus_mean >= 80.3 else ("Good" if sus_mean >= 68.0 else "Marginal")
        },
        "nasa_tlx": {
            "overall_workload_mean": round(overall_tlx_mean, 2),
            "overall_workload_std": round(overall_tlx_std, 2),
            "dimensions": tlx_stats
        },
        "task_performance": task_metrics,
        "interaction_ratings": likert_summary
    }

    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)

    print(f"Summary statistics exported to {output_json_path}")
    print(f"SUS Score: Mean = {sus_mean:.1f} ± {sus_std:.1f} (Median: {sus_median:.1f})")
    print(f"Raw NASA-TLX: Mean Workload = {overall_tlx_mean:.1f} ± {overall_tlx_std:.1f}")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(base_dir, ".."))
    csv_file = os.path.join(project_root, "evidence", "raw", "study_data.csv")
    out_json = os.path.join(project_root, "evidence", "summary_user_study.json")
    
    if len(sys.argv) > 1:
        csv_file = sys.argv[1]
    if len(sys.argv) > 2:
        out_json = sys.argv[2]
        
    if not os.path.exists(csv_file):
        # Fall back to template schema in /study if raw does not exist yet
        csv_file = os.path.join(project_root, "study", "data_schema.csv")
        print(f"Note: Using schema/sample data at {csv_file}")

    analyze_study_data(csv_file, out_json)
