
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false 
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-b from-amber-300 to-amber-400 border-2 border-black text-black';
      case 'secondary':
        return 'bg-gradient-to-b from-blue-500 to-blue-600 border-2 border-black text-white';
      case 'danger':
        return 'bg-gradient-to-b from-rose-500 to-red-600 border-2 border-black text-white';
      default:
        return 'bg-gradient-to-b from-amber-300 to-amber-400 border-2 border-black text-black';
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        btn-3d w-full py-4 px-6 rounded-2xl font-black text-xl uppercase tracking-wider
        disabled:opacity-40 disabled:cursor-not-allowed select-none
        ${getVariantStyles()}
        ${className}
      `}
    >
      {children}
    </button>
  );
};
