import cv2
from typing import Tuple, Optional, Dict, Any
from .base_tracker import BaseTracker
from .tracker_registry import TrackerRegistry

@TrackerRegistry.register("CSRT")
class CSRTTracker(BaseTracker):
    def __init__(self):
        self.tracker = cv2.TrackerCSRT_create()
        
    @classmethod
    def capabilities(cls) -> Dict[str, Any]:
        return {
            "name": "CSRT",
            "supportsScale": True,
            "supportsRotation": False,
            "speed": "medium",
            "accuracy": "high"
        }

    def initialize(self, frame, bbox: Tuple[int, int, int, int]) -> bool:
        return self.tracker.init(frame, bbox)

    def update(self, frame) -> Tuple[bool, Optional[Tuple[int, int, int, int]]]:
        success, bbox = self.tracker.update(frame)
        if success:
            x, y, w, h = [int(v) for v in bbox]
            return True, (x, y, w, h)
        return False, None
