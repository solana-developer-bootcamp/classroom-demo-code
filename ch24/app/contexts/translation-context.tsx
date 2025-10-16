"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { type Language, type TranslationKey, translations } from "@/lib/translations"

type TranslationContextType = {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey) => string
}

// next-i18n

// 部署
// 1. 服务器 亚马逊 阿里云
// 优点：便宜
// 缺点：麻烦
// nginx 反向代理 pm2 托管
// 2. serverless vercel（nextjs母公司）
// 优点：简单
// 缺点：贵
// 日志、环境（测试环境/生产环境/开发环境）、回滚、CDN、埋点、异常监控

const TranslationContext = createContext<TranslationContextType | undefined>(undefined)

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en")

  // Load language preference from localStorage on client side
  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language | null
    if (savedLanguage && (savedLanguage === "en" || savedLanguage === "zh")) {
      setLanguage(savedLanguage)
    }
  }, [])

  // Save language preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("language", language)
  }, [language])

  const t = (key: TranslationKey): string => {
    return translations[language][key] || key
  }

  return <TranslationContext.Provider value={{ language, setLanguage, t }}>{children}</TranslationContext.Provider>
}

export function useTranslation() {
  const context = useContext(TranslationContext)
  if (context === undefined) {
    throw new Error("useTranslation must be used within a TranslationProvider")
  }
  return context
}
