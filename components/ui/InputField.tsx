import { ChangeEvent } from "react";
import styles from "@/components/ui/InputField.module.scss";

interface SelectOption {
  label: string;
  value: string;
}

interface BaseProps {
  id: string;
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
}

interface InputProps extends BaseProps {
  as?: "input";
  type?: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  maxLength?: number;
  autoComplete?: string;
}

interface TextAreaProps extends BaseProps {
  as: "textarea";
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  maxLength?: number;
}

interface SelectProps extends BaseProps {
  as: "select";
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
}

type InputFieldProps = InputProps | TextAreaProps | SelectProps;

export function InputField(props: InputFieldProps) {
  const commonProps = {
    id: props.id,
    name: props.name,
    required: props.required,
    "aria-invalid": Boolean(props.error),
    "aria-describedby": props.error ? `${props.id}-error` : undefined,
    className: props.error ? `${styles.field} ${styles.error}` : styles.field
  };

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor={props.id}>
        {props.label}
        {props.required ? <span className={styles.required}>*</span> : null}
      </label>

      {props.as === "textarea" ? (
        <textarea
          {...commonProps}
          maxLength={props.maxLength}
          onChange={props.onChange}
          placeholder={props.placeholder}
          rows={4}
          value={props.value}
        />
      ) : null}

      {props.as === "select" ? (
        <select {...commonProps} onChange={props.onChange} value={props.value}>
          {props.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {props.as === undefined || props.as === "input" ? (
        <input
          {...commonProps}
          autoComplete={props.autoComplete}
          maxLength={props.maxLength}
          onChange={props.onChange}
          placeholder={props.placeholder}
          type={props.type ?? "text"}
          value={props.value}
        />
      ) : null}

      {props.error ? (
        <p className={styles.errorText} id={`${props.id}-error`}>
          {props.error}
        </p>
      ) : null}
    </div>
  );
}
