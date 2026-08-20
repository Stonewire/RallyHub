import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'

import { AssetField } from '@/components/games/AssetField'
import { BrandColourPicker } from '@/components/admin/BrandColourPicker'
import { SegmentedPill } from '@/components/neo-minimal'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { DEFAULT_QUIZ_BACKGROUND, quizBackgroundGradient } from '@/lib/quiz-media'
import type { GameConfig } from '@/types/game-config'

const CORNER_KEYS = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const

/**
 * A game's background: one photo, or four colours blended from the corners.
 * Used by quiz and music bingo, which share this treatment.
 *
 * The four colours are this quiz's own background and nothing else. Brand
 * colours live on the event, so they are deliberately not reused here.
 */
export function QuizBackgroundPanel({
  config,
  setConfig,
  quizName,
  onUploadBackground,
  title,
  previewSubtitle,
}: {
  config: GameConfig
  setConfig: Dispatch<SetStateAction<GameConfig>>
  quizName: string
  onUploadBackground: (file: File) => Promise<string>
  title?: string
  previewSubtitle?: string
}) {
  const { t } = useTranslation('admin')
  const heading = title ?? t('games.background.quizDesigner')
  const subtitle = previewSubtitle ?? t('games.background.quizPreviewSubtitle')
  const usingImage = config.background_mode
    ? config.background_mode === 'image'
    : Boolean(config.background_url)
  const colours = config.quiz_background_colors ?? DEFAULT_QUIZ_BACKGROUND

  const previewStyle = usingImage
    ? {
        backgroundImage: `url(${config.background_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundImage: quizBackgroundGradient(config.quiz_background_colors) }

  function setCorner(index: number, hex: string) {
    setConfig((current) => {
      const next = [...(current.quiz_background_colors ?? DEFAULT_QUIZ_BACKGROUND)] as [
        string,
        string,
        string,
        string,
      ]
      next[index] = hex
      return { ...current, quiz_background_colors: next }
    })
  }

  return (
    <Card className="border-border/80 space-y-4 bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-foreground text-sm font-bold">{heading}</h3>
        <SegmentedPill
          size="sm"
          className="w-44"
          aria-label={t('games.background.backgroundType')}
          options={[
            { value: 'image', label: t('games.background.photo') },
            { value: 'colours', label: t('games.background.colours') },
          ]}
          value={usingImage ? 'image' : 'colours'}
          onChange={(next) =>
            // The upload survives a switch to Colours, so the two can be
            // compared without re-uploading.
            setConfig((c) => ({ ...c, background_mode: next as 'image' | 'colours' }))
          }
        />
      </div>

      {usingImage ? (
        <AssetField
          label={t('games.background.backgroundPhoto')}
          preview={config.background_url ?? null}
          onFile={async (file) => {
            if (!file) return
            const url = await onUploadBackground(file)
            setConfig((c) => ({ ...c, background_url: url, background_mode: 'image' }))
          }}
          onUrl={(url) =>
            setConfig((c) => ({ ...c, background_url: url, background_mode: 'image' }))
          }
        />
      ) : (
        <div className="space-y-2">
          <Label>{t('games.background.cornerColours')}</Label>
          <div className="grid grid-cols-2 gap-3">
            {CORNER_KEYS.map((corner, index) => (
              <BrandColourPicker
                key={corner}
                id={`quiz-bg-${index}`}
                label={t(`games.background.corner.${corner}`)}
                value={colours[index]}
                onChange={(hex) => setCorner(index, hex)}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
          {t('games.background.livePreview')}
        </p>
        <div
          className="flex aspect-video items-center justify-center rounded-md p-4 text-center"
          style={previewStyle}
        >
          <div>
            <p className="text-base font-bold text-white drop-shadow">
              {quizName.trim() || t('games.background.untitledQuiz')}
            </p>
            <p className="text-xs text-white/85 drop-shadow">{subtitle}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
