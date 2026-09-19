"""MoshiKabu バックエンド (FastAPI)。

実際の証券口座とは一切接続しない、株価データ提供専用のAPI。
"""
from __future__ import annotations

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .providers.base import MarketDataError, SymbolNotFoundError
from .routers import fx, simulate, stock, strategies

app = FastAPI(
    title="MoshiKabu API",
    description="現実の株価データを使った投資シミュレーション用API（実取引は行いません）",
    version="1.0.0",
)

_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()] or ["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stock.router)
app.include_router(simulate.router)
app.include_router(strategies.router)
app.include_router(fx.router)


@app.exception_handler(SymbolNotFoundError)
async def _symbol_not_found(_: Request, exc: SymbolNotFoundError) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={"detail": {"code": "SYMBOL_NOT_FOUND", "message": "銘柄が見つかりませんでした"}},
    )


@app.exception_handler(MarketDataError)
async def _market_data_error(_: Request, exc: MarketDataError) -> JSONResponse:
    return JSONResponse(
        status_code=502,
        content={
            "detail": {
                "code": "UPSTREAM_ERROR",
                "message": "株価データを取得できませんでした。しばらくしてからもう一度お試しください。",
            }
        },
    )


@app.exception_handler(ValueError)
async def _value_error(_: Request, exc: ValueError) -> JSONResponse:
    return JSONResponse(status_code=400, content={"detail": {"code": "BAD_INPUT", "message": str(exc)}})


@app.get("/api/health")
def health() -> dict:
    from .providers import get_provider

    return {"status": "ok", "provider": get_provider().name}
