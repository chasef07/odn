'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, X, ArrowRight } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About Us' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/faq', label: 'FAQ' },
  { href: '/verify', label: 'Verify' },
  { href: '/blog', label: 'Blog' },
]

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  // Focus trap and keyboard handling for mobile menu
  useEffect(() => {
    if (!mobileMenuOpen) return

    // Focus the close button when menu opens
    closeButtonRef.current?.focus()

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    // Handle tab key for focus trap
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !mobileMenuRef.current) return

      const focusableElements = mobileMenuRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleTab)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleTab)
    }
  }, [mobileMenuOpen])

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white md:bg-white/80 md:backdrop-blur-xl">
      {/* Skip to main content link - for keyboard/screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:rounded-md focus:bg-[#009ed9] focus:px-4 focus:py-2 focus:text-white focus:ring-2 focus:ring-white focus:outline-none"
      >
        Skip to main content
      </a>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        {/* Text Logo */}
        <Link href="/" className="shrink-0">
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-[#009ed9]">Online</span>
            <span className="text-gray-900">DoctorNote</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <button
          onClick={() => router.push('/start')}
          className="hidden items-center gap-2 rounded-full bg-[#009ed9] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#00b4f5] md:flex"
        >
          Get Your Note
          <ArrowRight className="h-4 w-4" />
        </button>

        {/* Mobile Menu Button */}
        <button
          ref={closeButtonRef}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="relative z-50 rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile Menu - Full Screen Overlay */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="fixed inset-0 z-40 bg-white md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile menu"
        >
          <div className="flex h-full flex-col px-6 pt-20">
            {/* Navigation Links */}
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-4 py-4 text-xl font-medium text-gray-900 transition-colors hover:bg-gray-50"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* CTA Button */}
            <div className="mt-8">
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  router.push('/start')
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[#009ed9] px-6 py-4 text-lg font-medium text-white transition-colors hover:bg-[#00b4f5]"
              >
                Get Your Note
                <ArrowRight className="h-5 w-5" />
              </button>
              <p className="mt-4 text-center text-sm text-gray-500">
                <span className="font-semibold text-gray-900">$24.95</span> · Money-back guarantee
              </p>
            </div>

            {/* Contact Info at Bottom */}
            <div className="mt-auto pb-8 text-center">
              <p className="text-sm text-gray-500">Questions? Call us</p>
              <a href="tel:917-300-8543" className="text-lg font-medium text-gray-900">
                917-300-8543
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
