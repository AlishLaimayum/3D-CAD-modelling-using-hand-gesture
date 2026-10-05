"""
Real Landmark Recording Tool for GestureCAD
Connects to local monocular RGB camera (index 0), runs MediaPipe HandTracker,
computes scale-invariant metrics, and saves raw timestamped telemetry to JSON.
"""

import os
import sys
import time
import json
import cv2
import numpy as np

# Ensure backend modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))
from tracking.hand_tracker import HandTracker
from tracking.gesture_recognizer import GestureRecognizer

def record_real_session(duration_seconds=5.0, camera_index=0, output_path=None):
    if output_path is None:
        output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "raw", "real_landmarks_session.json"))
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print(f"Initializing OpenCV VideoCapture({camera_index})...")
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open camera {camera_index}")
        
    tracker = HandTracker(max_num_hands=1, min_detection_confidence=0.5, min_tracking_confidence=0.5)
    recognizer = GestureRecognizer()
    
    frames_recorded = []
    start_time = time.time()
    frame_count = 0
    hand_detected_count = 0
    
    print(f"Starting real capture for {duration_seconds} seconds. Processing stream from camera {camera_index}...")
    
    try:
        while (time.time() - start_time) < duration_seconds:
            ret, frame = cap.read()
            if not ret:
                time.sleep(0.01)
                continue
                
            frame_ts = time.time() - start_time
            frame_count += 1
            
            # Run MediaPipe hand tracking using the actual HandTracker pipeline
            results = tracker.process_frame(frame)
            landmarks = tracker.extract_landmarks(results)
            hand_present = (landmarks is not None and len(landmarks) == 21)
            
            frame_entry = {
                "frame_id": frame_count,
                "timestamp_sec": round(frame_ts, 4),
                "hand_detected": hand_present
            }
            
            if hand_present:
                hand_detected_count += 1
                
                # Compute gesture metrics using GestureRecognizer
                recognition_result = recognizer.recognize(landmarks)
                
                # Wrist to MCP distance (landmarks 0 and 9)
                wrist = np.array([landmarks[0]["x"], landmarks[0]["y"], landmarks[0]["z"]])
                mcp = np.array([landmarks[9]["x"], landmarks[9]["y"], landmarks[9]["z"]])
                s_hand = float(np.linalg.norm(mcp - wrist))
                
                # Thumb to Index distance (landmarks 4 and 8)
                thumb = np.array([landmarks[4]["x"], landmarks[4]["y"], landmarks[4]["z"]])
                index = np.array([landmarks[8]["x"], landmarks[8]["y"], landmarks[8]["z"]])
                raw_pinch_dist = float(np.linalg.norm(index - thumb))
                
                frame_entry["landmarks"] = landmarks
                frame_entry["state"] = recognition_result.get("state")
                frame_entry["pinch_ratio"] = round(float(recognition_result.get("pinch_ratio", 0)), 4)
                frame_entry["s_hand_wrist_mcp"] = round(s_hand, 4)
                frame_entry["raw_pinch_dist"] = round(raw_pinch_dist, 4)
                frame_entry["cursor"] = recognition_result.get("cursor")
                
            frames_recorded.append(frame_entry)
            
    finally:
        cap.release()
        
    actual_duration = time.time() - start_time
    actual_fps = frame_count / actual_duration if actual_duration > 0 else 0
    
    session_summary = {
        "metadata": {
            "source": "REAL_WEBCAM_CAPTURE",
            "camera_index": camera_index,
            "duration_sec": round(actual_duration, 2),
            "total_frames": frame_count,
            "mean_fps": round(actual_fps, 2),
            "hand_detected_frames": hand_detected_count,
            "detection_rate_pct": round((hand_detected_count / frame_count * 100) if frame_count > 0 else 0, 2)
        },
        "frames": frames_recorded
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(session_summary, f, indent=2)
        
    print(f"Captured {frame_count} frames ({hand_detected_count} with hand detected) at {actual_fps:.1f} FPS.")
    print(f"Saved real session data to: {output_path}")
    return session_summary

if __name__ == "__main__":
    dur = float(sys.argv[1]) if len(sys.argv) > 1 else 5.0
    cam = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    record_real_session(duration_seconds=dur, camera_index=cam)
