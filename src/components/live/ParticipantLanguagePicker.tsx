import { APP_LANGUAGES, toAppLanguage, type AppLanguage } from '@/lib/i18n'

/**
 * First screen of a multilingual event, before the privacy notice.
 *
 * The team picks the language its phone will speak for the rest of the event.
 * It comes before the notice on purpose: consent you cannot read is not
 * consent, so the notice that follows is already in the chosen language.
 *
 * Deliberately not translated. Every label is written in its own language, so
 * whatever the app currently happens to be set to, a player can find theirs.
 */
export function ParticipantLanguagePicker({
  languages,
  onPick,
}: {
  languages: string[]
  onPick: (language: AppLanguage) => void
}) {
  // Keep APP_LANGUAGES' order rather than the organiser's array order, so the
  // list does not reshuffle between events, and drop anything unrecognised.
  const options = APP_LANGUAGES.filter((entry) => languages.includes(entry.code))
  const shown = options.length ? options : APP_LANGUAGES

  return (
    <div className="experience-scope fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm">
      <div className="xp-card my-auto w-full max-w-md space-y-5 bg-white p-6 text-black">
        <div className="space-y-1.5 text-center">
          {/* A globe rather than a flag: languages are not countries, and the
              same language is spoken in plenty of them. */}
          <div className="text-3xl" aria-hidden="true">
            🌐
          </div>
          <h2 className="text-xl font-black">Choose your language</h2>
        </div>

        <ul className="space-y-2">
          {shown.map((entry) => (
            <li key={entry.code}>
              <button
                type="button"
                lang={entry.code}
                onClick={() => onPick(toAppLanguage(entry.code))}
                className="flex w-full items-center justify-between rounded-xl border-[1.5px] border-black/15 px-4 py-3.5 text-left text-base font-bold transition-colors hover:border-black/40 hover:bg-black/[0.04] focus-visible:border-black/40 focus-visible:outline-none"
              >
                <span>{entry.label}</span>
                <span className="text-xs font-semibold tracking-widest text-black/40 uppercase">
                  {entry.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
