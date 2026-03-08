export interface NavItem {
  label: string;
  href: string;
}

export interface HeroContent {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  highlights: string[];
  navItems: NavItem[];
}

export interface ServiceItem {
  title: string;
  description: string;
}

export interface IndustryItem {
  title: string;
  materials: string;
  note: string;
}

export interface ProcessStep {
  title: string;
  description: string;
}

export interface AdvantageItem {
  title: string;
  description: string;
}

export interface TrustMetric {
  label: string;
  value: string;
  description: string;
}

export interface CaseItem {
  title: string;
  result: string;
  description: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ContactsContent {
  companyName: string;
  phone: string;
  email: string;
  address: string;
  workHours: string;
  messengers: string;
}

export interface SectionContent {
  hero: HeroContent;
  services: ServiceItem[];
  industries: IndustryItem[];
  process: ProcessStep[];
  advantages: AdvantageItem[];
  trust: {
    metrics: TrustMetric[];
    cases: CaseItem[];
    partners: string[];
  };
  faq: FAQItem[];
  contacts: ContactsContent;
}

export interface ContactFormValues {
  name: string;
  phone: string;
  company: string;
  industry: string;
  request: string;
  consent: boolean;
  website: string;
}

export type ContactFormState = "idle" | "submitting" | "success" | "error";
