# Online Doctor's Note

A Next.js application for generating legitimate online doctor's notes with a streamlined multi-step form process and secure payment integration.

## Overview

This application provides a user-friendly interface for individuals to obtain doctor's notes for work or school absences. The form collects necessary medical and personal information, validates it against business rules, and processes payments through Stripe.

## Features

- **Multi-step Form Flow**: 10-11 step guided form with progress tracking
- **Smart Validation**: Real-time form validation with Zod schemas
- **Date Rules**: Enforces 7-day maximum absence period, 5-day lookback limit
- **Guardian Support**: Conditional forms for minors requiring guardian information
- **Stripe Integration**: Secure payment processing ($29.99)
- **Mobile Responsive**: Optimized UI for all device sizes
- **Form Persistence**: Auto-saves progress to localStorage
- **Comprehensive Testing**: 223+ automated tests with 80%+ coverage

## Tech Stack

- **Framework**: Next.js 15.5.5 (App Router, Turbopack)
- **Language**: TypeScript 5
- **UI Library**: React 19.1.0
- **Styling**: Tailwind CSS 4
- **Components**: Radix UI + shadcn/ui
- **Forms**: react-hook-form + Zod validation
- **Payments**: Stripe (API v2025-09-30.clover)
- **Testing**: Vitest + Testing Library
- **CI/CD**: GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Stripe account (for payment processing)

### Installation

```bash
# Clone the repository
git clone https://github.com/chasef07/onlinedoctornote.git
cd onlinedoctornote

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your Stripe keys
```

### Environment Variables

Create a `.env.local` file with:

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_PAYMENT_AMOUNT=2999
```

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Form Flow

1. **State Selection** - Choose operating state
2. **Recipient** - Who is the note for? (myself/someone else)
3. **Patient Info** - Name, date of birth
4. **Guardian Info** - Required if note is for someone else
5. **Contact Info** - Email and phone number
6. **Note Purpose** - Work, school, both, or other
7. **Absence Dates** - First day off, last day off, return date
8. **Absence Reason** - Illness, injury, medical appointment, etc.
9. **Symptoms** - Select applicable symptoms
10. **Additional Info** - Optional notes
11. **Review** - Confirm all information
12. **Payment** - Secure Stripe checkout
13. **Confirmation** - Success page

## Business Rules

### Date Validation

- First day off cannot be more than 7 days in the past
- Maximum absence period: 7 consecutive days
- All dates must be valid calendar dates

### Form Validation

- Names: Letters, spaces, hyphens, apostrophes only (max 50 chars)
- Email: Valid email format, converted to lowercase
- Phone: Exactly 10 digits, formatted as (XXX) XXX-XXXX
- Date of Birth: Must be between 1900-01-01 and today
- All required fields must be completed before proceeding

## Testing

The project has comprehensive test coverage:

- **223 tests** across all critical components
- **Unit tests**: Validators, utilities, schemas
- **Integration tests**: API routes with mocked Stripe
- **Coverage**: 80%+ across the codebase

See [TESTING.md](./TESTING.md) for detailed testing documentation.

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- date-validators.test.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Project Structure

```
src/
├── app/                      # Next.js app router pages
│   ├── api/                 # API routes
│   │   ├── create-payment-intent/
│   │   └── verify-payment/
│   ├── [form-pages]/        # Multi-step form pages
│   └── layout.tsx           # Root layout
├── components/              # React components
│   ├── form/               # Form-specific components
│   └── ui/                 # shadcn/ui components
├── lib/                    # Utilities and business logic
│   ├── validation-schemas.ts  # Zod schemas
│   ├── date-validators.ts     # Date validation logic
│   ├── phone-utils.ts         # Phone formatting
│   ├── age-validators.ts      # Age validation
│   ├── form-storage.ts        # localStorage helpers
│   └── form-constants.ts      # Static data
└── __tests__/              # Test files
```

## API Routes

### POST /api/create-payment-intent

Creates a Stripe PaymentIntent for the fixed amount ($29.99).

**Response:**

```json
{
  "clientSecret": "pi_...",
  "amount": 2999
}
```

### POST /api/verify-payment

Verifies a payment's status with Stripe.

**Request:**

```json
{
  "paymentIntentId": "pi_..."
}
```

**Response:**

```json
{
  "status": "succeeded",
  "amount": 2999
}
```

## CI/CD

The project uses GitHub Actions for continuous integration:

- **Tests**: Runs on every push and pull request
- **Claude Code Review**: Automated code reviews on PRs
- **Claude PR Assistant**: Available via `@claude` mentions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## Documentation

- [Testing Guide](./TESTING.md) - Comprehensive testing documentation
- [Claude Code Guide](./CLAUDE.md) - Information for Claude Code AI

## License

This project is private and proprietary.

## Support

For issues or questions, please open an issue on GitHub.
