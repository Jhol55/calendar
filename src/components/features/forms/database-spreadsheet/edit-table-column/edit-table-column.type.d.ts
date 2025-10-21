export interface EditColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (updatedColumn: ColumnData) => Promise<void>;
  columnData: ColumnData;
}

export interface ColumnData {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  default: string;
}
