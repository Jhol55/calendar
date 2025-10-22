import React from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}
