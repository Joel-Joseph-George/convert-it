import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-btn text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover shadow-none',
        secondary:
          'bg-card text-foreground border border-border hover:bg-muted shadow-none',
        ghost:
          'hover:bg-muted text-foreground',
        destructive:
          'border border-destructive/30 text-destructive hover:bg-destructive/10',
        outline:
          'border border-border bg-transparent hover:bg-muted text-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2 min-h-[40px]',
        sm: 'h-8 px-3 text-xs min-h-[32px]',
        lg: 'h-11 px-6 min-h-[44px]',
        icon: 'h-10 w-10 min-h-[40px] min-w-[40px]',
        iconSm: 'h-8 w-8 min-h-[32px] min-w-[32px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
