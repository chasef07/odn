import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from '../Footer'

describe('Footer', () => {
  it('should render privacy and terms links', () => {
    render(<Footer />)

    const privacyLink = screen.getByRole('link', { name: /^privacy$/i })
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy')

    const termsLink = screen.getByRole('link', { name: /^terms$/i })
    expect(termsLink).toHaveAttribute('href', '/terms-of-service')
  })

  it('should render contact email with mailto link', () => {
    render(<Footer />)

    const emailLink = screen.getByRole('link', { name: /hello@onlinedoctornote.com/i })
    expect(emailLink).toHaveAttribute('href', 'mailto:hello@onlinedoctornote.com')
  })

  it('should render contact phone with tel link', () => {
    render(<Footer />)

    const phoneLink = screen.getByRole('link', { name: /917-300-8543/i })
    expect(phoneLink).toHaveAttribute('href', 'tel:917-300-8543')
  })

  it('should display phone hours', () => {
    render(<Footer />)

    expect(screen.getByText(/8am–8pm EST/i)).toBeInTheDocument()
  })

  it('should display copyright text with current year and HIPAA note', () => {
    render(<Footer />)

    const currentYear = new Date().getFullYear()
    expect(
      screen.getByText(new RegExp(`© ${currentYear} OnlineDoctorNote.com · HIPAA Compliant`, 'i'))
    ).toBeInTheDocument()
  })

  it('should render on a white background for readability', () => {
    const { container } = render(<Footer />)

    const footer = container.querySelector('footer')
    expect(footer).toHaveClass('bg-white')
  })

  it('should render Mail and Phone icons', () => {
    const { container } = render(<Footer />)

    // Mail and Phone icons from lucide-react render as SVG elements
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(2)
  })

  it('should render FAQ, Blog, and About nav links', () => {
    render(<Footer />)

    expect(screen.getByRole('link', { name: /^faq$/i })).toHaveAttribute('href', '/faq')
    expect(screen.getByRole('link', { name: /^blog$/i })).toHaveAttribute('href', '/blog')
    expect(screen.getByRole('link', { name: /^about$/i })).toHaveAttribute('href', '/about')
  })
})
