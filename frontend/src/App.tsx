import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
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
            <Route path="/past" element={<PastSimulation />} />
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
