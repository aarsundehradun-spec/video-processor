from typing import Dict, Type, Any

class TrackerRegistry:
    _trackers: Dict[str, Type['BaseTracker']] = {}

    @classmethod
    def register(cls, name: str):
        def wrapper(tracker_class: Type['BaseTracker']):
            cls._trackers[name] = tracker_class
            return tracker_class
        return wrapper

    @classmethod
    def get_tracker(cls, name: str) -> Type['BaseTracker']:
        if name not in cls._trackers:
            raise ValueError(f"Tracker '{name}' is not registered.")
        return cls._trackers[name]

    @classmethod
    def get_capabilities(cls, name: str) -> Dict[str, Any]:
        tracker_class = cls.get_tracker(name)
        return tracker_class.capabilities()
