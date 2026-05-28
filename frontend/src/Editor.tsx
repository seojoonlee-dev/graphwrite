import { useEffect, useState, type ChangeEvent } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import { Indent } from './Indent';
import './style/Editor.css';

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title: string;
  onTitleChange: (value: string) => void;
}

function Editor({ content, onChange, placeholder = "Start typing your node here...", title, onTitleChange }: EditorProps) {
  const invalidChars = /[\\/:*?"<>|]/;

  const [value, setTitle] = useState(title);
  const [showTitleError, toggleTitleError] = useState(false);

  const titleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const inputValue = event.target.value;
    setTitle(inputValue);

    if(invalidChars.test(inputValue)) {
      toggleTitleError(true);
    } else {
      toggleTitleError(false);
    }
  };

  const titleChangeSave = () => {
    const trimmedValue = value.trim();

    if(invalidChars.test(trimmedValue)) {
      setTitle(title);
      toggleTitleError(false);
      return;
    }

    if (trimmedValue && title !== trimmedValue) {
      onTitleChange(trimmedValue);
    }
  };

  useEffect(() => {
    setTitle(title);
  }, [title]);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: 'is-editor-empty', 
      }),
      Indent.configure({
        names: ['paragraph', 'heading'],
        indentRange: 24,
        maxIndentLevel: 240, 
      }),
    ],
    content: content, 
    contentType: 'markdown',
    onUpdate: ({ editor }) => {
      onChange(editor.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor) return;
    
    const currentContent = editor.getMarkdown();

    if (content !== currentContent && !editor.isFocused) {
      editor.commands.setContent(content, { 
        emitUpdate: false,
        contentType: 'markdown'
      });
    }
  }, [content, editor]);

  return (
    <div>
      <div className="tiptap-container">
        <input 
          type="text" 
          value={value} 
          onChange={titleChange} 
          onBlur={titleChangeSave} 
          id="titleEdit"
        />
        <hr />
        <EditorContent editor={editor} />
      </div>
      <p style={{display: showTitleError ? "flex" : "none"}}className='errorMessage'>File names can't contain \, /, :, *, ?, ", &lt;, &gt;, and |.</p>
    </div>
  );
}

export default Editor;