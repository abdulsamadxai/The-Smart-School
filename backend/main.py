import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import create_db_and_tables
from routers import students, criteria, dashboard, fees, director, certificates

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="The Smart School — Admission Control Room",
    description="Admission pipeline management system for Bara Kahu Campus",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ---------------------------------------------------------------------------
# CORS
# - Local development (no ALLOWED_ORIGINS set): only localhost / 127.0.0.1 /
#   the local network, as before.
# - Production: set ALLOWED_ORIGINS (comma-separated) on the host to the
#   real frontend URL(s), e.g. https://the-smart-school.vercel.app
#   The deployed frontend is otherwise blocked from calling this API.
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

if ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


app.include_router(students.router)
app.include_router(criteria.router)
app.include_router(dashboard.router)
app.include_router(fees.router)
app.include_router(director.router)
app.include_router(certificates.router)


@app.get("/health")
def health():
    return {"status": "ok", "system": "The Smart School Admission Control Room"}
