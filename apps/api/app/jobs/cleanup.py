"""Disk and State Cleanup Tasks for Ephemeral Job Lifecycle."""

import asyncio
import os
import shutil
import time

from app.core.config import settings
from app.core.logging import logger
from app.jobs.store import JobStore


def wipe_temp_directory(tmp_dir: str) -> None:
    """Wipe TMP_DIR on startup to remove orphan files from previous runs."""
    if os.path.exists(tmp_dir):
        logger.info("wiping_temp_directory_on_startup", path=tmp_dir)
        try:
            for item in os.listdir(tmp_dir):
                item_path = os.path.join(tmp_dir, item)
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path, ignore_errors=True)
                else:
                    os.remove(item_path)
        except Exception as e:
            logger.error("error_wiping_temp_dir", error=str(e))
    else:
        os.makedirs(tmp_dir, exist_ok=True)


async def run_cleanup_loop(store: JobStore, interval_sec: float = 60.0) -> None:
    """Periodic background loop deleting expired directories and aging job records."""
    while True:
        try:
            await asyncio.sleep(interval_sec)
            now = time.time()
            all_jobs = await store.get_all_jobs()

            for job in all_jobs:
                job_dir = os.path.join(settings.TMP_DIR, job.id)

                # 1. Post-download 60-second grace expiration
                if (
                    job.firstDownloadedAt is not None
                    and (now - job.firstDownloadedAt) >= 60.0
                    and os.path.exists(job_dir)
                ):
                    logger.info("cleaning_up_downloaded_job_dir", job_id=job.id)
                    shutil.rmtree(job_dir, ignore_errors=True)

                # 2. Result TTL expiration (default 15 min)
                if (
                    job.expiresAtTimestamp > 0
                    and now >= job.expiresAtTimestamp
                    and os.path.exists(job_dir)
                ):
                    logger.info("cleaning_up_expired_result_dir", job_id=job.id)
                    shutil.rmtree(job_dir, ignore_errors=True)

                # 3. Job record TTL expiration (default 60 min)
                if (now - job.createdAtTimestamp) >= (settings.JOB_RECORD_TTL_MIN * 60):
                    logger.info("expiring_old_job_record", job_id=job.id)
                    shutil.rmtree(job_dir, ignore_errors=True)
                    await store.delete_job(job.id)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("cleanup_loop_error", error=str(e))
