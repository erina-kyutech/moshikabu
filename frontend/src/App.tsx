import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { MobileBottomNavigation, Navigation } from './components/Navigation'
import { Disclaimer } from './components/Disclaimer'
import { ScrollToTop } from './components/ScrollToTop'
import { LoadingBlock } from './components/ui/States'
import Home from './pages/Home'

// チャートライブラリを含む画面は遅延読み込みして、ホームの表示を軽くする
const PastSimulation = lazy(() => import('./pages/PastSimulation'))
const Invest = lazy(() => import('./pages/Invest'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const HoldingDetail = lazy(() => import('./pages/HoldingDetail'))
const TradeHistory = lazy(() => import('./pages/TradeHistory'))
const Simulations = lazy(() => import('./pages/Simulations'))
const Compare = lazy(() => import('./pages/Compare'))
const Recurring = lazy(() => import('./pages/Recurring'))
const StrategyCompare = lazy(() => import('./pages/StrategyCompare'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <ScrollToTop />
      <Navigation />
      <main className="flex-1 pb-20 md:pb-0">
        <Suspense fallback={<LoadingBlock message="読み込み中…" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/simulations" element={<Simulations />} />
            <Route path="/past" element={<PastSimulation />} />
            {/* 旧称でのリンクも受ける */}
            <Route path="/simulation" element={<Navigate to="/past" replace />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/compare-strategy" element={<StrategyCompare />} />
            <Route path="/invest" element={<Invest />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/portfolio/:id" element={<HoldingDetail />} />
            <Route path="/history" element={<TradeHistory />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Disclaimer />
      <MobileBottomNavigation />
    </div>
  )
}
