import { useState } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/layout/Header";
import Footer from "@/components/Footer";
import PageTransition from "@/components/PageTransition";
import BackToTop from "@/components/BackToTop";
import MobileBottomActions from "@/components/MobileBottomActions";
import { Shield, Lock, Eye, FileText, Users, Globe, Scale, AlertTriangle } from "lucide-react";
import { useGeoLocation } from "@/hooks/useGeoLocation";

// ── Region-Specific Legal Content ─────────────────────────────

interface RegionLegalContent {
  regulatoryTitle: string;
  regulatoryIntro: string;
  rights: { title: string; description: string }[];
  dataOfficer: { title: string; content: string };
  additionalSections?: { title: string; content: string; icon?: React.ReactNode }[];
}

const ukGdprContent: RegionLegalContent = {
  regulatoryTitle: "UK GDPR Compliance",
  regulatoryIntro:
    "Healing Buds Global complies with the UK General Data Protection Regulation (UK GDPR) as amended by the Data Use and Access Act 2025. As a healthcare-adjacent platform, we apply the highest standards of data protection to your personal and medical information.",
  rights: [
    { title: "Right of Access", description: "Request a copy of all personal data we hold about you (Subject Access Request)." },
    { title: "Right to Rectification", description: "Correct inaccurate or incomplete personal data." },
    { title: "Right to Erasure", description: "Request deletion of your data where there is no compelling reason to continue processing." },
    { title: "Right to Restrict Processing", description: "Limit how we use your data in certain circumstances." },
    { title: "Right to Data Portability", description: "Receive your data in a structured, machine-readable format." },
    { title: "Right to Object", description: "Object to processing based on legitimate interests or direct marketing." },
    { title: "Right to Challenge Automated Decisions", description: "Under the Data Use and Access Act 2025, you have the right to challenge and obtain human review of decisions made solely by automated processing, including AI-driven assessments." },
  ],
  dataOfficer: {
    title: "Data Protection Officer (DPO)",
    content: "For UK GDPR enquiries, contact our Data Protection Officer at: dpo@healingbuds.co.uk",
  },
  additionalSections: [
    {
      title: "Lawful Basis for Processing",
      content:
        "We process personal data under the following lawful bases: (a) Consent — for marketing and analytics cookies; (b) Contractual necessity — to deliver our medical cannabis services; (c) Legal obligation — to comply with healthcare regulations and cannabis licensing requirements; (d) Legitimate interests — for fraud prevention, security, and service improvement.",
    },
    {
      title: "International Transfers",
      content:
        "Where we transfer personal data outside the UK, we ensure adequate safeguards are in place including UK Standard Contractual Clauses or transfer to countries with adequacy decisions recognised by the UK Secretary of State.",
    },
    {
      title: "Breach Notification",
      content:
        "In the event of a personal data breach, we will notify the Information Commissioner's Office (ICO) within 72 hours where the breach is likely to result in a risk to your rights. If the breach poses a high risk, we will also notify you directly.",
    },
  ],
};

const popiaContent: RegionLegalContent = {
  regulatoryTitle: "POPIA Compliance",
  regulatoryIntro:
    "Healing Buds Global complies with the Protection of Personal Information Act (POPIA) of South Africa. We are committed to processing your personal information lawfully and transparently.",
  rights: [
    { title: "Right to Access", description: "Request confirmation of whether we hold your personal information, and access to that information." },
    { title: "Right to Correction", description: "Request correction or deletion of inaccurate, irrelevant, or excessive personal information." },
    { title: "Right to Deletion", description: "Request destruction of personal information that is no longer needed for its collected purpose." },
    { title: "Right to Object", description: "Object to the processing of your personal information for direct marketing purposes at any time." },
    { title: "Right to Complain", description: "Lodge a complaint with the Information Regulator if you believe your personal information has been mishandled." },
    { title: "Right to Not Be Subject to Automated Decisions", description: "You have the right not to be subject to a decision based solely on automated processing." },
  ],
  dataOfficer: {
    title: "Information Officer",
    content:
      "Our registered Information Officer can be contacted at: info-officer@healingbuds.co.za. Our Information Officer is registered with the South African Information Regulator as required by POPIA.",
  },
  additionalSections: [
    {
      title: "PAIA Manual",
      content:
        "In accordance with the Promotion of Access to Information Act (PAIA), Healing Buds maintains a PAIA Manual that describes the categories of records held, how to request access, and the applicable fees. A copy of our PAIA Manual is available upon request by contacting our Information Officer.",
    },
    {
      title: "Conditions for Lawful Processing",
      content:
        "We process personal information in accordance with the eight conditions for lawful processing under POPIA: accountability, processing limitation, purpose specification, further processing limitation, information quality, openness, security safeguards, and data subject participation.",
    },
    {
      title: "Special Personal Information",
      content:
        "As a healthcare platform, we may process special personal information including health data. This processing is done with your explicit consent and is necessary for the provision of medical cannabis services under applicable healthcare regulations.",
    },
    {
      title: "Breach Notification",
      content:
        "In the event of a data breach that compromises your personal information, we will notify the Information Regulator and affected data subjects as soon as reasonably possible, as required by Section 22 of POPIA.",
    },
  ],
};

const defaultContent: RegionLegalContent = {
  regulatoryTitle: "Data Protection",
  regulatoryIntro:
    "Healing Buds Global follows international best practices for data protection and privacy, regardless of your location.",
  rights: [
    { title: "Right of Access", description: "Request a copy of all personal data we hold about you." },
    { title: "Right to Correction", description: "Correct inaccurate or incomplete personal data." },
    { title: "Right to Deletion", description: "Request deletion of your data where legally permitted." },
    { title: "Right to Object", description: "Object to processing for direct marketing at any time." },
    { title: "Right to Data Portability", description: "Receive your data in a portable format." },
  ],
  dataOfficer: {
    title: "Privacy Contact",
    content: "For privacy enquiries, contact: privacy@healingbuds.co.za",
  },
  additionalSections: [],
};

function getRegionContent(countryCode: string): RegionLegalContent {
  switch (countryCode) {
    case 'GB':
      return ukGdprContent;
    case 'ZA':
      return popiaContent;
    default:
      return defaultContent;
  }
}

// ── Component ─────────────────────────────────────────────────

const PrivacyPolicy = () => {
  const { t, i18n } = useTranslation("legal");
  const [menuOpen, setMenuOpen] = useState(false);
  const locationConfig = useGeoLocation();
  const regionContent = getRegionContent(locationConfig.countryCode);
  
  const formatDate = () => {
    const locale = i18n.language === 'pt' ? 'pt-PT' : 'en-US';
    return new Date().toLocaleDateString(locale, { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <PageTransition variant="premium">
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        <Header onMenuStateChange={setMenuOpen} />
        <main className="pt-24 pb-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="flex justify-center mb-4">
                <Shield className="w-16 h-16 text-primary" />
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-4">
                {t("privacy.title")}
              </h1>
              <p className="text-muted-foreground text-lg">
                {t("privacy.lastUpdated")} {formatDate()}
              </p>
              {/* Region indicator badge */}
              <div className="mt-4">
                <span className="inline-flex items-center text-sm font-medium text-primary bg-primary/10 rounded-full px-4 py-1.5">
                  <Scale className="w-4 h-4 mr-1.5" />
                  {regionContent.regulatoryTitle}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-8 text-foreground/90">
              {/* Introduction */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                  <h2 className="font-display text-2xl font-bold">{t("privacy.introduction.title")}</h2>
                </div>
                <p className="leading-relaxed mb-4">
                  {t("privacy.introduction.content")}
                </p>
              </section>

              {/* Region-Specific Regulatory Section */}
              <section className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Scale className="w-6 h-6 text-primary" />
                  <h2 className="font-display text-2xl font-bold">{regionContent.regulatoryTitle}</h2>
                </div>
                <p className="leading-relaxed mb-6">
                  {regionContent.regulatoryIntro}
                </p>

                {/* Region-Specific Rights */}
                <h3 className="font-semibold text-lg mb-3">Your Rights</h3>
                <div className="space-y-3 mb-6">
                  {regionContent.rights.map((right, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <div>
                        <span className="font-semibold">{right.title}:</span>{' '}
                        <span className="text-muted-foreground">{right.description}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Data Officer / Information Officer */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="font-semibold text-base mb-2">{regionContent.dataOfficer.title}</h3>
                  <p className="text-sm text-muted-foreground">{regionContent.dataOfficer.content}</p>
                </div>
              </section>

              {/* Region-Specific Additional Sections */}
              {regionContent.additionalSections && regionContent.additionalSections.length > 0 && (
                <>
                  {regionContent.additionalSections.map((section, index) => (
                    <section key={index}>
                      <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-primary" />
                        <h2 className="font-display text-2xl font-bold">{section.title}</h2>
                      </div>
                      <p className="leading-relaxed">{section.content}</p>
                    </section>
                  ))}
                </>
              )}

              {/* Standard Sections */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-6 h-6 text-primary" />
                  <h2 className="font-display text-2xl font-bold">{t("privacy.informationCollect.title")}</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{t("privacy.informationCollect.personal.title")}</h3>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      {(t("privacy.informationCollect.personal.items", { returnObjects: true }) as string[]).map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{t("privacy.informationCollect.automatic.title")}</h3>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      {(t("privacy.informationCollect.automatic.items", { returnObjects: true }) as string[]).map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-primary" />
                  <h2 className="font-display text-2xl font-bold">{t("privacy.howWeUse.title")}</h2>
                </div>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  {(t("privacy.howWeUse.items", { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Globe className="w-6 h-6 text-primary" />
                  <h2 className="font-display text-2xl font-bold">{t("privacy.informationSharing.title")}</h2>
                </div>
                <p className="leading-relaxed mb-4">{t("privacy.informationSharing.intro")}</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  {(t("privacy.informationSharing.items", { returnObjects: true }) as Array<{ label: string; desc: string }>).map((item, index) => (
                    <li key={index}><strong>{item.label}</strong> {item.desc}</li>
                  ))}
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Lock className="w-6 h-6 text-primary" />
                  <h2 className="font-display text-2xl font-bold">{t("privacy.dataSecurity.title")}</h2>
                </div>
                <p className="leading-relaxed mb-4">
                  {t("privacy.dataSecurity.intro")}
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  {(t("privacy.dataSecurity.items", { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold mb-4">{t("privacy.blockchain.title")}</h2>
                <p className="leading-relaxed">
                  {t("privacy.blockchain.content")}
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold mb-4">{t("privacy.international.title")}</h2>
                <p className="leading-relaxed">
                  {t("privacy.international.content")}
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold mb-4">{t("privacy.children.title")}</h2>
                <p className="leading-relaxed">
                  {t("privacy.children.content")}
                </p>
              </section>

              <section>
                <h2 className="font-display text-2xl font-bold mb-4">{t("privacy.changes.title")}</h2>
                <p className="leading-relaxed">
                  {t("privacy.changes.content")}
                </p>
              </section>

              <section className="bg-card p-6 rounded-lg border border-border">
                <h2 className="font-display text-2xl font-bold mb-4">{t("privacy.contact.title")}</h2>
                <p className="leading-relaxed mb-4">
                  {t("privacy.contact.content")}
                </p>
                <div className="space-y-2">
                  <p><strong>{t("privacy.contact.email")}</strong> {locationConfig.email.replace('info@', 'privacy@')}</p>
                  <p><strong>{t("privacy.contact.address")}</strong> {locationConfig.address}, {locationConfig.city}</p>
                </div>
              </section>
            </div>
          </div>
        </main>
        <Footer />
        <BackToTop />
        <MobileBottomActions menuOpen={menuOpen} />
      </div>
    </PageTransition>
  );
};

export default PrivacyPolicy;
