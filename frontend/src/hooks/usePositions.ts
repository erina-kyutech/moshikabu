import { useCallback, useEffect, useState } from 'react'
import { portfolioRepository } from '../lib/storage'
import type { Position } from '../lib/storage'

/** 仮想ポートフォリオの保存データを購読する。 */
export function usePositions() {
  const [positions, setPositions] = useState<Position[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    const list = await portfolioRepository.list()
    setPositions(list)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void reload()
    return portfolioRepository.subscribe(() => void reload())
  }, [reload])

  return { positions, loaded, reload }
}
