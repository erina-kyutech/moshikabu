/** クラス名の連結（条件付きクラスを扱うだけの軽量ヘルパー）。 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
