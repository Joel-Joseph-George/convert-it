"""Thread-safe cancellation flags shared between the job runner and engine worker threads.

The job store hands out copies of job records, so engines running in a worker thread
(such as yt-dlp) cannot see `cancelRequested` changes made through the store. These
flags give them a shared signal they can check from inside their progress hooks.
"""

import threading

_flags: dict[str, threading.Event] = {}
_lock = threading.Lock()


def get_cancel_event(job_id: str) -> threading.Event:
    """Return the cancellation flag for a job, creating it if needed."""
    with _lock:
        event = _flags.get(job_id)
        if event is None:
            event = threading.Event()
            _flags[job_id] = event
        return event


def request_cancel(job_id: str) -> None:
    """Signal any worker thread for this job to stop at its next checkpoint."""
    get_cancel_event(job_id).set()


def is_cancelled(job_id: str) -> bool:
    """Whether cancellation has been requested for this job."""
    with _lock:
        event = _flags.get(job_id)
    return event is not None and event.is_set()


def discard(job_id: str) -> None:
    """Forget the flag once the job has finished."""
    with _lock:
        _flags.pop(job_id, None)
