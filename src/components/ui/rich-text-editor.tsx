import React, { useMemo, useEffect } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { cn } from '@/lib/utils';

// Custom Blot to preserve raw HTML (like card snippets)
const BlockEmbed = Quill.import('blots/block/embed');

class KeepHTMLBlot extends BlockEmbed {
  static blotName = 'keepHTML';
  static tagName = 'div';
  static className = 'ql-keep-html';

  static create(value: string) {
    const node = super.create() as HTMLElement;
    
    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'ql-keep-html-content';
    contentWrapper.innerHTML = value;
    node.appendChild(contentWrapper);
    
    // Add delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'ql-keep-html-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.type = 'button';
    deleteBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      node.remove();
    };
    node.appendChild(deleteBtn);
    
    node.setAttribute('contenteditable', 'false');
    node.setAttribute('data-keep-html', 'true');
    return node;
  }

  static value(node: HTMLElement) {
    // Return only the content, not the delete button
    const contentWrapper = node.querySelector('.ql-keep-html-content');
    return contentWrapper ? contentWrapper.innerHTML : node.innerHTML;
  }
}

// Register the custom blot
Quill.register(KeepHTMLBlot, true);

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
      'keepHTML',
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
