"""HDCMS - FastAPI server entry point."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from common import client
from routes_auth import router as auth_router
from routes_admin import router as admin_router
from routes_gauges import router as gauges_router
from routes_requests import router as requests_router
from routes_calibration import router as cal_router
from routes_misc import router as misc_router
from seed import run_all_seeds, write_test_credentials_file


app = FastAPI(title="Honda Digital Calibration Management System")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"name": "HDCMS API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "healthy"}


# Register sub-routers
api_router.include_router(auth_router)
api_router.include_router(admin_router)
api_router.include_router(gauges_router)
api_router.include_router(requests_router)
api_router.include_router(cal_router)
api_router.include_router(misc_router)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    try:
        await run_all_seeds()
        await write_test_credentials_file()
        logger.info("HDCMS startup complete: seeded data + indexes")
    except Exception as e:
        logger.exception("Seed error: %s", e)


@app.on_event("shutdown")
async def shutdown():
    client.close()
