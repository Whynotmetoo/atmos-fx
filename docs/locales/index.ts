import { en, type TranslationMessages } from './en'
import { es } from './es'
import { ja } from './ja'
import { ptBR } from './pt-BR'
import { zhCN } from './zh-CN'

export type Language = 'en' | 'zh-CN' | 'ja' | 'es' | 'pt-BR'

export const TRANSLATIONS = {
  en,
  'zh-CN': zhCN,
  ja,
  es,
  'pt-BR': ptBR,
} satisfies Record<Language, TranslationMessages>

export const LANGUAGE_SHORT_LABELS = {
  en: 'EN',
  'zh-CN': 'ZH',
  ja: 'JA',
  es: 'ES',
  'pt-BR': 'PT-BR',
} satisfies Record<Language, string>

export function resolveLanguage(language: string): Language {
  const normalizedLanguage = language.toLowerCase()

  if (normalizedLanguage.startsWith('zh')) return 'zh-CN'
  if (normalizedLanguage.startsWith('ja')) return 'ja'
  if (normalizedLanguage.startsWith('es')) return 'es'
  if (normalizedLanguage.startsWith('pt')) return 'pt-BR'
  return 'en'
}
