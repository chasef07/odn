import Header from '@/components/Header'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'OnlineDoctorNote privacy policy. Learn how we protect your personal health information and comply with HIPAA regulations.',
  alternates: {
    canonical: '/privacy-policy',
  },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="mb-6 text-4xl font-bold">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated March 27, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <p className="leading-relaxed">
              This Privacy Notice for ODN LLC (doing business as
              OnlineDoctorNote.com) (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), describes
              how and why we might access, collect, store, use, and/or share (&quot;process&quot;)
              your personal information when you use our services (&quot;Services&quot;), including
              when you:
            </p>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                Visit our website at{' '}
                <a
                  href="http://www.onlinedoctornote.com"
                  className="text-primary hover:underline"
                >
                  http://www.onlinedoctornote.com
                </a>
                , or any website of ours that links to this Privacy Notice
              </li>
              <li>
                Use OnlineDoctorNote.com. A Telehealth service provider with a focus on providing
                consumers with a certified doctor&apos;s note for their employer or school to verify
                an absence.
              </li>
              <li>
                Engage with us in other related ways, including any sales, marketing, or events
              </li>
            </ul>
            <p className="mt-4 leading-relaxed">
              <strong>Questions or concerns?</strong> Reading this Privacy Notice will help you
              understand your privacy rights and choices. We are responsible for making decisions
              about how your personal information is processed. If you do not agree with our
              policies and practices, please do not use our Services. If you still have any
              questions or concerns, please contact us at{' '}
              <a href="mailto:hello@onlinedoctornote.com" className="text-primary hover:underline">
                hello@onlinedoctornote.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold">Summary of Key Points</h2>
            <div className="space-y-4 text-sm leading-relaxed">
              <p>
                This summary provides key points from our Privacy Notice, but you can find out more
                details about any of these topics by using our table of contents below to find the
                section you are looking for.
              </p>

              <div>
                <p className="font-semibold">What personal information do we process?</p>
                <p>
                  When you visit, use, or navigate our Services, we may process personal
                  information depending on how you interact with us and the Services, the choices
                  you make, and the products and features you use.
                </p>
              </div>

              <div>
                <p className="font-semibold">Do we process any sensitive personal information?</p>
                <p>
                  Some of the information may be considered &quot;special&quot; or
                  &quot;sensitive&quot; in certain jurisdictions. We may process sensitive personal
                  information when necessary with your consent or as otherwise permitted by
                  applicable law.
                </p>
              </div>

              <div>
                <p className="font-semibold">Do we collect any information from third parties?</p>
                <p>We do not collect any information from third parties.</p>
              </div>

              <div>
                <p className="font-semibold">How do we process your information?</p>
                <p>
                  We process your information to provide, improve, and administer our Services,
                  communicate with you, for security and fraud prevention, and to comply with law.
                  We may also process your information for other purposes with your consent.
                </p>
              </div>

              <div>
                <p className="font-semibold">
                  In what situations and with which parties do we share personal information?
                </p>
                <p>We may share information in specific situations and with specific third parties.</p>
              </div>

              <div>
                <p className="font-semibold">How do we keep your information safe?</p>
                <p>
                  We have adequate organizational and technical processes and procedures in place to
                  protect your personal information. However, no electronic transmission over the
                  internet or information storage technology can be guaranteed to be 100% secure.
                </p>
              </div>

              <div>
                <p className="font-semibold">What are your rights?</p>
                <p>
                  Depending on where you are located geographically, the applicable privacy law may
                  mean you have certain rights regarding your personal information.
                </p>
              </div>

              <div>
                <p className="font-semibold">How do you exercise your rights?</p>
                <p>
                  The easiest way to exercise your rights is by contacting us at{' '}
                  <a
                    href="mailto:hello@onlinedoctornote.com"
                    className="text-primary hover:underline"
                  >
                    hello@onlinedoctornote.com
                  </a>
                  . We will consider and act upon any request in accordance with applicable data
                  protection laws.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold">Table of Contents</h2>
            <ol className="ml-6 list-decimal space-y-2">
              <li>
                <a href="#section-1" className="text-primary hover:underline">
                  What Information Do We Collect?
                </a>
              </li>
              <li>
                <a href="#section-2" className="text-primary hover:underline">
                  How Do We Process Your Information?
                </a>
              </li>
              <li>
                <a href="#section-3" className="text-primary hover:underline">
                  When and With Whom Do We Share Your Personal Information?
                </a>
              </li>
              <li>
                <a href="#section-4" className="text-primary hover:underline">
                  Do We Use Cookies and Other Tracking Technologies?
                </a>
              </li>
              <li>
                <a href="#section-5" className="text-primary hover:underline">
                  Do We Offer Artificial Intelligence-Based Products?
                </a>
              </li>
              <li>
                <a href="#section-6" className="text-primary hover:underline">
                  How Long Do We Keep Your Information?
                </a>
              </li>
              <li>
                <a href="#section-7" className="text-primary hover:underline">
                  How Do We Keep Your Information Safe?
                </a>
              </li>
              <li>
                <a href="#section-8" className="text-primary hover:underline">
                  Do We Collect Information From Minors?
                </a>
              </li>
              <li>
                <a href="#section-9" className="text-primary hover:underline">
                  What Are Your Privacy Rights?
                </a>
              </li>
              <li>
                <a href="#section-10" className="text-primary hover:underline">
                  Controls for Do-Not-Track Features
                </a>
              </li>
              <li>
                <a href="#section-11" className="text-primary hover:underline">
                  Do United States Residents Have Specific Privacy Rights?
                </a>
              </li>
              <li>
                <a href="#section-12" className="text-primary hover:underline">
                  Do We Make Updates to This Notice?
                </a>
              </li>
              <li>
                <a href="#section-13" className="text-primary hover:underline">
                  How Can You Contact Us About This Notice?
                </a>
              </li>
              <li>
                <a href="#section-14" className="text-primary hover:underline">
                  How Can You Review, Update, or Delete the Data We Collect From You?
                </a>
              </li>
            </ol>
          </section>

          <section id="section-1">
            <h2 className="mb-4 text-2xl font-bold">1. What Information Do We Collect?</h2>
            <h3 className="mb-3 text-xl font-semibold">Personal information you disclose to us</h3>
            <p className="mb-3 italic">
              <strong>In Short:</strong> We collect personal information that you provide to us.
            </p>
            <p className="mb-4">
              We collect personal information that you voluntarily provide to us when you register
              on the Services, express an interest in obtaining information about us or our products
              and Services, when you participate in activities on the Services, or otherwise when
              you contact us.
            </p>

            <p className="mb-2 font-semibold">Personal Information Provided by You.</p>
            <p className="mb-2">
              The personal information that we collect depends on the context of your interactions
              with us and the Services, the choices you make, and the products and features you use.
              The personal information we collect may include the following:
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>names</li>
              <li>phone numbers</li>
              <li>email addresses</li>
              <li>mailing addresses</li>
              <li>contact preferences</li>
              <li>contact or authentication data</li>
              <li>billing addresses</li>
              <li>debit/credit card numbers</li>
            </ul>

            <p className="mb-2 mt-4 font-semibold">Sensitive Information.</p>
            <p className="mb-2">
              When necessary, with your consent or as otherwise permitted by applicable law, we
              process the following categories of sensitive information:
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>health data</li>
              <li>financial data</li>
            </ul>

            <p className="mb-2 mt-4 font-semibold">Payment Data.</p>
            <p className="mb-4">
              We may collect data necessary to process your payment if you choose to make purchases,
              such as your payment instrument number, and the security code associated with your
              payment instrument. All payment data is handled and stored by Stripe. You may find
              their privacy notice at{' '}
              <a href="https://stripe.com/privacy" className="text-primary hover:underline">
                https://stripe.com/privacy
              </a>
              .
            </p>

            <p className="mb-4">
              All personal information that you provide to us must be true, complete, and accurate,
              and you must notify us of any changes to such personal information.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold">Information automatically collected</h3>
            <p className="mb-3 italic">
              <strong>In Short:</strong> Some information — such as your Internet Protocol (IP)
              address and/or browser and device characteristics — is collected automatically when
              you visit our Services.
            </p>
            <p className="mb-4">
              We automatically collect certain information when you visit, use, or navigate the
              Services. This information does not reveal your specific identity but may include
              device and usage information, such as your IP address, browser and device
              characteristics, operating system, language preferences, referring URLs, device name,
              country, location, and information about how and when you use our Services.
            </p>

            <p className="mb-2">The information we collect includes:</p>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                <strong>Log and Usage Data.</strong> Service-related, diagnostic, usage, and
                performance information our servers automatically collect when you access or use our
                Services.
              </li>
              <li>
                <strong>Device Data.</strong> Information about your computer, phone, tablet, or
                other device you use to access the Services.
              </li>
              <li>
                <strong>Location Data.</strong> Information about your device&apos;s location, which
                can be either precise or imprecise.
              </li>
            </ul>
          </section>

          <section id="section-2">
            <h2 className="mb-4 text-2xl font-bold">2. How Do We Process Your Information?</h2>
            <p className="mb-3 italic">
              <strong>In Short:</strong> We process your information to provide, improve, and
              administer our Services, communicate with you, for security and fraud prevention, and
              to comply with law.
            </p>
            <p className="mb-2">
              We process your personal information for a variety of reasons, depending on how you
              interact with our Services, including:
            </p>
            <ul className="ml-6 list-disc space-y-2">
              <li>To facilitate account creation and authentication and manage user accounts</li>
              <li>To deliver and facilitate delivery of services to the user</li>
              <li>To respond to user inquiries and offer support</li>
              <li>To fulfill and manage your orders</li>
              <li>To request feedback</li>
              <li>To send you marketing and promotional communications</li>
              <li>To deliver targeted advertising</li>
              <li>To post testimonials</li>
              <li>To protect our Services</li>
              <li>To evaluate and improve our Services</li>
              <li>To comply with our legal obligations</li>
            </ul>
          </section>

          <section id="section-3">
            <h2 className="mb-4 text-2xl font-bold">
              3. When and With Whom Do We Share Your Personal Information?
            </h2>
            <p className="mb-3 italic">
              <strong>In Short:</strong> We may share information in specific situations described
              in this section.
            </p>
            <p className="mb-2">
              We may need to share your personal information in the following situations:
            </p>
            <ul className="ml-6 list-disc space-y-2">
              <li>
                <strong>Business Transfers.</strong> We may share or transfer your information in
                connection with, or during negotiations of, any merger, sale of company assets,
                financing, or acquisition of all or a portion of our business to another company.
              </li>
            </ul>
          </section>

          <section id="section-4">
            <h2 className="mb-4 text-2xl font-bold">
              4. Do We Use Cookies and Other Tracking Technologies?
            </h2>
            <p className="mb-3 italic">
              <strong>In Short:</strong> We may use cookies and other tracking technologies to
              collect and store your information.
            </p>
            <p className="mb-4">
              We may use cookies and similar tracking technologies to gather information when you
              interact with our Services. Some online tracking technologies help us maintain the
              security of our Services and your account, prevent crashes, fix bugs, save your
              preferences, and assist with basic site functions.
            </p>

            <h3 className="mb-3 text-xl font-semibold">Google Analytics</h3>
            <p className="mb-2">
              We may share your information with Google Analytics to track and analyze the use of
              the Services. To opt out of being tracked by Google Analytics across the Services,
              visit{' '}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                className="text-primary hover:underline"
              >
                https://tools.google.com/dlpage/gaoptout
              </a>
              . For more information on the privacy practices of Google, please visit the{' '}
              <a
                href="https://policies.google.com/privacy"
                className="text-primary hover:underline"
              >
                Google Privacy & Terms page
              </a>
              .
            </p>
          </section>

          <section id="section-5">
            <h2 className="mb-4 text-2xl font-bold">
              5. Do We Offer Artificial Intelligence-Based Products?
            </h2>
            <p className="mb-3 italic">
              <strong>In Short:</strong> We offer products, features, or tools powered by artificial
              intelligence, machine learning, or similar technologies.
            </p>
            <p className="mb-4">
              As part of our Services, we offer products, features, or tools powered by artificial
              intelligence, machine learning, or similar technologies (collectively, &quot;AI
              Products&quot;). These tools are designed to enhance your experience and provide you
              with innovative solutions.
            </p>

            <p className="mb-2 font-semibold">Our AI Products are designed for:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li>AI bots</li>
              <li>AI document generation</li>
              <li>AI automation</li>
            </ul>

            <p className="mb-2 mt-4 font-semibold">How We Process Your Data Using AI</p>
            <p className="mb-4">
              All personal information processed using our AI Products is handled in line with our
              Privacy Notice and our agreement with third parties.
            </p>
          </section>

          <section id="section-6">
            <h2 className="mb-4 text-2xl font-bold">6. How Long Do We Keep Your Information?</h2>
            <p className="mb-3 italic">
              <strong>In Short:</strong> We keep your information for as long as necessary to
              fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.
            </p>
            <p className="mb-4">
              We will only keep your personal information for as long as it is necessary for the
              purposes set out in this Privacy Notice, unless a longer retention period is required
              or permitted by law. No purpose in this notice will require us keeping your personal
              information for longer than the period of time in which users have an account with us.
            </p>
          </section>

          <section id="section-7">
            <h2 className="mb-4 text-2xl font-bold">7. How Do We Keep Your Information Safe?</h2>
            <p className="mb-3 italic">
              <strong>In Short:</strong> We aim to protect your personal information through a
              system of organizational and technical security measures.
            </p>
            <p className="mb-4">
              We have implemented appropriate and reasonable technical and organizational security
              measures designed to protect the security of any personal information we process.
              However, despite our safeguards and efforts to secure your information, no electronic
              transmission over the Internet or information storage technology can be guaranteed to
              be 100% secure.
            </p>
          </section>

          <section id="section-8">
            <h2 className="mb-4 text-2xl font-bold">
              8. Do We Collect Information From Minors?
            </h2>
            <p className="mb-3 italic">
              <strong>In Short:</strong> We do not knowingly collect data from or market to children
              under 18 years of age.
            </p>
            <p className="mb-4">
              We do not knowingly collect, solicit data from, or market to children under 18 years
              of age. By using the Services, you represent that you are at least 18 or that you are
              the parent or guardian of such a minor and consent to such minor dependent&apos;s use
              of the Services. If you become aware of any data we may have collected from children
              under age 18, please contact us at{' '}
              <a href="mailto:hello@onlinedoctornote.com" className="text-primary hover:underline">
                hello@onlinedoctornote.com
              </a>
              .
            </p>
          </section>

          <section id="section-9">
            <h2 className="mb-4 text-2xl font-bold">9. What Are Your Privacy Rights?</h2>
            <p className="mb-3 italic">
              <strong>In Short:</strong> You may review, change, or terminate your account at any
              time, depending on your country, province, or state of residence.
            </p>

            <h3 className="mb-3 text-lg font-semibold">Withdrawing your consent</h3>
            <p className="mb-4">
              If we are relying on your consent to process your personal information, you have the
              right to withdraw your consent at any time. You can withdraw your consent at any time
              by contacting us at{' '}
              <a href="mailto:hello@onlinedoctornote.com" className="text-primary hover:underline">
                hello@onlinedoctornote.com
              </a>
              .
            </p>

            <h3 className="mb-3 text-lg font-semibold">
              Opting out of marketing and promotional communications
            </h3>
            <p className="mb-4">
              You can unsubscribe from our marketing and promotional communications at any time by
              clicking on the unsubscribe link in the emails that we send, replying
              &quot;STOP&quot; or &quot;UNSUBSCRIBE&quot; to the SMS messages that we send, or by
              contacting us.
            </p>

            <h3 className="mb-3 text-lg font-semibold">Account Information</h3>
            <p className="mb-4">
              If you would at any time like to review or change the information in your account or
              terminate your account, you can contact us using the contact information provided.
            </p>

            <h3 className="mb-3 text-lg font-semibold">Cookies and similar technologies</h3>
            <p className="mb-4">
              Most Web browsers are set to accept cookies by default. If you prefer, you can usually
              choose to set your browser to remove cookies and to reject cookies.
            </p>
          </section>

          <section id="section-10">
            <h2 className="mb-4 text-2xl font-bold">10. Controls for Do-Not-Track Features</h2>
            <p className="mb-4">
              Most web browsers and some mobile operating systems include a Do-Not-Track
              (&quot;DNT&quot;) feature. At this stage, no uniform technology standard for
              recognizing and implementing DNT signals has been finalized. As such, we do not
              currently respond to DNT browser signals.
            </p>
          </section>

          <section id="section-11">
            <h2 className="mb-4 text-2xl font-bold">
              11. Do United States Residents Have Specific Privacy Rights?
            </h2>
            <p className="mb-3 italic">
              <strong>In Short:</strong> If you are a resident of California, Colorado, Connecticut,
              Delaware, Florida, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska,
              New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah, or Virginia,
              you may have the right to request access to and receive details about the personal
              information we maintain about you.
            </p>

            <h3 className="mb-3 text-lg font-semibold">Your Rights</h3>
            <p className="mb-2">
              You have rights under certain US state data protection laws. These rights include:
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>Right to know whether or not we are processing your personal data</li>
              <li>Right to access your personal data</li>
              <li>Right to correct inaccuracies in your personal data</li>
              <li>Right to request the deletion of your personal data</li>
              <li>Right to obtain a copy of the personal data you previously shared with us</li>
              <li>Right to non-discrimination for exercising your rights</li>
              <li>
                Right to opt out of the processing of your personal data if it is used for targeted
                advertising
              </li>
            </ul>

            <h3 className="mb-3 mt-4 text-lg font-semibold">How to Exercise Your Rights</h3>
            <p className="mb-4">
              To exercise these rights, you can contact us at{' '}
              <a href="mailto:hello@onlinedoctornote.com" className="text-primary hover:underline">
                hello@onlinedoctornote.com
              </a>{' '}
              or by calling toll-free at{' '}
              <a href="tel:917-300-8543" className="text-primary hover:underline">
                917-300-8543
              </a>
              .
            </p>
          </section>

          <section id="section-12">
            <h2 className="mb-4 text-2xl font-bold">12. Do We Make Updates to This Notice?</h2>
            <p className="mb-3 italic">
              <strong>In Short:</strong> Yes, we will update this notice as necessary to stay
              compliant with relevant laws.
            </p>
            <p className="mb-4">
              We may update this Privacy Notice from time to time. The updated version will be
              indicated by an updated &quot;Last updated&quot; date at the top of this Privacy
              Notice. We encourage you to review this Privacy Notice frequently to stay informed
              about how we are protecting your information.
            </p>
          </section>

          <section id="section-13">
            <h2 className="mb-4 text-2xl font-bold">
              13. How Can You Contact Us About This Notice?
            </h2>
            <p className="mb-4">
              If you have questions or comments about this notice, you may email us at{' '}
              <a href="mailto:hello@onlinedoctornote.com" className="text-primary hover:underline">
                hello@onlinedoctornote.com
              </a>{' '}
              or contact us by post at:
            </p>
            <address className="not-italic">
              ODN LLC
              <br />
              OnlineDoctorNote.com
              <br />
              5740 SW 67th Avenue
              <br />
              Miami, FL 33143
            </address>
          </section>

          <section id="section-14">
            <h2 className="mb-4 text-2xl font-bold">
              14. How Can You Review, Update, or Delete the Data We Collect From You?
            </h2>
            <p className="mb-4">
              Based on the applicable laws of your country or state of residence in the US, you may
              have the right to request access to the personal information we collect from you,
              details about how we have processed it, correct inaccuracies, or delete your personal
              information. You may also have the right to withdraw your consent to our processing of
              your personal information. These rights may be limited in some circumstances by
              applicable law. To request to review, update, or delete your personal information,
              please email us at{' '}
              <a href="mailto:hello@onlinedoctornote.com" className="text-primary hover:underline">
                hello@onlinedoctornote.com
              </a>
              .
            </p>
          </section>

          <div className="mt-12 border-t pt-8">
            <Link href="/" className="text-primary hover:underline">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
