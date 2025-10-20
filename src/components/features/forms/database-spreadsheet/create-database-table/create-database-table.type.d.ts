export interface CreateTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tableName: string, columns: Column[]) => Promise<void>;
}

export interface Column {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  default: string;
}
