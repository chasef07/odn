import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from '../Footer'

describe('Footer', () => {
  it('should render footer links', () => {
    render(<Footer />)

    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /terms of service/i })).toBeInTheDocument()
  })

  it('should have correct href for privacy policy link', () => {
    render(<Footer />)

    const privacyLink = screen.getByRole('link', { name: /privacy policy/i })
    expect(privacyLink).toHaveAttribute('href', '/privacy-policy')
  })

  it('should have correct href for terms of service link', () => {
    render(<Footer />)

    const termsLink = screen.getByRole('link', { name: /terms of service/i })
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

    expect(screen.getByText(/8am–8pm EST everyday/i)).toBeInTheDocument()
  })

  it('should render HIPAA compliance badge image', () => {
    render(<Footer />)

    const hipaaImage = screen.getByAltText(/HIPAA Compliant - Health Insurance Portability and Accountability Act certified medical documentation service/i)
    expect(hipaaImage).toBeInTheDocument()
    expect(hipaaImage).toHaveAttribute('src', expect.stringContaining('Hipaa-Compliant-Spanish-medical-translator.png'))
  })

  it('should display copyright text with current year', () => {
    render(<Footer />)

    expect(screen.getByText(/© 2025 OnlineDoctorNote.com/i)).toBeInTheDocument()
  })

  it('should have proper accessibility with white text on dark background', () => {
    const { container } = render(<Footer />)

    const footer = container.querySelector('footer')
    expect(footer).toHaveClass('bg-[#001830]')

    // Check that parent containers have white text for proper contrast
    const textContainers = container.querySelectorAll('[class*="text-white"]')
    expect(textContainers.length).toBeGreaterThan(0)
  })

  it('should render Mail and Phone icons', () => {
    const { container } = render(<Footer />)

    // Mail and Phone icons from lucide-react render as SVG elements
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(2)
  })
})
