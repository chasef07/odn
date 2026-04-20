# Email Templates

This directory contains React Email components for sending **modern, beautiful transactional emails**.

## Overview

We use [React Email](https://react.email/) with **Tailwind CSS** to build responsive, production-ready email templates using React components. This provides better maintainability, type safety, and a live preview environment.

### Design Philosophy

- **Modern & Clean**: 2025 design standards with gradients, rounded corners, and generous spacing
- **Mobile-First**: Responsive design that looks great on all devices
- **Empathetic**: Warm colors and friendly tone, especially for sensitive communications
- **Accessible**: High contrast ratios and readable typography

## Available Templates

### DenialEmail

A modern, empathetic email sent when a doctor denies a submission and issues a refund.

**Design Features:**

- 🎨 Indigo-to-purple gradient hero section
- 💚 Prominent emerald-green refund card with checkmark icon
- 📋 Step-by-step "What's Next" timeline
- 🔘 Dual action buttons (Contact Support + View FAQs)
- 📱 Fully responsive mobile design

**Props:**

- `patientName` (string): Patient's full name
- `denialReason` (string): Reason for denial - "Legal", "7+ days", or "Other"
- `refundAmount` (number): Refund amount in dollars (e.g., 24.95)

**Example:**

```tsx
import { DenialEmail } from '@/emails/DenialEmail'

const email = DenialEmail({
  patientName: 'John Doe',
  denialReason: 'Legal',
  refundAmount: 24.95,
})
```

## Development

### Preview Emails

To preview all email templates in a browser with hot reload:

```bash
npm run email
```

This will start the React Email development server at `http://localhost:3000`.

### Adding New Templates

1. Create a new `.tsx` file in this directory
2. Import React Email components from `@react-email/components`
3. Define your component with TypeScript props
4. Export as default
5. Use the `render()` function in `src/lib/email.ts` to convert to HTML

**Example:**

```tsx
// src/emails/WelcomeEmail.tsx
import { Body, Container, Html, Text } from '@react-email/components'

interface WelcomeEmailProps {
  name: string
}

export const WelcomeEmail = ({ name }: WelcomeEmailProps) => {
  return (
    <Html>
      <Body>
        <Container>
          <Text>Welcome {name}!</Text>
        </Container>
      </Body>
    </Html>
  )
}

export default WelcomeEmail
```

Then use it in your email sending function:

```typescript
// src/lib/email.ts
import { render } from '@react-email/render'
import WelcomeEmail from '@/emails/WelcomeEmail'

const emailHtml = await render(WelcomeEmail({ name: 'John' }))
```

## Testing

Email templates are tested in `src/lib/__tests__/email.test.ts`. The tests verify:

- React Email render is called correctly
- Email parameters are passed to Resend
- Error handling works as expected

## Security

React Email automatically escapes HTML content in text nodes, preventing XSS vulnerabilities. No manual HTML escaping is needed when using React Email components.

## Dependencies

- `@react-email/components`: Core React Email components
- `@react-email/render`: Converts React components to HTML strings
- `react-email`: CLI for previewing emails (dev dependency)

## Resources

- [React Email Documentation](https://react.email/docs)
- [Component Examples](https://react.email/examples)
- [Resend Integration](https://resend.com/docs/send-with-react)
