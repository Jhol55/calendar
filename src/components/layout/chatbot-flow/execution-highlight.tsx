'use client';

import React from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface ExecutionHighlightProps {
  status?: 'running' | 'completed' | 'error';
}

export function ExecutionHighlight({ status }: ExecutionHighlightProps) {
  if (!status) return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          bgColor: 'bg-green-100',
          borderColor: 'border-green-500',
          iconColor: 'text-green-600',
        };
      case 'error':
        return {
          icon: <XCircle className="w-4 h-4" />,
          bgColor: 'bg-red-100',
          borderColor: 'border-red-500',
          iconColor: 'text-red-600',
        };
      case 'running':
        return {
          icon: <Clock className="w-4 h-4 animate-spin" />,
          bgColor: 'bg-blue-100',
          borderColor: 'border-blue-500',
          iconColor: 'text-blue-600',
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div
      className={`absolute -top-2 -right-2 ${config.bgColor} ${config.borderColor} ${config.iconColor} border-2 rounded-full p-1 shadow-md z-10`}
      title={`Status: ${status}`}
    >
      {config.icon}
    </div>
  );
}
