import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ServiceItem } from "@/types/content";
import styles from "@/components/sections/ServicesSection.module.scss";

interface ServicesSectionProps {
  services: ServiceItem[];
}

export function ServicesSection({ services }: ServicesSectionProps) {
  return (
    <section className={styles.section} id="services">
      <Container size="wide">
        <SectionTitle
          description="Комплексно закрываем задачи снабжения для вашего производства: от квалификации фабрик до поставки в РБ."
          eyebrow="Услуги"
          title="Что берем на себя"
        />

        <div className={styles.grid}>
          {services.map((service, index) => (
            <Reveal delay={index * 70} key={service.title}>
              <article className={styles.card}>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
