import type { HistoryInfo } from '../../state'
import { tn as translateN } from '../../i18n/t'
import type { Locale } from '../../domain/locale'

/** What an undo/redo step is called: "Delete 3 events", "删除文件夹". */
export function historyLabel(locale: Locale, info: HistoryInfo): string {
  return translateN(locale, `history.${info.action}`, info.count)
}
