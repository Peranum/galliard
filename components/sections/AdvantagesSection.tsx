import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { AdvantageItem } from "@/types/content";
import styles from "@/components/sections/AdvantagesSection.module.scss";

interface AdvantagesSectionProps {
  items: AdvantageItem[];
}

export function AdvantagesSection({ items }: AdvantagesSectionProps) {
  return (
    <section className={styles.section}>
      <Container>
        <SectionTitle
          description="Подход, который помогает строить поставки как управляемую систему, а не разовые закупки."
          eyebrow="Преимущества"
          title="Почему с нами удобно работать"
        />

        <div className={styles.grid}>
          {items.map((item, index) => (
            <Reveal delay={index * 70} key={item.title}>
              <article className={styles.card}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
