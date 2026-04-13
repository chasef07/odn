import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const posts: Record<string, { title: string; date: string; readTime: string; content: string }> = {
  'when-do-you-need-a-doctors-note': {
    title: "When Do You Need a Doctor's Note for Work or School?",
    date: 'January 15, 2026',
    readTime: '4 min read',
    content: `
Whether you're calling out sick from work or missing class, you may be wondering if you need a doctor's note. The answer depends on your employer's policy, your school's attendance requirements, and how long you've been absent.

## When Employers Require a Doctor's Note

Most employers have their own attendance policies. Generally, you can expect to need documentation in these situations:

- **Absences of three or more consecutive days.** This is the most common threshold. If you're out for a few days, most companies will ask for proof of illness.
- **Frequent short absences.** If you've had several single-day call-outs in a short period, your employer may start requesting notes for each one.
- **Before or after a holiday or vacation.** Some workplaces flag absences on days adjacent to scheduled time off.
- **FMLA or disability-related leave.** Longer medical leave almost always requires documentation from a healthcare provider.

It's worth checking your employee handbook or asking HR about your company's specific requirements.

## When Schools Require a Doctor's Note

Schools and universities typically have stricter documentation requirements. Many require a note for any absence that falls on an exam day, and some require notes after two or more consecutive absences. College professors may also have their own policies outlined in the course syllabus.

For K-12 students, the school district usually sets the rules. Parents should check with the front office to understand what's needed.

## What Should a Doctor's Note Include?

A valid doctor's note generally includes:

- The date of the medical evaluation
- The dates the patient is excused from work or school
- The healthcare provider's name, credentials, and contact information
- A professional letterhead or clinic information

Importantly, a doctor's note does **not** need to include a specific diagnosis. Your medical details are protected by HIPAA, and your employer or school only needs to know that you were seen by a provider and are cleared to return.

## How to Get a Doctor's Note Quickly

If you can't get to a clinic in person, telehealth services offer a convenient alternative. Many providers can evaluate your situation and issue a note the same day — sometimes in minutes. This is especially helpful for common illnesses like colds, flu, or stomach bugs where an in-person visit isn't strictly necessary.

Online doctor's note services have become increasingly popular because they save time, cost less than an office visit, and can be completed from the comfort of your home.
    `,
  },

  'understanding-hipaa-and-your-medical-records': {
    title: 'Understanding HIPAA and Your Medical Records',
    date: 'January 10, 2026',
    readTime: '5 min read',
    content: `
HIPAA — the Health Insurance Portability and Accountability Act — is a federal law that protects your medical information. If you've ever wondered what your employer can and can't ask about your health, HIPAA is the reason those boundaries exist.

## What Does HIPAA Actually Protect?

HIPAA applies to "covered entities," which includes doctors, hospitals, insurance companies, and their business associates. Under HIPAA, your protected health information (PHI) includes:

- Medical diagnoses and treatment records
- Lab results and prescription history
- Mental health records
- Billing and insurance information
- Any information that can identify you as a patient

This means your doctor cannot share your medical records with your employer, your school, or anyone else without your written consent.

## What Your Employer Can and Can't Ask

Here's where it gets practical. Your employer **can** ask for a doctor's note confirming you were seen by a provider and the dates you're excused. However, they **cannot** demand to know your specific diagnosis, the medications you're taking, or the details of your treatment.

If your employer pressures you for medical details beyond what's on your doctor's note, you have the right to decline. You can simply say the information is private and protected under HIPAA.

## HIPAA and Doctor's Notes

A properly written doctor's note respects HIPAA by including only the minimum necessary information:

- Confirmation that a medical evaluation took place
- The dates of recommended absence
- When the patient is cleared to return
- Provider contact information for verification

It should **not** include your diagnosis, symptoms, or treatment plan unless you specifically authorize it.

## Your Rights Under HIPAA

As a patient, you have the right to:

- **Access your own records.** You can request copies of your medical records at any time.
- **Know who has seen your information.** Healthcare providers must keep a log of disclosures.
- **Request corrections.** If something in your record is wrong, you can ask for it to be fixed.
- **File a complaint.** If you believe your privacy has been violated, you can file a complaint with the U.S. Department of Health and Human Services.

Understanding your HIPAA rights helps you navigate situations where your medical privacy might be at risk — whether it's dealing with an employer, a school, or an insurance company.
    `,
  },

  'telehealth-vs-in-person-visits': {
    title: 'Telehealth vs. In-Person Doctor Visits: What You Need to Know',
    date: 'January 5, 2026',
    readTime: '3 min read',
    content: `
Telehealth has become a mainstream way to see a doctor, but it's not always clear when a virtual visit makes sense versus going to a clinic in person. Here's a straightforward comparison to help you decide.

## When Telehealth Makes Sense

Virtual doctor visits work well for situations that don't require a physical examination. Common use cases include:

- **Cold, flu, and minor illness.** If you have typical symptoms and just need a diagnosis or doctor's note, telehealth is fast and effective.
- **Prescription refills.** Many providers can renew routine prescriptions through a video or phone consultation.
- **Mental health consultations.** Therapy and psychiatry appointments are often conducted virtually.
- **Follow-up visits.** If your doctor just needs to check in on your progress, a virtual visit saves a trip.
- **Doctor's notes for work or school.** Getting documentation for a minor illness or absence is one of the most common telehealth requests.

## When You Should Go In Person

Some situations genuinely require hands-on care:

- **Injuries.** Sprains, fractures, cuts that may need stitches — these need to be examined physically.
- **Chest pain or difficulty breathing.** Any potential emergency should be handled in person or at an ER.
- **Skin conditions.** While some can be assessed via photo, many dermatological issues benefit from an in-person look.
- **Lab work or imaging.** Blood tests, X-rays, and similar diagnostics require a physical visit.

## Cost Comparison

One of the biggest advantages of telehealth is cost. A typical in-person doctor visit costs $150 to $300 without insurance. Telehealth visits are generally much cheaper, often ranging from $20 to $75. For people without insurance or with high-deductible plans, the savings are significant.

## Are Telehealth Doctor's Notes Legitimate?

Yes. Doctor's notes issued through telehealth are just as valid as those from an in-person visit. As long as the note comes from a licensed healthcare provider, employers and schools accept them. The key is that a real physician reviews your situation and signs off on the documentation.

## The Bottom Line

Telehealth isn't a replacement for all medical care, but for many common situations — especially getting a doctor's note — it's faster, cheaper, and more convenient than sitting in a waiting room.
    `,
  },

  'mental-health-days-at-work': {
    title: 'Taking Mental Health Days: A Guide for Employees',
    date: 'December 28, 2025',
    readTime: '4 min read',
    content: `
Taking time off for your mental health is just as valid as taking time off for a physical illness. But many employees aren't sure how to approach it, what to say to their employer, or whether they need documentation. Here's what you should know.

## Mental Health Days Are Legitimate

Burnout, anxiety, depression, and overwhelming stress are real health concerns. The World Health Organization officially recognizes burnout as an occupational phenomenon, and mental health conditions are protected under laws like the ADA and FMLA.

You don't need to justify taking a mental health day any more than you'd justify staying home with the flu. Your wellbeing directly affects your ability to work, and taking a day to reset can prevent longer-term problems.

## What to Tell Your Employer

You're not required to share the specifics of your health situation. Here are some straightforward ways to request time off:

- "I'm not feeling well and need to take a sick day."
- "I have a health matter I need to attend to."
- "I need to take a personal day for medical reasons."

In most cases, these are sufficient. Your employer doesn't have the right to demand details about your condition. If they require a doctor's note, the note only needs to confirm that you were evaluated and the dates you're excused — not your diagnosis.

## When You Might Need a Doctor's Note

Some workplaces require documentation for any sick day, while others only ask for notes after multiple consecutive days off. Check your company's attendance policy to know what's expected.

If you do need a note, telehealth services make it easy to get one quickly. A licensed provider can evaluate your situation and issue documentation without requiring an in-person visit.

## Know Your Rights

Several laws protect employees who need time off for mental health:

- **FMLA (Family and Medical Leave Act):** Provides up to 12 weeks of unpaid, job-protected leave per year for serious health conditions, including mental health.
- **ADA (Americans with Disabilities Act):** Requires employers to provide reasonable accommodations for mental health conditions.
- **State laws:** Many states have additional protections and paid sick leave that covers mental health.

## Tips for Taking Care of Yourself

- **Don't wait until you're in crisis.** A proactive day off is better than a reactive breakdown.
- **Disconnect fully.** Don't check emails or Slack. The point is to recharge.
- **Do what actually helps you.** Whether that's sleeping in, going for a walk, or seeing a therapist — make the day count.
- **Don't feel guilty.** Taking care of your mental health makes you a better employee, not a worse one.

Taking a mental health day isn't a sign of weakness. It's a practical step toward staying healthy and performing your best at work.
    `,
  },
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = posts[slug]
  if (!post) return { title: 'Blog Post Not Found' }
  return {
    title: `${post.title} - Online Doctor's Note Blog`,
    description: post.content.slice(0, 160).trim(),
  }
}

export function generateStaticParams() {
  return Object.keys(posts).map((slug) => ({ slug }))
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = posts[slug]

  if (!post) notFound()

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/blog"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>

          <div className="mb-8 flex items-center gap-3 text-sm text-gray-500">
            <time>{post.date}</time>
            <span className="text-gray-300">|</span>
            <span>{post.readTime}</span>
          </div>

          <h1 className="mb-8 text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl">
            {post.title}
          </h1>

          <article
            className="space-y-5 text-base leading-relaxed text-gray-600 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-gray-900 [&_li]:ml-5 [&_li]:list-disc [&_li]:py-0.5 [&_strong]:font-semibold [&_strong]:text-gray-900 [&_ul]:space-y-1"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(post.content) }}
          />

          {/* CTA */}
          <div className="mt-12 rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center md:p-8">
            <p className="mb-1 text-lg font-semibold text-gray-900">Need a doctor&apos;s note?</p>
            <p className="mb-4 text-sm text-gray-600">
              Get one from a board-certified physician in minutes.
            </p>
            <Link
              href="/start"
              className="inline-flex items-center gap-2 rounded-full bg-[#009ed9] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#00b4f5]"
            >
              Get Your Note
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatMarkdown(content: string): string {
  return content
    .trim()
    .split('\n\n')
    .map((block) => {
      block = block.trim()
      if (!block) return ''

      if (block.startsWith('## ')) {
        return `<h2>${escapeHtml(block.slice(3))}</h2>`
      }

      if (block.startsWith('- ')) {
        const items = block.split('\n').map((line) => {
          const text = line.replace(/^- /, '')
          return `<li>${inlineFormat(text)}</li>`
        })
        return `<ul>${items.join('')}</ul>`
      }

      return `<p>${inlineFormat(block)}</p>`
    })
    .join('')
}

function inlineFormat(text: string): string {
  // Escape all HTML first
  let escaped = escapeHtml(text)
  // Then replace the escaped markdown patterns with HTML tags
  // Since we've already escaped, **foo** becomes **foo** (with escaped special chars if any)
  // We can safely wrap these with tags
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>')
  return escaped
}
