import { useTranslation } from 'react-i18next'

export function GameUnavailableFallback() {
  const { t } = useTranslation('live')
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <p className="text-lg font-medium text-white/90">{t('join.gameUnavailable.title')}</p>
      <p className="mt-3 text-white/70">{t('join.gameUnavailable.standBy')}</p>
    </div>
  )
}
