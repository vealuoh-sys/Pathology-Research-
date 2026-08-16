import React, { useState, useEffect, useRef } from 'react';
import { EditorRoot, EditorContent, HighlightExtension, EditorCommand, EditorCommandEmpty, EditorCommandList, EditorCommandItem, EditorBubble } from 'novel';
import StarterKit from '@tiptap/starter-kit';
import { marked } from 'marked';
import { useCompletion } from '@ai-sdk/react';
import { Loader2, Wand2 } from 'lucide-react';

const extensions = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3],
    },
  }),
  HighlightExtension.configure({
    multicolor: true,
  }),
];

export function ManuscriptEditor({ initialContent, onChange, flags = [] }: any) {
  const [content, setContent] = useState<string>('');
  const editorRef = useRef<any>(null);
  const streamCursorRef = useRef<number | null>(null);

  const { complete, completion, isLoading } = useCompletion({
    api: '/api/generate-style',
    onFinish: (prompt, result) => {
      // Clear streaming state
      streamCursorRef.current = null;
    }
  });

  // Handle streaming updates
  const lastCompletionLength = useRef(0);
  useEffect(() => {
    if (completion && editorRef.current && streamCursorRef.current !== null) {
      const editor = editorRef.current;
      const newText = completion.substring(lastCompletionLength.current);
      if (newText) {
        editor.commands.insertContentAt(streamCursorRef.current, newText);
        streamCursorRef.current += newText.length;
        lastCompletionLength.current = completion.length;
      }
    }
  }, [completion]);

  useEffect(() => {
    if (!isLoading) {
      lastCompletionLength.current = 0;
    }
  }, [isLoading]);

  useEffect(() => {
    let html = marked.parse(initialContent) as string;
    flags.forEach((f: any) => {
      if (f.quote) {
        const highlighted = `<mark data-color="#ef4444" style="background-color: rgba(239, 68, 68, 0.2); color: #ef4444; border-radius: 4px; padding: 0 4px;">${f.quote}</mark>`;
        html = html.replace(f.quote, highlighted);
      }
    });
    
    // If editor exists, update it, otherwise set initial state
    if (editorRef.current) {
       const currentHtml = editorRef.current.getHTML();
       if (currentHtml !== html) {
          editorRef.current.commands.setContent(html);
       }
    } else {
       setContent(html);
    }
  }, [initialContent, flags]);

  if (!content && !editorRef.current) return null;

  return (
    <div className="relative w-full max-w-full overflow-hidden prose prose-sm dark:prose-invert">
      <EditorRoot>
        <EditorContent
          initialContent={content as any}
          extensions={extensions}
          onUpdate={({ editor }: any) => {
            onChange(editor.getHTML());
            editorRef.current = editor;
          }}
          onTransaction={({ editor }: any) => {
            if (!editorRef.current) {
              editorRef.current = editor;
              // Sync the parsed html now that editor exists
              editor.commands.setContent(content);
            }
          }}
          className="p-6 border border-[var(--border-color)] rounded-xl bg-[var(--bg-app)] text-[var(--text-primary)] font-serif min-h-[200px]"
          editorProps={{
            attributes: {
              class: 'prose prose-sm dark:prose-invert sm:prose-base focus:outline-none max-w-full',
            },
          }}
        >
          <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-[var(--border-color)] bg-[var(--bg-app)] px-1 py-2 shadow-md transition-all w-64">
            <EditorCommandEmpty className="px-2 text-xs text-[var(--text-muted)]">No results</EditorCommandEmpty>
            <EditorCommandList>
              <EditorCommandItem
                value="Autocomplete"
                onCommand={({ editor, range }: any) => {
                  editor.chain().focus().deleteRange(range).run();
                  streamCursorRef.current = range.from;
                  const textContext = editor.getText().substring(0, range.from);
                  complete(textContext.slice(-500)); // send last 500 chars as context
                }}
                className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-[var(--accent-primary)] hover:text-white rounded cursor-pointer"
              >
                <Wand2 className="w-4 h-4" /> AI Autocomplete
              </EditorCommandItem>
            </EditorCommandList>
          </EditorCommand>
        </EditorContent>
      </EditorRoot>
      
      {isLoading && (
        <div className="absolute bottom-4 right-4 bg-[var(--bg-app)] border border-[var(--border-color)] px-3 py-1.5 rounded-full flex items-center gap-2 text-xs text-[var(--text-primary)] shadow-sm z-50">
          <Loader2 className="w-3 h-3 animate-spin text-[var(--accent-primary)]" />
          Generating...
        </div>
      )}
    </div>
  );
}
