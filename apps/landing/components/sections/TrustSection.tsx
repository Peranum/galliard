import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { CaseItem, TrustMetric } from "@/types/content";
import styles from "@/components/sections/TrustSection.module.scss";

interface TrustSectionProps {
  metrics: TrustMetric[];
  cases: CaseItem[];
  partners: string[];
}

export function TrustSection({ metrics, cases, partners }: TrustSectionProps) {
  return (
    <section className={styles.section}>
      <Container>
        <SectionTitle
          description="Для первого релиза используем плейсхолдеры. Блок можно быстро заменить на ваши реальные цифры, кейсы и партнеров."
          eyebrow="Доверие"
          title="Факты и практика"
        />

        <div className={styles.metrics}>
          {metrics.map((metric, index) => (
            <Reveal delay={index * 70} key={metric.label}>
              <article className={styles.metricCard}>
                <p className={styles.metricValue}>{metric.value}</p>
                <h3>{metric.label}</h3>
                <p>{metric.description}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className={styles.cases}>
          {cases.map((item, index) => (
            <Reveal delay={index * 70} key={item.title}>
              <article className={styles.caseCard}>
                <h3>{item.title}</h3>
                <p className={styles.caseResult}>{item.result}</p>
                <p>{item.description}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <div className={styles.partnerWrap}>
          <h3>Партнерская сетка (плейсхолдеры)</h3>
          <ul>
            {partners.map((partner) => (
              <li key={partner}>{partner}</li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
