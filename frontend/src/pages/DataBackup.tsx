import { useEffect, useState } from 'react'
import { PageContainer, PageHeader } from '../components/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { CheckIcon, InfoIcon } from '../components/Icons'
import { ApiError } from '../lib/api'
import {
  exportBook,
  importBook,
  restoreBook,
  subscribeSync,
  type SyncStatus,
} from '../lib/storage/sync'
import { usePositions } from '../hooks/usePositions'
import { ruleRepository } from '../lib/storage/rules'

const STATE_LABEL: Record<SyncStatus['state'], string> = {
  idle: '準備中',
  syncing: '保存中…',
  synced: '控えを保存済み',
  offline: '控えを保存できていません',
  disabled: '控えは無効です',
}

export default function DataBackup() {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [copied, setCopied] = useState('')
  const [restoreId, setRestoreId] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState('')
  const [restored, setRestored] = useState('')
  const [fileMessage, setFileMessage] = useState('')
  const [fileError, setFileError] = useState('')
  const { positions } = usePositions()
  const ruleCount = ruleRepository.list().length

  useEffect(() => subscribeSync(setStatus), [])

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(''), 2000)
    } catch {
      setCopied('')
    }
  }

  const restore = async () => {
    setRestoreError('')
    setRestored('')
    setRestoring(true)
    try {
      const result = await restoreBook(restoreId)
      setRestored(`保有${result.positions}件・マイルール${result.rules}件を取り込みました。`)
      setRestoreId('')
    } catch (e) {
      setRestoreError(
        e instanceof ApiError ? e.message : '取り込めませんでした。記録IDをご確認ください。',
      )
    } finally {
      setRestoring(false)
    }
  }

  const download = async () => {
    setFileError('')
    try {
      const text = await exportBook()
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `moshikabu-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setFileMessage('書き出しました。')
    } catch {
      setFileError('書き出せませんでした。')
    }
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setFileError('')
    setFileMessage('')
    try {
      const result = await importBook(await file.text())
      setFileMessage(`保有${result.positions}件・マイルール${result.rules}件になりました。`)
    } catch (e) {
      setFileError(e instanceof Error ? e.message : '読み込めませんでした。')
    }
  }

  const ok = status?.state === 'synced'

  return (
    <PageContainer narrow>
      <PageHeader
        title="記録の保存と復元"
        description="仮想投資の記録は、この端末のブラウザに保存しています。ブラウザの保存領域は消えることがあるため、同じ内容をサーバーにも控えています。"
      />
      <div className="space-y-6">

      <Card padding="lg">
        <CardTitle hint={`保有 ${positions.length}件 ／ マイルール ${ruleCount}件`}>
          いまの状態
        </CardTitle>

        <div
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            ok ? 'border-gain/20 bg-gain-soft' : 'border-line bg-canvas-2'
          }`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              ok ? 'bg-gain text-white' : 'bg-line text-muted'
            }`}
          >
            {ok ? <CheckIcon className="h-3 w-3" /> : <InfoIcon className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0 text-sm">
            <p className={ok ? 'font-medium text-gain' : 'font-medium text-ink'}>
              {STATE_LABEL[status?.state ?? 'idle']}
            </p>
            {status?.message ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{status.message}</p>
            ) : null}
            {status?.syncedAt ? (
              <p className="mt-0.5 text-xs text-muted">
                最終保存 {new Date(status.syncedAt).toLocaleString('ja-JP')}
              </p>
            ) : null}
          </div>
        </div>

        {status?.bookId ? (
          <div className="mt-5 space-y-5">
            <Field label="記録ID" hint="別の端末やブラウザで、この記録を呼び出すための番号です。">
              <div className="flex gap-2">
                <Input value={status.bookId} readOnly onFocus={(e) => e.currentTarget.select()} />
                <Button
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => copy(status.bookId!, 'id')}
                >
                  {copied === 'id' ? 'コピーしました' : 'コピー'}
                </Button>
              </div>
            </Field>

            {status.link ? (
              <Field
                label="復元用リンク"
                hint="このリンクをブックマーク、またはホーム画面に追加しておくと、保存データが消えても同じ記録に戻れます。"
              >
                <div className="flex gap-2">
                  <Input value={status.link} readOnly onFocus={(e) => e.currentTarget.select()} />
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => copy(status.link!, 'link')}
                  >
                    {copied === 'link' ? 'コピーしました' : 'コピー'}
                  </Button>
                </div>
              </Field>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card padding="lg">
        <CardTitle>別の記録を取り込む</CardTitle>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          以前の記録IDを入力すると、その記録を取り込みます。
          いまこの端末にある記録は消さずに、両方をあわせて残します。
        </p>
        <Field label="記録ID" htmlFor="restore-id">
          <Input
            id="restore-id"
            value={restoreId}
            onChange={(e) => setRestoreId(e.target.value)}
            placeholder="例: 2f8a1c34-…"
            autoComplete="off"
          />
        </Field>
        <div className="mt-4">
          <Button onClick={restore} disabled={restoring || !restoreId.trim()}>
            {restoring ? '取り込み中…' : '取り込む'}
          </Button>
        </div>
        {restoreError ? (
          <p className="mt-3 rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
            {restoreError}
          </p>
        ) : null}
        {restored ? (
          <p className="mt-3 rounded-xl border border-gain/20 bg-gain-soft px-4 py-3 text-sm text-gain">
            {restored}
          </p>
        ) : null}
      </Card>

      <Card padding="lg">
        <CardTitle>ファイルに書き出す</CardTitle>
        <p className="mb-4 text-sm leading-relaxed text-muted">
          記録をファイルとして手元に残せます。読み込むと、いまの記録と合体させます。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={download}>
            書き出す
          </Button>
          <label className="focus-ring inline-flex h-11 cursor-pointer items-center rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink transition hover:bg-canvas-2">
            読み込む
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void upload(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {fileMessage ? (
          <p className="mt-3 rounded-xl border border-gain/20 bg-gain-soft px-4 py-3 text-sm text-gain">
            {fileMessage}
          </p>
        ) : null}
        {fileError ? (
          <p className="mt-3 rounded-xl border border-loss/20 bg-loss-soft px-4 py-3 text-sm text-loss">
            {fileError}
          </p>
        ) : null}
      </Card>

      <Card padding="md">
        <div className="flex gap-3">
          <span className="mt-0.5 text-brand">
            <InfoIcon className="h-5 w-5" />
          </span>
          <div className="space-y-2 text-xs leading-relaxed text-muted">
            <p className="font-semibold text-ink">iPhone をお使いの方へ</p>
            <p>
              iOS の Safari は、7日間そのサイトを開かないと保存データを自動的に削除します。
              上の「復元用リンク」をホーム画面に追加しておくと、削除されても同じ記録に戻れます。
            </p>
            <p>
              共有ボタン →「ホーム画面に追加」で追加できます。
              記録IDを知っている人は同じ記録を見られるため、リンクの共有にはご注意ください。
            </p>
            <p>保存しているのは仮想の取引記録だけで、実際の口座や個人情報は扱いません。</p>
          </div>
        </div>
      </Card>
      </div>
    </PageContainer>
  )
}
