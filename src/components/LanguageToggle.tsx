import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const languages = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'te', short: 'TE', label: 'తెలుగు' },
  { code: 'hi', short: 'HI', label: 'हिन्दी' },
] as const

function LanguageToggle() {
  const { i18n } = useTranslation()
  const [activeLanguage, setActiveLanguage] = useState(i18n.language || 'en')
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    setActiveLanguage(i18n.language || 'en')
  }, [i18n.language])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    const handleKeyNav = (event: KeyboardEvent) => {
      if (!isOpen) return
      const active = document.activeElement
      const items = optionsRef.current.filter(Boolean) as HTMLButtonElement[]
      const idx = items.findIndex((el) => el === active)

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const next = items[(idx + 1) % items.length]
        next?.focus()
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const prev = items[(idx - 1 + items.length) % items.length]
        prev?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyNav)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleKeyNav)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      // focus first option for keyboard users
      const first = optionsRef.current.find(Boolean) as HTMLButtonElement | undefined
      first?.focus()
    }
  }, [isOpen])

  const handleLanguageChange = (language: (typeof languages)[number]['code']) => {
    void i18n.changeLanguage(language)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('atelier-language', language)
    }
    setActiveLanguage(language)
    setIsOpen(false)
  }

  const activeLanguageData = languages.find((language) => language.code === activeLanguage) ?? languages[0]

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setIsOpen((prev) => !prev)
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="inline-flex items-center gap-2 rounded-full border border-[#E4DDD1] bg-[#FAF7F2] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#2B2420] shadow-[0_2px_8px_rgba(43,36,32,0.06)] transition-colors duration-200 hover:border-[#B8874B] hover:text-[#B8874B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8874B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF7F2]"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3c4.2 0 7.5 3.3 7.5 7.5S16.2 18 12 18 4.5 14.7 4.5 10.5 7.8 3 12 3Z" />
          <path d="M4.5 10.5h15" />
          <path d="M12 3.2c1.8 2.4 2.7 4.9 2.7 7.3 0 2.4-.9 4.9-2.7 7.3" />
          <path d="M12 3.2c-1.8 2.4-2.7 4.9-2.7 7.3 0 2.4.9 4.9 2.7 7.3" />
        </svg>
        <span>{activeLanguageData.short}</span>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-20 mt-2 w-36 rounded-xl border border-[#E4DDD1] bg-[#FAF7F2] p-1.5 shadow-[0_8px_24px_rgba(43,36,32,0.12)]"
          role="listbox"
          aria-label="Language selector"
        >
          {languages
            .filter((language) => language.code !== activeLanguage)
            .map((language, idx) => (
              <button
                key={language.code}
                ref={(el) => (optionsRef.current[idx] = el)}
                role="option"
                aria-selected={false}
                type="button"
                onClick={() => handleLanguageChange(language.code)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2B2420] transition-colors duration-200 hover:bg-[#F2EBDD] hover:text-[#B8874B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8874B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF7F2]"
              >
                <span className="not-italic normal-case">{language.label}</span>
                <span className="text-[10px] text-[#6B7259]">{language.short}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export default LanguageToggle
