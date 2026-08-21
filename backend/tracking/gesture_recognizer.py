import math


class GestureState:
    IDLE = "IDLE"
    OPEN_PALM = "OPEN_PALM"
    FIST = "FIST"
    PINCH = "PINCH"


class GestureRecognizer:
    def __init__(self):
        # Gesture thresholds
        self.pinch_threshold = 0.48
        self.extended_threshold = 1.35
        self.folded_threshold = 0.85

        self.state = GestureState.IDLE
        self.locked = False

        # Cursor smoothing
        self.prev_x = None
        self.prev_y = None
        self.alpha = 0.5

        # Pinch stability
        self.pinch_frames = 0
        self.unpinch_frames = 0

        # Fist stability
        self.fist_frames = 0
        self.last_fist_action = False

        self.pinch_start_frames = 1
        self.unpinch_frames_required = 2
        self.fist_frames_required = 5

    def distance_2d(self, p1, p2):
        return math.sqrt(
            (p1["x"] - p2["x"]) ** 2 +
            (p1["y"] - p2["y"]) ** 2
        )

    def recognize(self, landmarks):

        if not landmarks:
            self.state = GestureState.IDLE
            self.pinch_frames = 0
            self.unpinch_frames = 0
            self.fist_frames = 0

            return {
                "state": self.state,
                "locked": self.locked,
                "cursor": None,
                "swipe": None
            }

        # ------------------------------------------------
        # LANDMARKS
        # ------------------------------------------------

        wrist = landmarks[0]

        thumb_tip = landmarks[4]
        index_tip = landmarks[8]
        middle_tip = landmarks[12]
        ring_tip = landmarks[16]
        pinky_tip = landmarks[20]

        # ------------------------------------------------
        # HAND SIZE
        # ------------------------------------------------

        hand_size = self.distance_2d(
            wrist,
            landmarks[9]
        )

        if hand_size < 0.001:
            hand_size = 0.001

        # ------------------------------------------------
        # PINCH
        # ------------------------------------------------

        pinch_distance = self.distance_2d(
            thumb_tip,
            index_tip
        )

        pinch_ratio = pinch_distance / hand_size

        raw_pinch = pinch_ratio < self.pinch_threshold

        # ------------------------------------------------
        # FINGER EXTENSION
        # ------------------------------------------------

        index_ratio = (
            self.distance_2d(index_tip, wrist)
            / hand_size
        )

        middle_ratio = (
            self.distance_2d(middle_tip, wrist)
            / hand_size
        )

        ring_ratio = (
            self.distance_2d(ring_tip, wrist)
            / hand_size
        )

        pinky_ratio = (
            self.distance_2d(pinky_tip, wrist)
            / hand_size
        )

        # ------------------------------------------------
        # FIST
        # ------------------------------------------------

        raw_fist = (
            index_ratio < self.folded_threshold
            and middle_ratio < self.folded_threshold
            and ring_ratio < self.folded_threshold
            and pinky_ratio < self.folded_threshold
        )

        # ------------------------------------------------
        # OPEN PALM
        # ------------------------------------------------

        is_open_palm = (
            index_ratio > self.extended_threshold
            and middle_ratio > self.extended_threshold
            and ring_ratio > self.extended_threshold
            and pinky_ratio > self.extended_threshold
        )

        # ------------------------------------------------
        # STABLE FIST
        # ------------------------------------------------

        if raw_fist:
            self.fist_frames += 1
        else:
            self.fist_frames = 0
            self.last_fist_action = False

        stable_fist = (
            self.fist_frames >= self.fist_frames_required
        )

        # Only toggle once for each fist gesture
        if stable_fist and not self.last_fist_action:
            self.locked = not self.locked
            self.last_fist_action = True

        # ------------------------------------------------
        # STABLE PINCH
        # ------------------------------------------------

        if raw_pinch:
            self.pinch_frames += 1
            self.unpinch_frames = 0
        else:
            self.unpinch_frames += 1
            self.pinch_frames = 0

        stable_pinch = (
            self.pinch_frames >= self.pinch_start_frames
        )

        stable_unpinch = (
            self.unpinch_frames >= self.unpinch_frames_required
        )

        # ------------------------------------------------
        # CURSOR WITH JITTER FILTERING
        # ------------------------------------------------

        raw_x = (
            thumb_tip["x"] +
            index_tip["x"]
        ) / 2

        raw_y = (
            thumb_tip["y"] +
            index_tip["y"]
        ) / 2

        if self.prev_x is None:
            cursor_x = raw_x
            cursor_y = raw_y
        else:
            # Micro-jitter deadzone filter (ignore tiny hand tremors < 0.003)
            dist_sq = (raw_x - self.prev_x) ** 2 + (raw_y - self.prev_y) ** 2
            if dist_sq < 0.00001:  # ~0.003 squared
                cursor_x = self.prev_x
                cursor_y = self.prev_y
            else:
                alpha = 0.18  # Smooth 82% past frame, 18% new frame
                cursor_x = alpha * raw_x + (1 - alpha) * self.prev_x
                cursor_y = alpha * raw_y + (1 - alpha) * self.prev_y

        self.prev_x = cursor_x
        self.prev_y = cursor_y

        # ------------------------------------------------
        # SWIPE
        # ------------------------------------------------

        swipe = None

        if is_open_palm:
            hand_center = landmarks[9]

            swipe = {
                "x": hand_center["x"],
                "y": hand_center["y"]
            }

        # ------------------------------------------------
        # STATE
        # ------------------------------------------------

        if stable_pinch:
            if self.locked:
                self.state = GestureState.PINCH
            else:
                self.state = GestureState.IDLE

        elif stable_fist:
            self.state = GestureState.FIST

        elif is_open_palm:
            self.state = GestureState.OPEN_PALM

        elif stable_unpinch:
            self.state = GestureState.IDLE

        return {
            "state": self.state,
            "locked": self.locked,
            "cursor": {
                "x": cursor_x,
                "y": cursor_y
            },
            "swipe": swipe,
            "pinch_ratio": pinch_ratio
        }