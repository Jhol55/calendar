export interface TypographyProps {
  children: React.ReactNode;
  variant?: 'p' | 'b' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  color?: 'text-white' | 'text-black';
  className?: string;
}
