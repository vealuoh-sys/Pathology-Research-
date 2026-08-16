import React from 'react';
import { EditorCommand, EditorCommandList, EditorCommandItem, EditorCommandEmpty } from 'novel';

export function SlashMenu() {
  return (
    <EditorCommand className="z-50 h-auto max-h-[330px] w-72 overflow-y-auto rounded-md border border-muted bg-background px-1 py-2 shadow-md transition-all">
      <EditorCommandEmpty className="px-2 text-muted-foreground">No results</EditorCommandEmpty>
      <EditorCommandList>
        <EditorCommandItem onCommand={(val) => console.log(val)}>AI Autocomplete</EditorCommandItem>
      </EditorCommandList>
    </EditorCommand>
  );
}
