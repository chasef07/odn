'use client'

import { useEffect, useRef, useState, type ComponentType, type MouseEvent } from 'react'
import Link from 'next/link'
import { Check, ChevronDown } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { switchLocalePath, type Locale } from '@/lib/i18n'
import { useI18n } from './I18nProvider'

function keepSearchAndHash(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (window.location.search || window.location.hash) {
    event.preventDefault()
    window.location.assign(`${href}${window.location.search}${window.location.hash}`)
  }
}

function UsFlag() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full">
      <rect width="24" height="24" fill="#fff" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={i * (24 / 6.5)} width="24" height={24 / 13} fill="#e0303d" />
      ))}
      <rect width="11" height={(24 / 13) * 7} fill="#1f3c88" />
      {[2.2, 5.5, 8.8].flatMap((x) =>
        [2.4, 6.2, 10].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="#fff" />)
      )}
    </svg>
  )
}

function SpainFlag() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-full w-full">
      <rect width="24" height="24" fill="#c8102e" />
      <rect y="6" width="24" height="12" fill="#ffc400" />
    </svg>
  )
}

const LANGUAGES: { locale: Locale; name: string; hrefLang: string; Flag: ComponentType }[] = [
  { locale: 'en', name: 'English', hrefLang: 'en-US', Flag: UsFlag },
  { locale: 'es', name: 'Español', hrefLang: 'es-US', Flag: SpainFlag },
]

function FlagDot({ Flag }: { Flag: ComponentType }) {
  return (
    <span className="ring-border inline-flex h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1">
      <Flag />
    </span>
  )
}

export function LanguageMenu({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find((language) => language.locale === locale) ?? LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={locale === 'es' ? 'Idioma: Español' : 'Language: English'}
        className="border-border text-foreground hover:bg-muted focus-visible:ring-primary/40 inline-flex h-11 items-center gap-1.5 rounded-full border bg-white pr-2 pl-1.5 text-sm font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:outline-none lg:h-9"
      >
        <FlagDot Flag={current.Flag} />
        {current.name}
        <ChevronDown
          className={`text-muted-foreground h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul className="border-border/60 absolute right-0 z-50 mt-2 w-44 rounded-2xl border bg-white p-1.5 shadow-lg">
          {LANGUAGES.map((language) => {
            const isCurrent = language.locale === locale
            const href = switchLocalePath(pathname, language.locale)
            return (
              <li key={language.locale}>
                <Link
                  href={href}
                  hrefLang={language.hrefLang}
                  lang={language.locale}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={(event) => {
                    setOpen(false)
                    onNavigate?.()
                    if (isCurrent) {
                      event.preventDefault()
                      return
                    }
                    keepSearchAndHash(event, href)
                  }}
                  className="text-foreground hover:bg-muted focus-visible:bg-muted flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium focus-visible:outline-none"
                >
                  <FlagDot Flag={language.Flag} />
                  <span className="flex-1">{language.name}</span>
                  {isCurrent && <Check className="text-primary h-4 w-4" aria-hidden="true" />}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
