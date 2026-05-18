import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import './Editor.css';

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function Editor({ content, onChange, placeholder = "Start typing your node here..." }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder,
        emptyEditorClass: 'is-editor-empty', 
      }),
    ],
    content: content, 
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    const currentContent = editor.getHTML();

    if (content !== currentContent && !editor.isFocused) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  return (
    <div className="tiptap-container">
      <EditorContent editor={editor} />
    </div>
  );
}

export default Editor;