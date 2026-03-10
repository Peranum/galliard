"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { InputField } from "@/components/ui/InputField";
import { ContactFormState, ContactFormValues, IndustryItem } from "@/types/content";
import styles from "@/components/forms/ContactForm.module.scss";

interface ContactFormProps {
  industries: IndustryItem[];
}

type ErrorMap = Partial<Record<keyof ContactFormValues, string>> & {
  form?: string;
};

const INITIAL_VALUES: ContactFormValues = {
  name: "",
  phone: "",
  company: "",
  industry: "",
  request: "",
  consent: false,
  website: ""
};

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.replace(/^375/, "").slice(0, 9);

  if (!local) {
    return "";
  }

  const p1 = local.slice(0, 2);
  const p2 = local.slice(2, 5);
  const p3 = local.slice(5, 7);
  const p4 = local.slice(7, 9);

  let result = "+375";

  if (p1) {
    result += ` (${p1}`;
  }

  if (p1.length === 2) {
    result += ")";
  }

  if (p2) {
    result += ` ${p2}`;
  }

  if (p3) {
    result += `-${p3}`;
  }

  if (p4) {
    result += `-${p4}`;
  }

  return result;
}

function getPhoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("375")) {
    return digits.slice(3, 12);
  }

  return digits.slice(0, 9);
}

export function ContactForm({ industries }: ContactFormProps) {
  const [values, setValues] = useState<ContactFormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [status, setStatus] = useState<ContactFormState>("idle");
  const lastSubmitAt = useRef<number>(0);

  const industryOptions = useMemo(
    () => [
      { value: "", label: "Выберите отрасль" },
      ...industries.map((industry) => ({ value: industry.title, label: industry.title }))
    ],
    [industries]
  );

  function validate(nextValues: ContactFormValues): ErrorMap {
    const nextErrors: ErrorMap = {};

    if (!nextValues.name.trim()) {
      nextErrors.name = "Укажите ваше имя";
    } else if (nextValues.name.trim().length < 2) {
      nextErrors.name = "Имя должно содержать минимум 2 символа";
    }

    const phoneDigits = getPhoneDigits(nextValues.phone);

    if (!nextValues.phone.trim()) {
      nextErrors.phone = "Укажите номер телефона";
    } else if (phoneDigits.length !== 9) {
      nextErrors.phone = "Формат: +375 (XX) XXX-XX-XX";
    }

    if (!nextValues.industry) {
      nextErrors.industry = "Выберите отрасль или тип производства";
    }

    if (!nextValues.request.trim()) {
      nextErrors.request = "Коротко опишите ваш запрос";
    } else if (nextValues.request.trim().length < 10) {
      nextErrors.request = "Описание должно быть не короче 10 символов";
    }

    if (!nextValues.consent) {
      nextErrors.consent = "Подтвердите согласие на обработку данных";
    }

    return nextErrors;
  }

  function setField<K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key]: undefined, form: undefined }));

    if (status !== "idle") {
      setStatus("idle");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const now = Date.now();

    if (now - lastSubmitAt.current < 5000) {
      setErrors({ form: "Пожалуйста, подождите несколько секунд перед повторной отправкой." });
      setStatus("error");
      return;
    }

    if (values.website.trim()) {
      setStatus("success");
      return;
    }

    const validationErrors = validate(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setStatus("error");
      return;
    }

    setErrors({});
    setStatus("submitting");

    const response = await fetch("/api/lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: values.name.trim(),
        company: values.company.trim(),
        phone: values.phone.trim(),
        message: `${values.request.trim()} | Отрасль: ${values.industry}`,
        contactType: "call"
      })
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrors({ form: errorData?.error ?? "Не удалось отправить заявку. Попробуйте позже." });
      setStatus("error");
      return;
    }

    lastSubmitAt.current = Date.now();
    setStatus("success");
  }

  if (status === "success") {
    return (
      <div className={styles.success} role="status">
        <h3>Спасибо, заявку получили.</h3>
        <p>
          Мы свяжемся с вами для консультации и уточнения параметров поставки. Обычно отвечаем в течение
          одного рабочего дня.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            setValues(INITIAL_VALUES);
            setErrors({});
            setStatus("idle");
          }}
        >
          Отправить еще запрос
        </Button>
      </div>
    );
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <input
        autoComplete="off"
        className={styles.honeypot}
        name="website"
        onChange={(event) => setField("website", event.target.value)}
        tabIndex={-1}
        type="text"
        value={values.website}
      />

      <div className={styles.grid}>
        <InputField
          autoComplete="name"
          error={errors.name}
          id="name"
          label="Имя"
          name="name"
          onChange={(event) => setField("name", event.target.value)}
          placeholder="Иван"
          required
          value={values.name}
        />

        <InputField
          autoComplete="tel"
          error={errors.phone}
          id="phone"
          label="Телефон"
          name="phone"
          onChange={(event) => setField("phone", formatPhone(event.target.value))}
          placeholder="+375 (29) 000-00-00"
          required
          value={values.phone}
        />
      </div>

      <InputField
        autoComplete="organization"
        id="company"
        label="Компания"
        name="company"
        onChange={(event) => setField("company", event.target.value)}
        placeholder="Название компании"
        value={values.company}
      />

      <InputField
        as="select"
        error={errors.industry}
        id="industry"
        label="Отрасль / тип производства"
        name="industry"
        onChange={(event) => setField("industry", event.target.value)}
        options={industryOptions}
        required
        value={values.industry}
      />

      <InputField
        as="textarea"
        error={errors.request}
        id="request"
        label="Опишите задачу"
        name="request"
        onChange={(event) => setField("request", event.target.value)}
        placeholder="Какое сырье вам нужно, на какие объемы и сроки ориентируетесь"
        required
        value={values.request}
      />

      <label className={styles.consent} htmlFor="consent">
        <input
          checked={values.consent}
          id="consent"
          name="consent"
          onChange={(event) => setField("consent", event.target.checked)}
          required
          type="checkbox"
        />
        <span>Согласен на обработку контактных данных для обратной связи</span>
      </label>

      {errors.consent ? <p className={styles.error}>{errors.consent}</p> : null}
      {errors.form ? <p className={styles.error}>{errors.form}</p> : null}

      <Button disabled={status === "submitting"} size="lg" type="submit">
        {status === "submitting" ? "Отправляем..." : "Отправить запрос"}
      </Button>
    </form>
  );
}
