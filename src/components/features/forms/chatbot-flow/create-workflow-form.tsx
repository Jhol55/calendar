'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Form } from '@/components/ui/form';
import { SubmitButton } from '@/components/ui/submit-button';
import { FormControl } from '@/components/ui/form-control';
import { z } from 'zod';
import { FieldValues } from 'react-hook-form';
import { ErrorField } from '@/components/ui/error-field';

interface CreateWorkflowFormProps {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

const workflowSchema = z.object({
  name: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
});

export function CreateWorkflowForm({ onSubmit }: CreateWorkflowFormProps) {
  const handleSubmit = async (data: FieldValues) => {
    onSubmit(data.name as string);
  };

  return (
    <Form
      zodSchema={workflowSchema}
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 w-full h-full overflow-y-auto md:rounded-r-3xl rounded-r-3xl p-4 -z-50 bg-neutral-50"
    >
      <div className="h-full" /> {/* justify-center when overflow */}
      <FormControl variant="label" htmlFor="workflow-name">
        Nome do Workflow
      </FormControl>
      <Input
        id="workflow-name"
        fieldName="name"
        type="text"
        placeholder="Ex: Atendimento WhatsApp"
        autoFocus
      />
      <ErrorField fieldName="name" />
      <div className="flex gap-3 justify-end">
        <SubmitButton variant="gradient">Criar Workflow</SubmitButton>
      </div>
      <div className="h-full" /> {/* justify-center when overflow */}
    </Form>
  );
}
