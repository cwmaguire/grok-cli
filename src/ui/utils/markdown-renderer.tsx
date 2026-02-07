import React from 'react';
import { Text, Box } from 'ink';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { colorizeCode } from './code-colorizer.js';

// Custom code renderer function
const customCodeRenderer = (code: string, language?: string) => {
  // Use our custom syntax highlighter for code blocks
  const highlighted = colorizeCode(code, language || null);
  return highlighted;
};

// Configure marked to use terminal renderer with custom code highlighting
marked.setOptions({
  renderer: new (TerminalRenderer as any)({
    code: customCodeRenderer
  })
});

export function MarkdownRenderer({ content }: { content: string }) {
  try {
    // Use marked.parse for synchronous parsing
    const result = marked.parse(content);
    // Handle both sync and async results
    const rendered = typeof result === 'string' ? result : content;
    return <Text>{rendered}</Text>;
  } catch (error) {
    // Fallback to plain text if markdown parsing fails
    console.error('Markdown rendering error:', error);
    return <Text>{content}</Text>;
  }
}