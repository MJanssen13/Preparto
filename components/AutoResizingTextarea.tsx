import React, { useRef, useLayoutEffect } from 'react';

interface AutoResizingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minFontSize?: number;
}

export const AutoResizingTextarea: React.FC<AutoResizingTextareaProps> = ({
  value,
  minFontSize = 6,
  className,
  style,
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Reset to CSS-defined font size to start fresh
    el.style.fontSize = '';
    
    // Get the computed font size from CSS (this is our max)
    const computedStyle = window.getComputedStyle(el);
    const maxFontSize = parseFloat(computedStyle.fontSize);
    
    if (isNaN(maxFontSize)) return;

    // Helper to check overflow
    // We check if scrollHeight > clientHeight (vertical overflow)
    // or scrollWidth > clientWidth (horizontal overflow for non-wrapping text)
    const checkOverflow = () => {
      return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
    };

    let currentSize = maxFontSize;
    
    // Shrink until it fits or hits min
    // We use a simple loop. For performance on very long text, binary search could be used,
    // but here text is short.
    while (checkOverflow() && currentSize > minFontSize) {
      currentSize--;
      el.style.fontSize = `${currentSize}px`;
    }
    
  }, [value, minFontSize, className, style]); // Re-run when value or styles change

  return (
    <textarea
      ref={textareaRef}
      value={value}
      className={className}
      style={{ 
        textAlign: 'justify', 
        textAlignLast: 'center', // Centers the last line (or single line)
        whiteSpace: 'pre-wrap',
        resize: 'none',
        overflow: 'hidden',
        ...style, 
      }}
      {...props}
    />
  );
};
