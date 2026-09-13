import { PageContainer } from '../components/PageHeader'
import { EmptyState } from '../components/ui/States'
import { ButtonLink } from '../components/ui/Button'

export default function NotFound() {
  return (
    <PageContainer narrow>
      <EmptyState
        title="ページが見つかりませんでした"
        description="URL が変更されたか、削除された可能性があります。"
        action={
          <ButtonLink to="/" variant="primary" size="lg">
            ホームに戻る
          </ButtonLink>
        }
      />
    </PageContainer>
  )
}
