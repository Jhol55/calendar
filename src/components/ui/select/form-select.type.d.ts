export interface FormSelectProps {
  fieldName: string;
  placeholder?: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  className?: string;
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}
