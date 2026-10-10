import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

function LanguageToggle() {
  const { i18n } = useTranslation()
  const [activeLanguage, setActiveLanguage] = useState(i18n.language === 'te' ? 'te' : 'en')

  useEffect(() => {
    setActiveLanguage(i18n.language === 'te' ? 'te' : 'en')
  }, [i18n.language])

  const handleSelectLanguage = (lang: 'en' | 'te') => {
    void i18n.changeLanguage(lang)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('atelier-language', lang)
    }
    setActiveLanguage(lang)
  }

  return (
    <div
      role="group"
      aria-label="Change language"
      className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg)] p-1 shadow-[0_2px_8px_rgba(43,36,32,0.06)] min-h-[44px]"
    >
      <button
        type="button"
        onClick={() => handleSelectLanguage('en')}
        aria-pressed={activeLanguage === 'en'}
        aria-label="Switch to English language"
        className={`min-h-[36px] min-w-[42px] px-3.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] ${
          activeLanguage === 'en'
            ? 'bg-[var(--gold)] text-[var(--bg)] shadow-xs'
            : 'text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer'
        }`}
      >
        EN
      </button>

      <span className="text-[var(--border)] select-none px-0.5" aria-hidden="true">
        |
      </span>

      <button
        type="button"
        onClick={() => handleSelectLanguage('te')}
        aria-pressed={activeLanguage === 'te'}
        aria-label="Switch to Telugu language (తెలుగు)"
        className={`min-h-[36px] min-w-[42px] px-3.5 rounded-full text-xs font-semibold tracking-wider transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] ${
          activeLanguage === 'te'
            ? 'bg-[var(--gold)] text-[var(--bg)] shadow-xs'
            : 'text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer'
        }`}
      >
        తె
      </button>
    </div>
  )
}

export default LanguageToggle
