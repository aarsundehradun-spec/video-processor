from abc import ABC, abstractmethod

class BaseRenderer(ABC):
    def __init__(self, job_dir: str):
        self.job_dir = job_dir

    @abstractmethod
    def render(self):
        """
        Reads tracking.json (and overlay configs) to produce an output file 
        (e.g., .ass, .svg, etc.) in the job directory.
        """
        pass
