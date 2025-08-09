import { useForm } from '@/hooks/use-form';
import { cn } from '@/lib/utils';
import { mergeRefs } from '@/utils/mergeRefs';
import { forwardRef } from 'react';
import { Slot } from './slot';
import { InputOTPProps } from './input-otp.type';

export const InputOTP = forwardRef<HTMLInputElement, InputOTPProps>(
  (
    {
      fieldName,
      length = 1,
      type = 'text',
      containerClassName,
      slotClassName,
      fakeCaretClassName,
      className,
      onChange,
      ...props
    },
    ref,
  ) => {
    const { register, maskSchema, form, setValue } = useForm();
    const {
      ref: registerRef,
      onChange: registerOnChange,
      ...registerProps
    } = register(fieldName);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = (maskSchema?.[fieldName]?.(e) ?? e.target.value).slice(
        0,
        length,
      );
      setValue(fieldName, newValue);
      registerOnChange?.(e);
      onChange?.(e);
    };

    const handleOnMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
      e.preventDefault();
      (e.target as HTMLInputElement).focus();
    };

    return (
      <div className={cn('relative', containerClassName)}>
        <input
          ref={mergeRefs(ref, registerRef)}
          autoComplete="off"
          maxLength={length}
          type={type}
          onChange={handleOnChange}
          onMouseDown={handleOnMouseDown}
          className={cn(
            'absolute w-full h-full text-transparent bg-transparent outline-0 select-none z-50 text-opacity-0',
            className,
          )}
          {...props}
          {...registerProps}
        />
        <div className="flex">
          {Array.from({ length }, (_, index) => (
            <Slot
              key={`${fieldName}-${index}`}
              isActive={(form?.[fieldName] as string)?.length === index}
              className={slotClassName}
              fakeCaretClassName={fakeCaretClassName}
            >
              {(form?.[fieldName] as string)?.charAt(index)}
            </Slot>
          ))}
        </div>
      </div>
    );
  },
);

InputOTP.displayName = 'InputOTP';
