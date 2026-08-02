from abc import ABC, abstractmethod
from typing import List

class SmoothingStrategy(ABC):
    @abstractmethod
    def smooth(self, current_val: float, new_val: float) -> float:
        pass

class EMASmoothing(SmoothingStrategy):
    def __init__(self, alpha: float = 0.2):
        self.alpha = alpha
        
    def smooth(self, current_val: float, new_val: float) -> float:
        if current_val is None:
            return new_val
        return (self.alpha * new_val) + ((1 - self.alpha) * current_val)

class KalmanSmoothing(SmoothingStrategy):
    def smooth(self, current_val: float, new_val: float) -> float:
        # Stub
        return new_val

class SavitzkyGolaySmoothing(SmoothingStrategy):
    def smooth(self, current_val: float, new_val: float) -> float:
        # Stub
        return new_val
