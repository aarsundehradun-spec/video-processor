import cv2
from typing import Tuple, Optional, Dict, Any
from .base_tracker import BaseTracker
from .tracker_registry import TrackerRegistry

@TrackerRegistry.register("MOSSE")
class MOSSETracker(BaseTracker):
    def __init__(self):
        # cv2.TrackerMOSSE_create() is in opencv-contrib-python or older versions
        # We use a fallback if not available, or assume it's available.
        if hasattr(cv2, 'legacy') and hasattr(cv2.legacy, 'TrackerMOSSE_create'):
            self.tracker = cv2.legacy.TrackerMOSSE_create()
        elif hasattr(cv2, 'TrackerMOSSE_create'):
            self.tracker = cv2.TrackerMOSSE_create()
        else:
            # Fallback to CSRT if MOSSE is entirely unavailable in this cv2 build
            self.tracker = cv2.TrackerCSRT_create()
        
    @classmethod
    def capabilities(cls) -> Dict[str, Any]:
        return {
            "name": "MOSSE",
            "supportsScale": False,
            "supportsRotation": False,
            "speed": "fast",
            "accuracy": "low"
        }

    def initialize(self, frame, bbox: Tuple[int, int, int, int]) -> bool:
        return self.tracker.init(frame, bbox)

    def update(self, frame) -> Tuple[bool, Optional[Tuple[int, int, int, int]]]:
        success, bbox = self.tracker.update(frame)
        if success:
            x, y, w, h = [int(v) for v in bbox]
            return True, (x, y, w, h)
        return False, None
