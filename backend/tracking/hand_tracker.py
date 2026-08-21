import cv2
import mediapipe as mp

class HandTracker:
    def __init__(self, max_num_hands=1, min_detection_confidence=0.7, min_tracking_confidence=0.7):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            max_num_hands=max_num_hands,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence
        )

    def process_frame(self, frame):
        # Convert BGR to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        results = self.hands.process(rgb_frame)
        return results

    def extract_landmarks(self, results):
        if not results.multi_hand_landmarks:
            return None
        
        # We only care about the first hand for this prototype
        hand_landmarks = results.multi_hand_landmarks[0]
        
        # Extract normalized coordinates (x, y, z)
        landmarks = []
        for lm in hand_landmarks.landmark:
            landmarks.append({
                "x": lm.x,
                "y": lm.y,
                "z": lm.z
            })
        return landmarks
