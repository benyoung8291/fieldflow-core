import React, { useMemo } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor = React.forwardRef<ReactQuill, RichTextEditorProps>(
  ({ value, onChange, placeholder, className }, ref) => {
    const modules = useMemo(
      () => ({
        toolbar: [
          // Undo/Redo
          ['undo', 'redo'],
          // Font & Size
          [{ font: [] }],
          [{ size: ['small', false, 'large', 'huge'] }],
          // Text styling
          ['bold', 'italic', 'underline', 'strike'],
          // Colors
          [{ color: [] }, { background: [] }],
          // Alignment
          [{ align: [] }],
          // Lists & Indentation
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          // Block elements
          ['blockquote'],
          // Links & Media
          ['link', 'image'],
          // Clear formatting
          ['clean'],
        ],
        keyboard: {
          bindings: {
            // Ensure Cmd+A works properly
            selectAll: {
              key: 'A',
              shortKey: true,
              handler: function() {
                return true;
              }
            }
          },
        },
        clipboard: {
          matchVisual: false,
        },
        history: {
          delay: 1000,
          maxStack: 100,
          userOnly: true,
        },
      }),
      []
    );

    const formats = [
      'font',
      'size',
      'bold',
      'italic',
      'underline',
      'strike',
      'color',
      'background',
      'align',
      'list',
      'bullet',
      'indent',
      'blockquote',
      'link',
      'image',
    ];

    return (
      <div className={cn('rich-text-editor gmail-style', className)}>
        <ReactQuill
          ref={ref}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          className="bg-background"
        />
      </div>
    );
  }
);

RichTextEditor.displayName = 'RichTextEditor';
