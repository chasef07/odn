import Header from '@/components/Header'
import Link from 'next/link'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="mb-6 text-4xl font-bold">Terms of Service</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated April 11, 2025</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="mb-4 text-2xl font-bold">Agreement to Our Legal Terms</h2>
            <p className="leading-relaxed">
              We are Plantation Physical Medicine LLC, doing business as OnlineDoctorNote.com
              (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;), a company
              registered in Florida, United States at 1751 N University Drive, Suite 6, Plantation,
              FL 33322.
            </p>
            <p className="mt-4 leading-relaxed">
              We operate the website{' '}
              <a href="http://www.onlinedoctornote.com" className="text-primary hover:underline">
                http://www.onlinedoctornote.com
              </a>{' '}
              (the &quot;Site&quot;), as well as any other related products and services that refer
              or link to these legal terms (the &quot;Legal Terms&quot;) (collectively, the
              &quot;Services&quot;).
            </p>
            <p className="mt-4 leading-relaxed">
              Our site provides a Telehealth platform for consumers to request a doctor&apos;s note
              from a Telehealth provider. Consumers input health information which is reviewed by a
              licensed provider, and if appropriate, a digital doctor&apos;s note will be issued and
              sent electronically.
            </p>
            <p className="mt-4 leading-relaxed">
              You can contact us by phone at{' '}
              <a href="tel:+19173008543" className="text-primary hover:underline">
                (+1) 917-300-8543
              </a>
              , email at{' '}
              <a href="mailto:hello@onlinedoctornote.com" className="text-primary hover:underline">
                hello@onlinedoctornote.com
              </a>
              , or by mail to 1751 N University Drive, Suite 6, Plantation, FL 33322, United States.
            </p>
            <p className="mt-4 leading-relaxed">
              These Legal Terms constitute a legally binding agreement made between you, whether
              personally or on behalf of an entity (&quot;you&quot;), and Plantation Physical
              Medicine LLC, concerning your access to and use of the Services. You agree that by
              accessing the Services, you have read, understood, and agreed to be bound by all of
              these Legal Terms. <strong>IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.</strong>
            </p>
            <p className="mt-4 leading-relaxed">
              The Services are intended for users who are at least 18 years old. Persons under the
              age of 18 are not permitted to use or register for the Services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 text-2xl font-bold">Table of Contents</h2>
            <ol className="ml-6 list-decimal space-y-2">
              <li>
                <a href="#section-1" className="text-primary hover:underline">
                  Our Services
                </a>
              </li>
              <li>
                <a href="#section-2" className="text-primary hover:underline">
                  Intellectual Property Rights
                </a>
              </li>
              <li>
                <a href="#section-3" className="text-primary hover:underline">
                  User Representations
                </a>
              </li>
              <li>
                <a href="#section-4" className="text-primary hover:underline">
                  Products
                </a>
              </li>
              <li>
                <a href="#section-5" className="text-primary hover:underline">
                  Purchases and Payment
                </a>
              </li>
              <li>
                <a href="#section-6" className="text-primary hover:underline">
                  Refunds Policy
                </a>
              </li>
              <li>
                <a href="#section-7" className="text-primary hover:underline">
                  Prohibited Activities
                </a>
              </li>
              <li>
                <a href="#section-8" className="text-primary hover:underline">
                  User Generated Contributions
                </a>
              </li>
              <li>
                <a href="#section-9" className="text-primary hover:underline">
                  Contribution License
                </a>
              </li>
              <li>
                <a href="#section-10" className="text-primary hover:underline">
                  Guidelines for Reviews
                </a>
              </li>
              <li>
                <a href="#section-11" className="text-primary hover:underline">
                  Third-Party Websites and Content
                </a>
              </li>
              <li>
                <a href="#section-12" className="text-primary hover:underline">
                  Services Management
                </a>
              </li>
              <li>
                <a href="#section-13" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#section-14" className="text-primary hover:underline">
                  Term and Termination
                </a>
              </li>
              <li>
                <a href="#section-15" className="text-primary hover:underline">
                  Modifications and Interruptions
                </a>
              </li>
              <li>
                <a href="#section-16" className="text-primary hover:underline">
                  Governing Law
                </a>
              </li>
              <li>
                <a href="#section-17" className="text-primary hover:underline">
                  Dispute Resolution
                </a>
              </li>
              <li>
                <a href="#section-18" className="text-primary hover:underline">
                  Corrections
                </a>
              </li>
              <li>
                <a href="#section-19" className="text-primary hover:underline">
                  Disclaimer
                </a>
              </li>
              <li>
                <a href="#section-20" className="text-primary hover:underline">
                  Limitations of Liability
                </a>
              </li>
              <li>
                <a href="#section-21" className="text-primary hover:underline">
                  Indemnification
                </a>
              </li>
              <li>
                <a href="#section-22" className="text-primary hover:underline">
                  User Data
                </a>
              </li>
              <li>
                <a href="#section-23" className="text-primary hover:underline">
                  Electronic Communications, Transactions, and Signatures
                </a>
              </li>
              <li>
                <a href="#section-24" className="text-primary hover:underline">
                  SMS Text Messaging
                </a>
              </li>
              <li>
                <a href="#section-25" className="text-primary hover:underline">
                  California Users and Residents
                </a>
              </li>
              <li>
                <a href="#section-26" className="text-primary hover:underline">
                  Miscellaneous
                </a>
              </li>
              <li>
                <a href="#section-27" className="text-primary hover:underline">
                  Contact Us
                </a>
              </li>
            </ol>
          </section>

          <section id="section-1">
            <h2 className="mb-4 text-2xl font-bold">1. Our Services</h2>
            <p className="leading-relaxed">
              The information provided when using the Services is not intended for distribution to
              or use by any person or entity in any jurisdiction or country where such distribution
              or use would be contrary to law or regulation or which would subject us to any
              registration requirement within such jurisdiction or country. Accordingly, those
              persons who choose to access the Services from other locations do so on their own
              initiative and are solely responsible for compliance with local laws, if and to the
              extent local laws are applicable.
            </p>
          </section>

          <section id="section-2">
            <h2 className="mb-4 text-2xl font-bold">2. Intellectual Property Rights</h2>
            <h3 className="mb-3 text-xl font-semibold">Our intellectual property</h3>
            <p className="mb-4 leading-relaxed">
              We are the owner or the licensee of all intellectual property rights in our Services,
              including all source code, databases, functionality, software, website designs, audio,
              video, text, photographs, and graphics in the Services (collectively, the
              &quot;Content&quot;), as well as the trademarks, service marks, and logos contained
              therein (the &quot;Marks&quot;).
            </p>
            <p className="mb-4 leading-relaxed">
              Our Content and Marks are protected by copyright and trademark laws and treaties in
              the United States and around the world.
            </p>
            <p className="leading-relaxed">
              The Content and Marks are provided in or through the Services &quot;AS IS&quot; for
              your personal, non-commercial use only.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold">Your use of our Services</h3>
            <p className="mb-2 leading-relaxed">
              Subject to your compliance with these Legal Terms, we grant you a non-exclusive,
              non-transferable, revocable license to:
            </p>
            <ul className="ml-6 list-disc space-y-1">
              <li>access the Services; and</li>
              <li>
                download or print a copy of any portion of the Content to which you have properly
                gained access
              </li>
            </ul>
            <p className="mt-4 leading-relaxed">
              solely for your personal, non-commercial use.
            </p>
          </section>

          <section id="section-3">
            <h2 className="mb-4 text-2xl font-bold">3. User Representations</h2>
            <p className="mb-4 leading-relaxed">By using the Services, you represent and warrant that:</p>
            <ol className="ml-6 list-decimal space-y-2">
              <li>you have the legal capacity and you agree to comply with these Legal Terms;</li>
              <li>you are not a minor in the jurisdiction in which you reside;</li>
              <li>
                you will not access the Services through automated or non-human means, whether
                through a bot, script or otherwise;
              </li>
              <li>you will not use the Services for any illegal or unauthorized purpose; and</li>
              <li>your use of the Services will not violate any applicable law or regulation.</li>
            </ol>
            <p className="mt-4 leading-relaxed">
              If you provide any information that is untrue, inaccurate, not current, or incomplete,
              we have the right to suspend or terminate your account and refuse any and all current
              or future use of the Services.
            </p>
          </section>

          <section id="section-4">
            <h2 className="mb-4 text-2xl font-bold">4. Products</h2>
            <p className="leading-relaxed">
              All products are subject to availability. We reserve the right to discontinue any
              products at any time for any reason. Prices for all products are subject to change.
            </p>
          </section>

          <section id="section-5">
            <h2 className="mb-4 text-2xl font-bold">5. Purchases and Payment</h2>
            <p className="mb-2 leading-relaxed">We accept the following forms of payment:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li>Visa</li>
              <li>Mastercard</li>
              <li>American Express</li>
              <li>Discover</li>
            </ul>
            <p className="mt-4 leading-relaxed">
              You agree to provide current, complete, and accurate purchase and account information
              for all purchases made via the Services. You further agree to promptly update account
              and payment information, including email address, payment method, and payment card
              expiration date, so that we can complete your transactions and contact you as needed.
            </p>
            <p className="mt-4 leading-relaxed">
              We reserve the right to refuse any order placed through the Services. We may, in our
              sole discretion, limit or cancel quantities purchased per person, per household, or
              per order.
            </p>
          </section>

          <section id="section-6">
            <h2 className="mb-4 text-2xl font-bold">6. Refunds Policy</h2>
            <p className="leading-relaxed">
              All sales are final and no refund will be issued.
            </p>
          </section>

          <section id="section-7">
            <h2 className="mb-4 text-2xl font-bold">7. Prohibited Activities</h2>
            <p className="mb-4 leading-relaxed">
              You may not access or use the Services for any purpose other than that for which we
              make the Services available. The Services may not be used in connection with any
              commercial endeavors except those that are specifically endorsed or approved by us.
            </p>
            <p className="mb-2 leading-relaxed">
              As a user of the Services, you agree not to:
            </p>
            <ul className="ml-6 list-disc space-y-2 text-sm">
              <li>
                Systematically retrieve data or other content from the Services to create or
                compile, directly or indirectly, a collection, compilation, database, or directory
                without written permission from us.
              </li>
              <li>
                Trick, defraud, or mislead us and other users, especially in any attempt to learn
                sensitive account information such as user passwords.
              </li>
              <li>
                Circumvent, disable, or otherwise interfere with security-related features of the
                Services.
              </li>
              <li>Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.</li>
              <li>
                Use any information obtained from the Services in order to harass, abuse, or harm
                another person.
              </li>
              <li>Use the Services in a manner inconsistent with any applicable laws or regulations.</li>
              <li>Engage in unauthorized framing of or linking to the Services.</li>
              <li>
                Upload or transmit viruses, Trojan horses, or other material that interferes with
                any party&apos;s uninterrupted use and enjoyment of the Services.
              </li>
              <li>
                Engage in any automated use of the system, such as using scripts to send comments or
                messages, or using any data mining, robots, or similar data gathering and extraction
                tools.
              </li>
              <li>
                Attempt to impersonate another user or person or use the username of another user.
              </li>
              <li>
                Use the Services as part of any effort to compete with us or otherwise use the
                Services and/or the Content for any revenue-generating endeavor or commercial
                enterprise.
              </li>
            </ul>
          </section>

          <section id="section-8">
            <h2 className="mb-4 text-2xl font-bold">8. User Generated Contributions</h2>
            <p className="mb-4 leading-relaxed">
              The Services does not offer users to submit or post content. We may provide you with
              the opportunity to create, submit, post, display, transmit, perform, publish,
              distribute, or broadcast content and materials to us or on the Services
              (&quot;Contributions&quot;).
            </p>
            <p className="mb-2 leading-relaxed">
              When you create or make available any Contributions, you represent and warrant that:
            </p>
            <ul className="ml-6 list-disc space-y-2 text-sm">
              <li>
                You are the creator and owner of or have the necessary licenses, rights, consents,
                releases, and permissions to use your Contributions.
              </li>
              <li>Your Contributions are not false, inaccurate, or misleading.</li>
              <li>Your Contributions are not obscene, lewd, or otherwise objectionable.</li>
              <li>Your Contributions do not violate any applicable law, regulation, or rule.</li>
            </ul>
          </section>

          <section id="section-9">
            <h2 className="mb-4 text-2xl font-bold">9. Contribution License</h2>
            <p className="leading-relaxed">
              You and Services agree that we may access, store, process, and use any information and
              personal data that you provide following the terms of the Privacy Policy and your
              choices (including settings).
            </p>
            <p className="mt-4 leading-relaxed">
              By submitting suggestions or other feedback regarding the Services, you agree that we
              can use and share such feedback for any purpose without compensation to you.
            </p>
          </section>

          <section id="section-10">
            <h2 className="mb-4 text-2xl font-bold">10. Guidelines for Reviews</h2>
            <p className="mb-4 leading-relaxed">
              We may provide you areas on the Services to leave reviews or ratings. When posting a
              review, you must comply with certain criteria including having firsthand experience
              with the person/entity being reviewed and not containing offensive profanity or
              abusive language.
            </p>
          </section>

          <section id="section-11">
            <h2 className="mb-4 text-2xl font-bold">11. Third-Party Websites and Content</h2>
            <p className="leading-relaxed">
              The Services may contain links to other websites (&quot;Third-Party Websites&quot;) as
              well as articles, photographs, text, graphics, pictures, designs, music, sound, video,
              information, applications, software, and other content or items belonging to or
              originating from third parties (&quot;Third-Party Content&quot;). Such Third-Party
              Websites and Third-Party Content are not investigated, monitored, or checked for
              accuracy, appropriateness, or completeness by us.
            </p>
          </section>

          <section id="section-12">
            <h2 className="mb-4 text-2xl font-bold">12. Services Management</h2>
            <p className="leading-relaxed">
              We reserve the right, but not the obligation, to: (1) monitor the Services for
              violations of these Legal Terms; (2) take appropriate legal action against anyone who
              violates the law or these Legal Terms; (3) refuse, restrict access to, limit the
              availability of, or disable any of your Contributions; (4) remove from the Services or
              otherwise disable all files and content that are excessive in size or burdensome to
              our systems; and (5) otherwise manage the Services in a manner designed to protect our
              rights and property.
            </p>
          </section>

          <section id="section-13">
            <h2 className="mb-4 text-2xl font-bold">13. Privacy Policy</h2>
            <p className="leading-relaxed">
              We care about data privacy and security. Please review our Privacy Policy:{' '}
              <Link href="/privacy-policy" className="text-primary hover:underline">
                http://www.onlinedoctornote.com/privacy-policy
              </Link>
              . By using the Services, you agree to be bound by our Privacy Policy, which is
              incorporated into these Legal Terms. Please be advised the Services are hosted in the
              United States.
            </p>
          </section>

          <section id="section-14">
            <h2 className="mb-4 text-2xl font-bold">14. Term and Termination</h2>
            <p className="leading-relaxed">
              These Legal Terms shall remain in full force and effect while you use the Services.{' '}
              <strong>
                WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO,
                IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF
                THE SERVICES (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON
                OR FOR NO REASON.
              </strong>
            </p>
            <p className="mt-4 leading-relaxed">
              If we terminate or suspend your account for any reason, you are prohibited from
              registering and creating a new account under your name, a fake or borrowed name, or
              the name of any third party.
            </p>
          </section>

          <section id="section-15">
            <h2 className="mb-4 text-2xl font-bold">15. Modifications and Interruptions</h2>
            <p className="leading-relaxed">
              We reserve the right to change, modify, or remove the contents of the Services at any
              time or for any reason at our sole discretion without notice. We also reserve the
              right to modify or discontinue all or part of the Services without notice at any time.
            </p>
            <p className="mt-4 leading-relaxed">
              We cannot guarantee the Services will be available at all times. We may experience
              hardware, software, or other problems or need to perform maintenance related to the
              Services, resulting in interruptions, delays, or errors.
            </p>
          </section>

          <section id="section-16">
            <h2 className="mb-4 text-2xl font-bold">16. Governing Law</h2>
            <p className="leading-relaxed">
              These Legal Terms and your use of the Services are governed by and construed in
              accordance with the laws of the State of New York applicable to agreements made and to
              be entirely performed within the State of New York, without regard to its conflict of
              law principles.
            </p>
          </section>

          <section id="section-17">
            <h2 className="mb-4 text-2xl font-bold">17. Dispute Resolution</h2>
            <h3 className="mb-3 text-xl font-semibold">Binding Arbitration</h3>
            <p className="mb-4 leading-relaxed">
              If the Parties are unable to resolve a Dispute through informal negotiations, the
              Dispute will be finally and exclusively resolved by binding arbitration.{' '}
              <strong>
                YOU UNDERSTAND THAT WITHOUT THIS PROVISION, YOU WOULD HAVE THE RIGHT TO SUE IN COURT
                AND HAVE A JURY TRIAL.
              </strong>
            </p>
            <p className="leading-relaxed">
              The arbitration shall be commenced and conducted under the Commercial Arbitration
              Rules of the American Arbitration Association (&quot;AAA&quot;) and, where
              appropriate, the AAA&apos;s Supplementary Procedures for Consumer Related Disputes.
            </p>

            <h3 className="mb-3 mt-6 text-xl font-semibold">Restrictions</h3>
            <p className="leading-relaxed">
              The Parties agree that any arbitration shall be limited to the Dispute between the
              Parties individually. To the full extent permitted by law, (a) no arbitration shall be
              joined with any other proceeding; (b) there is no right or authority for any Dispute
              to be arbitrated on a class-action basis; and (c) there is no right or authority for
              any Dispute to be brought in a purported representative capacity.
            </p>
          </section>

          <section id="section-18">
            <h2 className="mb-4 text-2xl font-bold">18. Corrections</h2>
            <p className="leading-relaxed">
              There may be information on the Services that contains typographical errors,
              inaccuracies, or omissions. We reserve the right to correct any errors, inaccuracies,
              or omissions and to change or update the information on the Services at any time,
              without prior notice.
            </p>
          </section>

          <section id="section-19">
            <h2 className="mb-4 text-2xl font-bold">19. Disclaimer</h2>
            <p className="leading-relaxed">
              THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE
              OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE
              DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR
              USE THEREOF.
            </p>
          </section>

          <section id="section-20">
            <h2 className="mb-4 text-2xl font-bold">20. Limitations of Liability</h2>
            <p className="leading-relaxed">
              IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY
              THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL,
              OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER
              DAMAGES ARISING FROM YOUR USE OF THE SERVICES.
            </p>
          </section>

          <section id="section-21">
            <h2 className="mb-4 text-2xl font-bold">21. Indemnification</h2>
            <p className="leading-relaxed">
              You agree to defend, indemnify, and hold us harmless, including our subsidiaries,
              affiliates, and all of our respective officers, agents, partners, and employees, from
              and against any loss, damage, liability, claim, or demand, including reasonable
              attorneys&apos; fees and expenses, made by any third party due to or arising out of:
              (1) your Contributions; (2) use of the Services; (3) breach of these Legal Terms; (4)
              any breach of your representations and warranties set forth in these Legal Terms; (5)
              your violation of the rights of a third party; or (6) any overt harmful act toward any
              other user of the Services with whom you connected via the Services.
            </p>
          </section>

          <section id="section-22">
            <h2 className="mb-4 text-2xl font-bold">22. User Data</h2>
            <p className="leading-relaxed">
              We will maintain certain data that you transmit to the Services for the purpose of
              managing the performance of the Services, as well as data relating to your use of the
              Services. Although we perform regular routine backups of data, you are solely
              responsible for all data that you transmit or that relates to any activity you have
              undertaken using the Services.
            </p>
          </section>

          <section id="section-23">
            <h2 className="mb-4 text-2xl font-bold">
              23. Electronic Communications, Transactions, and Signatures
            </h2>
            <p className="leading-relaxed">
              Visiting the Services, sending us emails, and completing online forms constitute
              electronic communications. You consent to receive electronic communications, and you
              agree that all agreements, notices, disclosures, and other communications we provide
              to you electronically, via email and on the Services, satisfy any legal requirement
              that such communication be in writing.
            </p>
          </section>

          <section id="section-24">
            <h2 className="mb-4 text-2xl font-bold">24. SMS Text Messaging</h2>
            <p className="leading-relaxed">
              By providing your mobile phone number and opting in to receive text messages, you
              consent to receive SMS text messages from OnlineDoctorNote.com. Message and data rates
              may apply. You can opt out at any time by replying &quot;STOP&quot; to any message.
            </p>
          </section>

          <section id="section-25">
            <h2 className="mb-4 text-2xl font-bold">25. California Users and Residents</h2>
            <p className="leading-relaxed">
              If any complaint with us is not satisfactorily resolved, you can contact the Complaint
              Assistance Unit of the Division of Consumer Services of the California Department of
              Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento,
              California 95834 or by telephone at (800) 952-5210 or (916) 445-1254.
            </p>
          </section>

          <section id="section-26">
            <h2 className="mb-4 text-2xl font-bold">26. Miscellaneous</h2>
            <p className="leading-relaxed">
              These Legal Terms and any policies or operating rules posted by us on the Services or
              in respect to the Services constitute the entire agreement and understanding between
              you and us. Our failure to exercise or enforce any right or provision of these Legal
              Terms shall not operate as a waiver of such right or provision.
            </p>
          </section>

          <section id="section-27">
            <h2 className="mb-4 text-2xl font-bold">27. Contact Us</h2>
            <p className="mb-4 leading-relaxed">
              In order to resolve a complaint regarding the Services or to receive further
              information regarding use of the Services, please contact us at:
            </p>
            <address className="not-italic">
              <p className="font-semibold">Plantation Physical Medicine LLC</p>
              <p>OnlineDoctorNote.com</p>
              <p>1751 N University Drive, Suite 6</p>
              <p>Plantation, FL 33322</p>
              <p>United States</p>
              <p className="mt-2">
                Phone:{' '}
                <a href="tel:+19173008543" className="text-primary hover:underline">
                  (+1) 917-300-8543
                </a>
              </p>
              <p>
                Email:{' '}
                <a href="mailto:hello@onlinedoctornote.com" className="text-primary hover:underline">
                  hello@onlinedoctornote.com
                </a>
              </p>
            </address>
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
