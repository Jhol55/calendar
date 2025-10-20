export interface AddColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (columns: Column[]) => Promise<void>;
  tableName: string;
}

export interface Column {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  default: string;
}
