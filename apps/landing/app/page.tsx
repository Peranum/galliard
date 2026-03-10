import { SoftLanding } from "@/components/soft-ui/SoftLanding";
import { faqItems } from "@/data/seo";

export default function HomePage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };

  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Галльярд",
    url: "https://example.by",
    email: "info@galliard.by",
    telephone: "+375292954985"
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Главная",
        item: "https://example.by/"
      }
    ]
  };

  const localBusinessLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Галльярд",
    areaServed: ["BY", "RU"],
    telephone: "+375292954985",
    email: "info@galliard.by",
    openingHours: "Mo-Fr 09:00-18:00",
    description:
      "Импорт товаров и сырья из Китая с полным сопровождением: подбор поставщиков, контроль качества, логистика, таможенное оформление."
  };

  return (
    <>
      <SoftLanding />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        type="application/ld+json"
      />
    </>
  );
}
