import asyncio
import logging
from sqlalchemy import text
from app.db.session import AsyncSessionLocal
from app.core.automation_engine import evaluate_rules_and_create_tasks

logger = logging.getLogger(__name__)

# Distributed Lock Key for database-level concurrency protection
AUTOMATION_LOCK_KEY = 894372

_scheduler_task = None
_loop_active = False

async def run_automation_cycle_with_lock():
    """
    Acquires a PostgreSQL advisory transaction lock to run the evaluation loop,
    ensuring execution safety and idempotency under multi-instance horizontal scaling.
    """
    logger.info("Scheduler Triggered: Attempting to acquire database advisory lock...")
    async with AsyncSessionLocal() as session:
        try:
            # PostgreSQL transaction advisory lock (exclusive, non-blocking check)
            # pg_try_advisory_xact_lock returns True if lock is successfully acquired
            lock_res = await session.execute(
                text("SELECT pg_try_advisory_xact_lock(:lock_key)"),
                {"lock_key": AUTOMATION_LOCK_KEY}
            )
            acquired = lock_res.scalar()
            
            if acquired:
                logger.info("Advisory lock acquired. Executing escalation & compliance engines...")
                await evaluate_rules_and_create_tasks()
                logger.info("Automation & escalation engine processing completed successfully.")
            else:
                logger.warning("DB advisory lock already held by another pod. Skipping execution cycle.")
                
        except Exception as e:
            logger.error(f"Error executing scheduled automation rules: {e}", exc_info=True)


async def _scheduler_loop():
    """
    Fallback async background polling loop executing rule triggers every 30 seconds
    """
    global _loop_active
    logger.info("Starting fallback async automation background worker loop...")
    _loop_active = True
    
    # Stagger initial run
    await asyncio.sleep(5)
    
    while _loop_active:
        try:
            await run_automation_cycle_with_lock()
        except Exception as e:
            logger.error(f"Error in background scheduler iteration: {e}")
            
        # Poll rules every 30 seconds in development
        await asyncio.sleep(30)


def start_automation_scheduler():
    """
    Triggers rule engine. Tries standard APScheduler, falls back to custom async worker.
    """
    global _scheduler_task
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        
        scheduler = AsyncIOScheduler()
        scheduler.add_job(
            run_automation_cycle_with_lock,
            IntervalTrigger(seconds=30),
            id="escalation_engine_job",
            replace_existing=True
        )
        scheduler.start()
        logger.info("Successfully started enterprise APScheduler engine (polling every 30s).")
        
    except ImportError:
        logger.info("APScheduler not installed in environment. Launching custom Asyncio background daemon...")
        _scheduler_task = asyncio.create_task(_scheduler_loop())


def stop_automation_scheduler():
    """
    Clean shutdown triggers
    """
    global _loop_active
    logger.info("Stopping automation engine background task...")
    _loop_active = False
    if _scheduler_task:
        _scheduler_task.cancel()
        logger.info("Async worker loop cancelled.")
