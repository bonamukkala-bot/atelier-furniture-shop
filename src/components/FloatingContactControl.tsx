import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { SHOP_INFO } from '../lib/constants'
import { buildWhatsAppLink } from '../lib/whatsapp'
import ChatWidget from './ChatWidget'

export function FloatingContactControl() {
  const { t, i18n } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const fabRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const firstMenuItemRef = useRef<HTMLAnchorElement>(null)
  const shouldReduceMotion = useReducedMotion()

  const whatsappUrl = buildWhatsAppLink({ language: i18n.language })

  // Focus management: move focus into the menu when opened
  useEffect(() => {
    if (menuOpen) {
      setTimeout(() => {
        firstMenuItemRef.current?.focus()
      }, 50)
    }
  }, [menuOpen])

  // Handle Escape key and outside click to close menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menuOpen) {
          setMenuOpen(false)
          fabRef.current?.focus()
        }
        if (chatOpen) {
          setChatOpen(false)
          fabRef.current?.focus()
        }
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        fabRef.current &&
        !fabRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen, chatOpen])

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev)
  }

  return (
    <>
      {/* 1. DESKTOP / TABLET: Single Floating Action Button & Expanding Menu (>=640px) */}
      <div className="hidden sm:block fixed bottom-6 right-6 z-30 font-inter">
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label="Contact options"
              initial={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
              transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 20, stiffness: 300 }}
              className="absolute bottom-16 right-0 mb-2 w-60 bg-[#FAF7F2] border border-[var(--border)] shadow-2xl rounded-xl p-2 flex flex-col gap-1.5"
            >
              {/* Option 1: WhatsApp (WhatsApp Green #128C4A with 4.5:1+ contrast against white) */}
              <a
                ref={firstMenuItemRef}
                role="menuitem"
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-[#128C4A] hover:bg-[#0f753e] active:bg-[#0a522b] text-white font-medium text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white shadow-sm"
              >
                <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m-3.53 3.42c-.19 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.06 3.28 5.08 4.49.72.29 1.28.46 1.72.6.72.23 1.38.2 1.9.12.58-.08 1.79-.73 2.04-1.44.26-.71.26-1.32.18-1.44-.08-.13-.27-.2-.56-.35-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.69.15-.2.3-.79.98-.97 1.18-.18.2-.36.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.69-1.66-.94-2.28-.25-.59-.51-.51-.69-.52l-.59-.01z" />
                </svg>
                <span>{t('floatingActions.whatsapp', 'WhatsApp')}</span>
              </a>

              {/* Option 2: Call Showroom */}
              <a
                role="menuitem"
                href={SHOP_INFO.telPhone}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-white hover:bg-[#EFE9DE] active:bg-[#E5DDCF] border border-[var(--border)] text-[var(--ink)] font-medium text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
              >
                <svg className="w-4 h-4 text-[var(--ink)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6.6 3.5 9 3l2 4.5-1.8 1.5a14.4 14.4 0 0 0 5.8 5.8l1.5-1.8 4.5 2-.5 2.4c-.2 1-1.1 1.7-2.1 1.6C10.7 18.2 5.8 13.3 5 5.6c-.1-1 .6-1.9 1.6-2.1Z" />
                </svg>
                <span>{t('floatingActions.call', 'Call Showroom')}</span>
              </a>

              {/* Option 3: Chat Assistant */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  setChatOpen(true)
                }}
                className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-white hover:bg-[#EFE9DE] active:bg-[#E5DDCF] border border-[var(--border)] text-[var(--ink)] font-medium text-xs transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] w-full text-left"
              >
                <svg className="w-4 h-4 text-[var(--ink)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>{t('floatingActions.chat', 'Chat Assistant')}</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The 56px Floating Button */}
        <motion.button
          ref={fabRef}
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={menuOpen ? t('floatingActions.closeMenu', 'Close quick contact menu') : t('floatingActions.openMenu', 'Open quick contact menu')}
          title={menuOpen ? t('floatingActions.closeMenu', 'Close contact menu') : t('floatingActions.openMenu', 'Contact us')}
          whileHover={!shouldReduceMotion ? { scale: 1.05 } : undefined}
          whileTap={!shouldReduceMotion ? { scale: 0.95 } : undefined}
          onClick={toggleMenu}
          className="w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-[var(--ink)] hover:bg-[#3D3024] active:bg-[#1A140F] text-white shadow-xl flex items-center justify-center transition-all duration-200 border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2"
        >
          {menuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6 fill-none stroke-current" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </motion.button>
      </div>

      {/* 2. MOBILE: Fixed 56px Bottom Action Bar (<640px) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 h-14 bg-[#FAF7F2]/98 backdrop-blur-md border-t border-[var(--border)] z-30 flex items-stretch shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
        {/* Mobile Action 1: Call */}
        <a
          href={SHOP_INFO.telPhone}
          aria-label={t('floatingActions.call', 'Call Showroom')}
          className="flex-1 flex items-center justify-center gap-2 h-full text-[var(--ink)] font-inter text-xs font-semibold border-r border-[var(--border)] active:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
        >
          <svg className="w-4 h-4 text-[var(--ink)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.6 3.5 9 3l2 4.5-1.8 1.5a14.4 14.4 0 0 0 5.8 5.8l1.5-1.8 4.5 2-.5 2.4c-.2 1-1.1 1.7-2.1 1.6C10.7 18.2 5.8 13.3 5 5.6c-.1-1 .6-1.9 1.6-2.1Z" />
          </svg>
          <span>{t('enquiry.call', 'Call')}</span>
        </a>

        {/* Mobile Action 2: WhatsApp (Primary colored action in bar) */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('floatingActions.whatsapp', 'WhatsApp')}
          className="flex-[1.2] flex items-center justify-center gap-2 h-full bg-[#128C4A] active:bg-[#0f753e] text-white font-inter text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m-3.53 3.42c-.19 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.06 3.28 5.08 4.49.72.29 1.28.46 1.72.6.72.23 1.38.2 1.9.12.58-.08 1.79-.73 2.04-1.44.26-.71.26-1.32.18-1.44-.08-.13-.27-.2-.56-.35-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.69.15-.2.3-.79.98-.97 1.18-.18.2-.36.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.69-1.66-.94-2.28-.25-.59-.51-.51-.69-.52l-.59-.01z" />
          </svg>
          <span>{t('floatingActions.whatsapp', 'WhatsApp')}</span>
        </a>

        {/* Mobile Action 3: Directions */}
        <a
          href={SHOP_INFO.directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('floatingActions.directions', 'Directions to showroom')}
          className="flex-1 flex items-center justify-center gap-2 h-full text-[var(--ink)] font-inter text-xs font-semibold border-l border-[var(--border)] active:bg-black/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
        >
          <svg className="w-4 h-4 text-[var(--ink)] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{t('floatingActions.directions', 'Directions')}</span>
        </a>
      </div>

      {/* 3. Chat Assistant Modal Dialog */}
      <ChatWidget
        isOpen={chatOpen}
        onClose={() => {
          setChatOpen(false)
          fabRef.current?.focus()
        }}
        showTrigger={false}
      />
    </>
  )
}

export default FloatingContactControl
