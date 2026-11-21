import { Shield } from "lucide-react";
import { useContent } from "../hooks/useContent";
import { usePageMeta } from "../hooks/usePageMeta";
import { mailtoHref, telHref } from "../utils/text";

// Update this date whenever the policy changes.
const EFFECTIVE_DATE = "November 21, 2026";

function Section({ title, children }) {
    return (
        <section className="space-y-3">
            <h2
                className="text-2xl font-bold text-[#0B1E4A]"
                style={{ fontFamily: "'Playfair Display', serif" }}
            >
                {title}
            </h2>
            {children}
        </section>
    );
}

function Privacy() {
    usePageMeta({
        title: "Privacy Policy",
        path: "/privacy",
        description: "How VFW Post 4488 in Grenada, Mississippi collects, uses, and protects information shared through this website.",
    });
    const site = useContent("site");
    const emailLink = mailtoHref(site.email);
    const phoneLink = telHref(site.phone);

    const contactLine = (
        <>
            {emailLink ? (
                <a href={emailLink} className="text-[#A86010] font-semibold hover:underline">
                    {site.email}
                </a>
            ) : (
                site.email
            )}
            {site.phone && (
                <>
                    {" "}or{" "}
                    {phoneLink ? (
                        <a href={phoneLink} className="text-[#A86010] font-semibold hover:underline">
                            {site.phone}
                        </a>
                    ) : (
                        site.phone
                    )}
                </>
            )}
        </>
    );

    return (
        <div className="min-h-screen bg-[#F5F1E8] py-12">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-[#0B1E4A] rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-[#D4871A]">
                        <Shield className="text-white" size={32} />
                    </div>
                    <h1
                        className="text-4xl font-bold text-[#0B1E4A] mb-2"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                        Privacy Policy
                    </h1>
                    <p className="text-gray-500">Effective {EFFECTIVE_DATE}</p>
                </div>

                <div className="bg-white rounded-xl shadow-md p-8 space-y-8 border-t-4 border-[#D4871A] text-gray-700 leading-relaxed">
                    <p>
                        Veterans of Foreign Wars Warren E. Campbell Post 4488 in Grenada, Mississippi ("the Post,"
                        "we," or "us") runs this website, vfwgrenada.org. This policy explains what information we
                        collect through the website, why, and how we protect it. We do not sell, rent, or trade your
                        information.
                    </p>

                    <Section title="Information you give us">
                        <p>
                            <strong>Membership applications.</strong> When you apply on the Join Us page, we collect
                            your name, email address, phone number, and mailing address. We use this only to review
                            your eligibility, contact you about your application, and manage your membership.
                        </p>
                        <p>
                            <strong>DD-214.</strong> After you apply, a Post officer will email you to request a copy
                            of your DD-214 (Certificate of Release or Discharge) to confirm eligibility. It may contain
                            sensitive details such as your Social Security number, which you may black out before
                            sending. Once received, DD-214s are kept in private, encrypted storage that only Post
                            officers with admin access can open. They are never posted publicly or shared on social
                            media.
                        </p>
                        <p>
                            <strong>Emails and phone calls.</strong> If you contact us, we use what you send only to
                            respond to you.
                        </p>
                    </Section>

                    <Section title="Donations">
                        <p>
                            Donations are processed by Zeffy, a third-party donation platform, through a form shown on
                            our Donations page. Your payment card details go directly to Zeffy and never pass through or
                            get stored on our website. Zeffy shares your name, email, and donation amount with us so we
                            can thank you and keep records. See{" "}
                            <a
                                href="https://www.zeffy.com/privacy-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#A86010] font-semibold hover:underline"
                            >
                                Zeffy's privacy policy
                            </a>{" "}
                            for how they handle your information.
                        </p>
                    </Section>

                    <Section title="Information collected automatically">
                        <p>
                            We do not use advertising, analytics, or tracking cookies, and we do not track you across
                            other websites. Like most websites, our hosting and security providers keep standard
                            technical logs (such as IP address, browser type, and pages requested) to deliver the site and
                            protect it from abuse.
                        </p>
                        <p>
                            The only information our website stores in your browser is for Post officers who sign in to
                            the admin area, to keep them signed in and to sign them out after inactivity.
                        </p>
                    </Section>

                    <Section title="Social media">
                        <p>
                            The Post shares its own news, events, and photos on its Facebook Page and other social media
                            accounts, sometimes directly from this website. We do not post information about members or
                            applicants, and the website does not collect any information from your Facebook or Instagram
                            account. If you visit our social media pages, that platform's own privacy policy applies.
                        </p>
                    </Section>

                    <Section title="Who we share information with">
                        <p>We share information only as needed to run the website and the Post:</p>
                        <ul className="list-disc pl-6 space-y-1">
                            <li>
                                <strong>Service providers</strong> that host and secure the website and store its data
                                (Railway, Cloudflare, and Supabase), and that send emails about applications (Resend).
                                They may use your information only to provide these services to us.
                            </li>
                            <li>
                                <strong>VFW national and state organizations</strong>, as required to process an
                                approved membership.
                            </li>
                            <li>
                                <strong>When required by law</strong>, or to protect the safety of our members or the
                                public.
                            </li>
                        </ul>
                    </Section>

                    <Section title="How long we keep information">
                        <p>
                            We keep membership applications and DD-214s only as long as needed to review the application
                            and maintain membership records. When an application is deleted, its uploaded documents are
                            permanently deleted with it.
                        </p>
                    </Section>

                    <Section title="Your choices">
                        <p>
                            You can ask us to see, correct, or delete the information you've given us at any time by
                            contacting us at {contactLine}. We'll respond as soon as we reasonably can.
                        </p>
                    </Section>

                    <Section title="Security">
                        <p>
                            The website uses encrypted connections (HTTPS). Application records and documents are
                            protected by access rules enforced by our database, so only Post officers with admin
                            accounts can view them. No method of storing information online is perfectly secure, but we
                            work to protect yours.
                        </p>
                    </Section>

                    <Section title="Children">
                        <p>
                            This website is intended for adults. We do not knowingly collect information from children
                            under 13.
                        </p>
                    </Section>

                    <Section title="Changes to this policy">
                        <p>
                            If we change this policy, we'll post the new version on this page and update the effective
                            date above.
                        </p>
                    </Section>

                    <Section title="Contact us">
                        <p>
                            Questions about this policy or your information? Contact VFW Post 4488 at {contactLine}.
                            {site.locationLabel && <> We're located in {site.locationLabel}.</>}
                        </p>
                    </Section>
                </div>
            </div>
        </div>
    );
}

export default Privacy;
