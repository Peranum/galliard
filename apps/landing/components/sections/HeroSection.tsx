import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { ContactsContent, HeroContent } from "@/types/content";
import styles from "@/components/sections/HeroSection.module.scss";

interface HeroSectionProps {
  hero: HeroContent;
  contacts: ContactsContent;
}

export function HeroSection({ hero, contacts }: HeroSectionProps) {
  const telHref = `tel:${contacts.phone.replace(/[^+\d]/g, "")}`;

  return (
    <>
      <header className={styles.header} id="top">
        <Container className={styles.inner} size="wide">
          <div className={styles.topBar}>
            <a className={styles.logo} href="#top">
              {contacts.companyName}
            </a>

            <nav aria-label="Основная навигация" className={styles.nav}>
              {hero.navItems.map((item) => (
                <a href={item.href} key={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>

            <a className={styles.phone} href={telHref}>
              {contacts.phone}
            </a>
          </div>
        </Container>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <Container className={styles.inner} size="wide">
          <div className={styles.content}>
            <Reveal>
              <p className={styles.eyebrow}>{hero.eyebrow}</p>
              <h1 id="hero-title">{hero.title}</h1>
              <p className={styles.description}>{hero.description}</p>

              <div className={styles.actions}>
                <Button href="#contacts" size="lg">
                  {hero.primaryCta}
                </Button>
                <Button href="#services" size="lg" variant="secondary">
                  {hero.secondaryCta}
                </Button>
              </div>
            </Reveal>

            <Reveal className={styles.highlightWrap} delay={120}>
              {hero.highlights.map((highlight) => (
                <div className={styles.highlightCard} key={highlight}>
                  {highlight}
                </div>
              ))}
            </Reveal>
          </div>
        </Container>
      </section>
    </>
  );
}
