import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

interface Message {
  role: 'user' | 'bot'
  text: string
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-bot`
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function ChatWidget() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Hi! Ask me about our furniture — stock, prices, materials, anything.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' })
  }, [messages, shouldReduceMotion])

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
      const waPhone = '919014996929' // shop WhatsApp contact (digits only)
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: `I'm having trouble connecting right now — feel free to reach out on WhatsApp instead: https://wa.me/${waPhone}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-28 md:right-8 z-40 font-inter">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="Atelier chat assistant"
            initial={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.9, y: 15 }}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 20, stiffness: 250 }}
            className="w-80 h-96 bg-[#FAF7F2] rounded-none shadow-2xl flex flex-col overflow-hidden border border-[#E4DDD1] mb-4"
          >
            {/* Header */}
            <div className="bg-[#4A3728] text-[#FAF7F2] px-4 py-3.5 flex justify-between items-center border-b border-[#E4DDD1]/20">
              <div className="flex flex-col">
                <span className="font-semibold text-xs tracking-wider uppercase">Atelier Assistant</span>
                <span className="text-[9px] text-[#B8874B] uppercase tracking-widest">Always Online</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsOpen(false)} 
                aria-label="Close chat assistant"
                className="text-[#FAF7F2]/80 hover:text-[#B8874B] transition-colors focus:outline-none text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF7F2]"
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
            >
              {messages.map((msg, i) => {
                const hasWaLink = /https:\/\/wa\.me\/[0-9]+/.test(msg.text)
                return (
                  <div
                    key={i}
                    className={`text-xs p-3 rounded-none max-w-[85%] leading-relaxed border ${
                      msg.role === 'user'
                        ? 'bg-[#4A3728] text-[#FAF7F2] border-[#4A3728] ml-auto'
                        : 'bg-[#E4DDD1]/40 text-[#2B2420] border-[#E4DDD1] mr-auto'
                    }`}
                  >
                    {hasWaLink ? (
                      <div>
                        {msg.text.replace(/https:\/\/wa\.me\/[0-9]+/, '').trim()}
                        <div className="mt-2">
                          <a href={msg.text.match(/https:\/\/wa\.me\/[0-9]+/)?.[0]} target="_blank" rel="noreferrer" className="text-[#4A3728] font-semibold underline">
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
                <div className="text-xs p-3 rounded-none bg-[#E4DDD1]/40 text-[#6B7259] border border-[#E4DDD1] max-w-[85%] italic">
                  Typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={sendMessage} className="p-3 border-t border-[#E4DDD1] bg-white flex gap-2">
              <input
                type="text"
                aria-label="Ask about our furniture"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('chat.placeholder')}
                className="flex-1 border border-[#E4DDD1] bg-[#FAF7F2] rounded-none px-3 py-2 text-xs focus:outline-none focus:border-[#B8874B] text-[#2B2420] placeholder-[#6B7259]/50"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-[#4A3728] text-[#FAF7F2] px-4 py-2 text-xs uppercase tracking-wider font-semibold hover:bg-[#2B2420] disabled:opacity-50 transition-colors duration-200"
              >
                {t('chat.send')}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end">
        {!isOpen && (
          <motion.button
            type="button"
            aria-label="Open chat assistant"
            aria-expanded={isOpen}
            whileHover={!shouldReduceMotion ? { scale: 1.05 } : undefined}
            whileTap={!shouldReduceMotion ? { scale: 0.95 } : undefined}
            onClick={() => setIsOpen(true)}
            className="bg-[#4A3728] hover:bg-[#2B2420] text-[#FAF7F2] w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-colors duration-300 border border-[#B8874B]/20"
          >
            💬
          </motion.button>
        )}
      </div>
    </div>
  )
}

export default ChatWidget