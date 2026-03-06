
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Search, ChevronDown, Plus } from 'lucide-react';

export interface DropdownOption {
  id: string;
  title: string; // Main bold text (e.g. Name)
  subtitle?: string; // Secondary text (e.g. Phone/Rate)
  rightText?: string; // Right aligned text (e.g. Location/Unit)
  tag?: string; // The small box on the left (e.g. Code)
  originalData?: any; // Store full object here
}

interface SearchableDropdownProps {
  label?: string;
  placeholder?: string;
  options: DropdownOption[];
  value: string; // The display text in the input
  onChange: (text: string) => void; // Called when user types
  onSelect?: (option: DropdownOption) => void; // Called when user clicks an item
  rightLabelAction?: { label: string; onClick: () => void };
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
}

export const SearchableDropdown = forwardRef<HTMLInputElement, SearchableDropdownProps>(({
  label,
  placeholder,
  options,
  value,
  onChange,
  onSelect,
  rightLabelAction,
  onKeyDown,
  disabled
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [filteredOptions, setFilteredOptions] = useState<DropdownOption[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Filter options based on input value when open
  useEffect(() => {
    if (!isOpen) return;
    
    const search = value.toLowerCase();
    const filtered = options.filter(opt => 
      opt.title.toLowerCase().includes(search) || 
      (opt.subtitle && opt.subtitle.toLowerCase().includes(search)) ||
      (opt.rightText && opt.rightText.toLowerCase().includes(search)) ||
      (opt.tag && opt.tag.toLowerCase().includes(search))
    );
    setFilteredOptions(filtered);
    setHighlightedIndex(0);
  }, [value, options, isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setHighlightedIndex(prev => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setHighlightedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (e.key === 'Enter') {
      if (isOpen && filteredOptions.length > 0) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      } else {
        if (onKeyDown) onKeyDown(e);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else {
      if (onKeyDown) onKeyDown(e);
    }
  };

  const handleSelect = (option: DropdownOption) => {
    onChange(option.title); 
    if (onSelect) onSelect(option);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Label Row */}
      {(label || rightLabelAction) && (
        <div className="flex justify-between items-center mb-1">
          {label && <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</label>}
          {rightLabelAction && (
            <button 
              onClick={(e) => { e.preventDefault(); rightLabelAction.onClick(); }}
              className="text-xs font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus size={12} /> {rightLabelAction.label}
            </button>
          )}
        </div>
      )}

      {/* Input Container */}
      <div className={`relative flex items-center bg-white border rounded-lg transition-all ${isOpen ? 'border-sky-500 ring-2 ring-sky-100' : 'border-gray-300'} ${disabled ? 'bg-gray-50 opacity-70' : ''}`}>
        <Search size={18} className="ml-3 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full p-3 pl-2 outline-none text-gray-900 font-bold bg-transparent placeholder-gray-400 text-sm"
          autoComplete="off"
        />
        {/* Dropdown Arrow Indicator */}
        <div className="mr-3 text-gray-400">
           <ChevronDown size={16} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-sky-100 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          {filteredOptions.map((opt, idx) => (
            <div
              key={opt.id || idx}
              onClick={() => handleSelect(opt)}
              className={`flex items-center p-3 border-b border-gray-50 cursor-pointer transition-colors ${idx === highlightedIndex ? 'bg-sky-50' : 'hover:bg-gray-50'}`}
            >
              {/* Tag/Code Badge */}
              <div className="flex-shrink-0 w-12 h-10 mr-3 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center text-[10px] font-black uppercase tracking-wider border border-gray-200">
                {opt.tag || opt.title.substring(0,2)}
              </div>

              {/* Main Content (Grid-like) */}
              <div className="flex-1 min-w-0 grid grid-cols-12 gap-2 items-center">
                {/* Title */}
                <div className="col-span-8">
                    <span className="text-sm font-bold text-sky-900 block truncate">{opt.title}</span>
                    {opt.subtitle && (
                        <span className="text-[10px] text-gray-500 font-medium block truncate mt-0.5">{opt.subtitle}</span>
                    )}
                </div>
                
                {/* Right Info */}
                <div className="col-span-4 text-right">
                    {opt.rightText && (
                        <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-md whitespace-nowrap">
                            {opt.rightText}
                        </span>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Empty State */}
      {isOpen && filteredOptions.length === 0 && value && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-gray-500 text-xs font-bold">
          No matches found.
        </div>
      )}
    </div>
  );
});

SearchableDropdown.displayName = 'SearchableDropdown';
