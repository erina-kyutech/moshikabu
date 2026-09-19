from __future__ import annotations

from fastapi import APIRouter, Query

from .. import directory
from ..schemas import SearchOut, SearchResultOut
from ..services.search import search as search_symbols

router = APIRouter(prefix="/api", tags=["search"])


@router.get("/search", response_model=SearchOut)
def search(
    q: str = Query(..., min_length=1, max_length=60, description="社名・証券コード・ティッカー"),
    limit: int = Query(8, ge=1, le=20),
) -> SearchOut:
    """銘柄候補の検索。

    「150A」「5401」「日本製鉄」「株式会社JSH」「apple」「NVDA」などに対応する。
    株価はまだ取得しない（選ばれた候補だけ /api/stock/{ticker} で取得する）。
    """
    results = search_symbols(q, limit=limit)
    return SearchOut(
        query=q,
        directoryAsOf=directory.as_of() or None,
        results=[
            SearchResultOut(
                ticker=r.ticker,
                code=r.code,
                name=r.name,
                market=r.market,
                exchange=r.exchange,
                quoteType=r.quote_type,
                exact=r.exact,
                verified=r.verified,
                source=r.source,
            )
            for r in results
        ],
    )
