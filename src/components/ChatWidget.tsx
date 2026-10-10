import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { SHOP_INFO } from '../lib/constants'

interface Message {
  role: 'user' | 'bot'
  text: string
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-bot`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

interface ChatWidgetProps {
  isOpen?: boolean
  onClose?: () => void
  showTrigger?: boolean
}

function ChatWidget({
  isOpen: controlledIsOpen,
  onClose,
  showTrigger = true,
}: ChatWidgetProps = {}) {
  const { t } = useTranslation()
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isControlled = typeof controlledIsOpen === 'boolean'
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen

  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Hi! Ask me about our furniture — stock, prices, materials, anything.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
  }, [messages, shouldReduceMotion])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const handleClose = () => {
    if (isControlled) {
      onClose?.()
    } else {
      setInternalIsOpen(false)
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const question = input.trim()
    setMessages((prev) => [...prev, { role: 'user', text: question }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ question }),
      })

      const data = await res.json()
      const answer = data.answer ?? 'Sorry, something went wrong. Please try again.'
      setMessages((prev) => [...prev, { role: 'bot', text: answer }])
    } catch {
      const waPhone = SHOP_INFO.whatsappNumber
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: `I'm having trouble connecting right now — feel free to reach out on WhatsApp instead: https://wa.me/${waPhone}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-40 font-inter">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="Atelier chat assistant"
            initial={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 15 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 20, stiffness: 250 }}
            className="w-[calc(100vw-32px)] sm:w-80 h-96 bg-[#FAF7F2] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-[var(--border)] mb-2 max-w-[340px]"
          >
            {/* Header */}
            <div className="bg-[var(--ink)] text-[#FAF7F2] px-4 py-3 flex justify-between items-center border-b border-[var(--border)]/20">
              <div className="flex flex-col">
                <span className="font-semibold text-xs tracking-wider uppercase text-white">Atelier Assistant</span>
                <span className="text-[9px] text-[var(--gold-on-dark)] uppercase tracking-widest">Always Online</span>
              </div>
              <button 
                type="button"
                onClick={handleClose} 
                aria-label="Close chat assistant"
                className="text-[#FAF7F2]/80 hover:text-white transition-colors focus:outline-none text-xs font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Message Area */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF7F2]"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.map((msg, i) => {
                const hasWaLink = /https:\/\/wa\.me\/[0-9]+/.test(msg.text)
                return (
                  <div
                    key={i}
                    className={`text-xs p-3 rounded-md max-w-[85%] leading-relaxed border ${
                      msg.role === 'user'
                        ? 'bg-[var(--ink)] text-[#FAF7F2] border-[var(--ink)] ml-auto'
                        : 'bg-white text-[var(--ink)] border-[var(--border)] mr-auto'
                    }`}
                  >
                    {hasWaLink ? (
                      <div>
                        {msg.text.replace(/https:\/\/wa\.me\/[0-9]+/, '').trim()}
                        <div className="mt-2">
                          <a
                            href={msg.text.match(/https:\/\/wa\.me\/[0-9]+/)?.[0]}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#128C4A] font-semibold underline"
                          >
                            Message us on WhatsApp
                          </a>
                        </div>
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                )
              })}
              {loading && (
                <div className="text-xs p-3 rounded-md bg-white text-[var(--muted)] border border-[var(--border)] max-w-[85%] italic">
                  Typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={sendMessage} className="p-3 border-t border-[var(--border)] bg-white flex gap-2">
              <input
                ref={inputRef}
                type="text"
                aria-label="Ask about our furniture"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('chat.placeholder', 'Ask about our furniture...')}
                className="flex-1 border border-[var(--border)] bg-[#FAF7F2] rounded-md px-3 py-2 text-xs focus:outline-none focus:border-[var(--gold)] text-[var(--ink)] placeholder-[var(--muted)]/60"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[var(--ink)] text-[#FAF7F2] px-3.5 py-2 text-xs uppercase tracking-wider font-semibold hover:bg-[#3D3024] disabled:opacity-50 transition-colors duration-200 rounded-md"
              >
                {t('chat.send', 'Send')}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {showTrigger && (
        <div className="flex justify-end">
          {!isOpen && (
            <motion.button
              type="button"
              aria-label="Open chat assistant"
              aria-expanded={isOpen}
              whileHover={!shouldReduceMotion ? { scale: 1.05 } : undefined}
              whileTap={!shouldReduceMotion ? { scale: 0.95 } : undefined}
              onClick={() => setInternalIsOpen(true)}
              className="bg-[var(--ink)] hover:bg-[#3D3024] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-xl transition-colors duration-300 border border-white/20"
            >
              💬
            </motion.button>
          )}
        </div>
      )}
    </div>
  )
}

export default ChatWidget