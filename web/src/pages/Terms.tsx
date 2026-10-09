import { Link } from 'react-router-dom'
import { Card } from '@/components/Card'
import { Logo } from '@/components/Logo'

// Combined Terms & Conditions + Privacy Policy. This is a broad,
// business-protective draft covering: acceptance, accounts, credits/payment/
// no-refund policy, AI-generated content and user responsibility/indemnity,
// third-party platform compliance, intellectual property, disclaimers of
// warranty, limitation of liability, data collection/privacy, cookies,
// data retention/deletion, third-party processors, children's privacy,
// termination, governing law/disputes, and changes to terms. Linked from
// Signup.tsx, which requires an explicit checkbox agreeing to this page
// before an account can be created.
//
// Note: this is a template intended to give broad practical protection, not
// a substitute for review by a licensed attorney in your jurisdiction, // recommend having it reviewed once the business has real revenue/users.
export default function Terms() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-16">
      <Link to="/" className="mb-10 self-start">
        <Logo />
      </Link>
      <Card>
        <h1 className="font-display text-2xl font-semibold text-white">Terms &amp; Conditions / Privacy Policy</h1>
        <p className="mt-1 text-[11px] text-white/40">Last updated: {new Date().toISOString().slice(0, 10)}</p>

        <div className="mt-6 space-y-5 text-[11px] leading-relaxed text-white/50">
          <section>
            <h2 className="text-xs font-medium text-white">1. Acceptance of terms</h2>
            <p className="mt-1">
              By creating an account, accessing, or using Autoviral ("the Service," "we," "us," "our"), you agree to
              be bound by these Terms &amp; Conditions and this Privacy Policy (together, "the Terms"). If you do not
              agree, do not create an account or use the Service. You must be at least 18 years old, or the age of
              legal majority in your jurisdiction, to use the Service. If you are using the Service on behalf of an
              organization, you represent that you have authority to bind that organization to these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">2. Accounts</h2>
            <p className="mt-1">
              You are responsible for maintaining the confidentiality of your account credentials and for all
              activity that occurs under your account, whether or not authorized by you. You must notify us promptly
              of any unauthorized use. We may suspend or terminate accounts that violate these Terms, applicable law,
              or the terms of any connected third-party platform (e.g. YouTube, Instagram), at our sole discretion
              and without liability to you.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">3. Credits, payments &amp; no refunds</h2>
            <p className="mt-1">
              Using the Service to generate a video consumes credits, purchased in packs at the prices shown at time
              of purchase. Credits are deducted the moment a generation attempt starts, regardless of outcome.
              <strong className="text-white/70"> Credits spent on a generation attempt that fails, for any reason
              (including but not limited to AI provider errors, third-party outages, content policy violations,
              network failures, or any other cause), are final and non-refundable.</strong> Our pricing already
              factors in a meaningful rate of failed attempts, so the cost of failures is priced in, not refunded
              individually. All credit pack purchases are final and non-refundable once completed, except where
              required by applicable law. Payments are processed by third-party payment processors (e.g. Razorpay);
              we do not store your full payment card details. You are responsible for any taxes applicable to your
              purchases.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">4. AI-generated content; no warranty of accuracy</h2>
            <p className="mt-1">
              The Service uses third-party and first-party AI models to generate scripts, narration, visuals, and
              metadata. AI-generated output may be inaccurate, incomplete, offensive, infringing, or otherwise
              unsuitable, and we make no representation or warranty regarding its accuracy, quality, originality, or
              fitness for any purpose. You are solely responsible for reviewing all generated content before
              publishing it anywhere, and for ensuring it complies with applicable law and the policies of any
              platform you publish to.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">5. Your responsibility; indemnification</h2>
            <p className="mt-1">
              You are solely responsible for all content you generate, edit, approve, publish, or distribute through
              the Service, and for any accounts (YouTube, Instagram, or otherwise) you connect to it. You agree not
              to use the Service to generate or publish content that is unlawful, defamatory, infringing,
              harassing, fraudulent, or that violates any third party's rights or any applicable law or platform
              policy. You agree to indemnify, defend, and hold harmless Autoviral, its owners, operators, employees,
              and agents from and against any and all claims, liabilities, damages, losses, and expenses (including
              reasonable legal fees) arising out of or in any way connected with: (a) your use or misuse of the
              Service; (b) content you generate, approve, or publish; (c) your violation of these Terms or
              applicable law; or (d) your violation of any third party's rights.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">6. Third-party platforms</h2>
            <p className="mt-1">
              The Service may connect to and post content on your behalf to third-party platforms (e.g. YouTube,
              Instagram) via their respective APIs. Your use of those platforms remains subject to their own terms
              of service and policies, which you are solely responsible for complying with. We are not responsible
              for any suspension, termination, demonetization, or other action taken against your third-party
              accounts, whether or not related to content generated or posted through the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">7. Intellectual property</h2>
            <p className="mt-1">
              The Service, including its software, design, branding, and underlying technology, is owned by us or
              our licensors and is protected by intellectual property laws. Subject to your compliance with these
              Terms and payment of applicable fees, we grant you a limited, non-exclusive, non-transferable license
              to use the Service. As between you and us, you retain ownership of the final video output generated
              specifically for your account, subject to the rights of any underlying third-party licensors (stock
              media, AI providers, voice/TTS providers) whose content may be incorporated into that output under
              their own license terms. We may use anonymized, aggregated data about Service usage to improve the
              Service.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">8. Disclaimer of warranties</h2>
            <p className="mt-1">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
              IMPLIED, OR STATUTORY, INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
              UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT ANY GENERATION ATTEMPT WILL SUCCEED.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">9. Limitation of liability</h2>
            <p className="mt-1">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL AUTOVIRAL, ITS OWNERS, OPERATORS, EMPLOYEES,
              OR AGENTS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY
              LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING FROM OR RELATED TO YOUR USE OF THE SERVICE, EVEN
              IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL AGGREGATE LIABILITY FOR ANY CLAIM ARISING OUT
              OF OR RELATING TO THESE TERMS OR THE SERVICE WILL NOT EXCEED THE AMOUNT YOU PAID US IN THE 3 MONTHS
              PRECEDING THE EVENT GIVING RISE TO THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">10. Privacy: what we collect</h2>
            <p className="mt-1">
              We collect: (a) account information you provide (name, email, password, password is hashed by our
              authentication provider and never stored or visible to us in plain text); (b) content you generate or
              upload and associated metadata; (c) OAuth tokens for third-party platforms you connect, stored
              encrypted at rest; (d) payment metadata from our payment processor (we do not receive or store your
              full card number); (e) usage data such as log-in times, IP address, device/browser information, and
              feature usage, for security, fraud prevention, and service improvement purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">11. How we use and share data</h2>
            <p className="mt-1">
              We use your data to operate, maintain, and improve the Service, process payments, communicate with you
              (including transactional emails about your account and generations), and comply with legal
              obligations. We share data with third-party service providers strictly as needed to operate the
              Service, e.g. Supabase (database/authentication), Cloudflare R2 (file storage), payment processors
              (Razorpay), AI providers (for script/voice generation), and email delivery providers (for
              transactional email), each bound by their own data-processing terms. We do not sell your personal
              data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">12. Data retention &amp; deletion</h2>
            <p className="mt-1">
              We retain account and content data for as long as your account is active, and for a reasonable period
              afterward for legal, accounting, and fraud-prevention purposes. You may request deletion of your
              account and associated personal data by contacting us; some data may be retained where required by
              law or legitimate business purposes (e.g. transaction records).
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">13. Cookies &amp; similar technologies</h2>
            <p className="mt-1">
              We use cookies and similar technologies (e.g. local storage) to keep you signed in, remember
              preferences, and understand how the Service is used. You can control cookies through your browser
              settings; disabling them may limit functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">14. Children's privacy</h2>
            <p className="mt-1">
              The Service is not directed to individuals under 18. We do not knowingly collect personal information
              from children. If we learn we have collected personal information from a child without parental
              consent, we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">15. Termination</h2>
            <p className="mt-1">
              We may suspend or terminate your access to the Service at any time, with or without notice, for
              conduct that violates these Terms, is harmful to other users, us, or third parties, or for any other
              reason at our discretion. Upon termination, your right to use the Service ceases immediately; sections
              of these Terms that by their nature should survive termination (including but not limited to
              indemnification, disclaimers, and limitation of liability) will survive.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">16. Governing law &amp; disputes</h2>
            <p className="mt-1">
              These Terms are governed by the laws of the jurisdiction in which the Service operator is
              incorporated/registered, without regard to conflict-of-law principles. Any dispute arising out of or
              relating to these Terms or the Service will be resolved exclusively in the courts of that
              jurisdiction, and you consent to their exclusive jurisdiction and venue.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">17. Changes to these terms</h2>
            <p className="mt-1">
              We may update these Terms from time to time. Material changes will be reflected by an updated "Last
              updated" date above. Continued use of the Service after a change constitutes acceptance of the
              updated Terms. If you do not agree to an update, you must stop using the Service and may request
              account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xs font-medium text-white">18. Contact</h2>
            <p className="mt-1">
              Questions about these Terms or your data may be directed to the support contact listed on our website.
            </p>
          </section>
        </div>
      </Card>
    </div>
  )
}
