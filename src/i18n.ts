import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import te from './locales/te.json'
import hi from './locales/hi.json'

const savedLanguage = typeof window !== 'undefined' ? window.localStorage.getItem('atelier-language') : null
const initialLanguage = savedLanguage === 'te' || savedLanguage === 'hi' ? savedLanguage : 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    te: { translation: te },
    hi: { translation: hi },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
})

export default i18n
