import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useUser } from '@/features/auth/useUser'
import { useRotateVoiceToken, useVoiceTokenStatus } from '@/entities/voice-booking/queries'
import { VOICE_BOOKING_FUNCTION_URL } from '@/entities/voice-booking/api'
import { toast } from '@/shared/ui/Toast'

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Не удалось скопировать')
    }
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="flex gap-2">
        <code className="flex-1 min-w-0 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800">
          {value}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex-shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
    </div>
  )
}

export function VoiceBookingSection() {
  const { user } = useUser()
  const { data: tokenCreatedAt } = useVoiceTokenStatus(user?.id)
  const rotateToken = useRotateVoiceToken()
  const [token, setToken] = useState<string | null>(null)

  async function handleCreateToken() {
    if (!user) return
    if (tokenCreatedAt && !confirm('Старый токен перестанет работать, и его нужно будет заменить в команде iPhone. Продолжить?')) return
    try {
      setToken(await rotateToken.mutateAsync(user.id))
    } catch {
      toast.error('Не удалось создать токен. Проверьте, что миграция 007 применена.')
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-gray-800">Голосовая бронь (iPhone)</h2>
        <p className="text-sm text-gray-500">
          Нажали Action Button, продиктовали «12, Айгерим, с 12 по 15 ноября, 45 тысяч, предоплата 10» —
          бронь появится в приложении на подтверждение, с проверкой занятости.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleCreateToken}
          disabled={rotateToken.isPending || !user}
          className="rounded-lg bg-[#376E6F] px-4 py-2 text-sm font-medium text-white hover:bg-[#1C3334] disabled:opacity-50"
        >
          {rotateToken.isPending ? 'Создаём…' : tokenCreatedAt ? 'Создать новый токен' : 'Создать токен'}
        </button>
        {tokenCreatedAt && !token && (
          <span className="text-xs text-gray-500">Токен создан {format(parseISO(tokenCreatedAt), 'dd.MM.yyyy')}</span>
        )}
      </div>

      {token && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-800">Токен показывается один раз. Скопируйте его в команду сейчас.</p>
          <CopyField label="Токен (заголовок x-voice-token)" value={token} />
        </div>
      )}

      <CopyField label="Адрес (URL)" value={VOICE_BOOKING_FUNCTION_URL} />

      <details className="text-sm text-gray-700">
        <summary className="cursor-pointer font-medium text-[#376E6F]">Как настроить команду на iPhone</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Приложение «Команды» → «+» → назовите команду «Бронь».</li>
          <li>Добавьте «Диктовать текст»: язык — русский, «Прекратить прослушивание» — «После паузы».</li>
          <li>
            Добавьте «Получить содержимое URL»: URL — адрес выше; метод — POST; заголовок
            <code className="mx-1 rounded bg-gray-100 px-1">x-voice-token</code> — токен;
            тело запроса — JSON, поле <code className="mx-1 rounded bg-gray-100 px-1">text</code> = «Продиктованный текст».
          </li>
          <li>
            «Получить значение словаря» для ключа <code className="mx-1 rounded bg-gray-100 px-1">summary</code> →
            «Показать предупреждение» с этим значением (по желанию ещё «Произнести текст»).
          </li>
          <li>
            «Получить значение словаря» для ключа <code className="mx-1 rounded bg-gray-100 px-1">open_url</code> из
            «Содержимого URL» → «Открыть URL-адреса».
          </li>
          <li>
            Настройки iPhone → «Кнопка действия» → «Команда» → «Бронь».
            Без Action Button: Универсальный доступ → Касание → «Касание задней панели» → «Двойное касание» → «Бронь».
          </li>
        </ol>
        <p className="mt-3 text-xs text-gray-500">
          iOS открывает ссылку в Safari, а не в приложении с экрана «Домой», — один раз войдите в аккаунт в Safari.
          Можно пропустить шаг 5: черновик всё равно появится баннером в календаре приложения.
        </p>
      </details>
    </div>
  )
}
