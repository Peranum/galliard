import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { IndustryItem } from "@/types/content";
import styles from "@/components/sections/IndustriesSection.module.scss";

interface IndustriesSectionProps {
  industries: IndustryItem[];
}

export function IndustriesSection({ industries }: IndustriesSectionProps) {
  return (
    <section className={styles.section} id="industries">
      <Container>
        <SectionTitle
          description="Работаем с разными типами производств и подбираем сырье под конкретный технологический процесс."
          eyebrow="Отрасли"
          title="С какими производствами мы работаем"
        />

        <div className={styles.grid}>
          {industries.map((industry, index) => (
            <Reveal delay={index * 55} key={industry.title}>
              <article className={styles.card}>
                <h3>{industry.title}</h3>
                <p>{industry.materials}</p>
                <span>{industry.note}</span>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
