import React from 'react';
import { Text, Box } from 'ink';
import chalk from 'chalk';

interface Token {
  content: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

const createToken = (content: string, color?: string, bold?: boolean, italic?: boolean): Token => ({
  content,
  color,
  bold,
  italic
});

// Simple syntax highlighting for common languages
const highlightCode = (code: string, language: string | null): Token[][] => {
  const lines = code.split('\n');

  return lines.map(line => {
    const tokens: Token[] = [];

    if (!language || language === 'text' || language === 'plain') {
      return [createToken(line)];
    }

    // JavaScript/TypeScript highlighting
    if (['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'].includes(language)) {
      return highlightJavaScript(line);
    }

    // Python highlighting
    if (['python', 'py'].includes(language)) {
      return highlightPython(line);
    }

    // Shell/Bash highlighting
    if (['bash', 'shell', 'sh', 'zsh'].includes(language)) {
      return highlightShell(line);
    }

    // JSON highlighting
    if (['json'].includes(language)) {
      return highlightJSON(line);
    }

    // Default: basic keyword highlighting
    return highlightGeneric(line);
  });
};

const highlightJavaScript = (line: string): Token[] => {
  const tokens: Token[] = [];
  let remaining = line;
  let match;

  // Keywords
  const keywords = /\b(const|let|var|function|class|if|else|for|while|return|import|export|from|async|await|try|catch|finally|throw)\b/g;
  while ((match = keywords.exec(remaining)) !== null) {
    // Add text before match
    if (match.index > 0) {
      tokens.push(createToken(remaining.slice(0, match.index)));
    }
    // Add keyword
    tokens.push(createToken(match[0], 'cyan', true));
    remaining = remaining.slice(match.index + match[0].length);
    keywords.lastIndex = 0;
  }

  // Strings
  if (remaining) {
    const stringRegex = /(["'`])(.*?)\1/g;
    while ((match = stringRegex.exec(remaining)) !== null) {
      if (match.index > 0) {
        tokens.push(createToken(remaining.slice(0, match.index)));
      }
      tokens.push(createToken(match[0], 'green'));
      remaining = remaining.slice(match.index + match[0].length);
      stringRegex.lastIndex = 0;
    }
  }

  // Numbers
  if (remaining) {
    const numberRegex = /\b\d+(\.\d+)?\b/g;
    while ((match = numberRegex.exec(remaining)) !== null) {
      if (match.index > 0) {
        tokens.push(createToken(remaining.slice(0, match.index)));
      }
      tokens.push(createToken(match[0], 'yellow'));
      remaining = remaining.slice(match.index + match[0].length);
      numberRegex.lastIndex = 0;
    }
  }

  // Comments
  if (remaining) {
    const commentRegex = /(\/\/.*$|\/\*.*?\*\/)/g;
    while ((match = commentRegex.exec(remaining)) !== null) {
      if (match.index > 0) {
        tokens.push(createToken(remaining.slice(0, match.index)));
      }
      tokens.push(createToken(match[0], 'gray', false, true));
      remaining = remaining.slice(match.index + match[0].length);
      commentRegex.lastIndex = 0;
    }
  }

  if (remaining) {
    tokens.push(createToken(remaining));
  }

  return tokens;
};

const highlightPython = (line: string): Token[] => {
  const tokens: Token[] = [];
  let remaining = line;
  let match;

  // Keywords
  const keywords = /\b(def|class|if|elif|else|for|while|return|import|from|try|except|finally|with|as|lambda|and|or|not|in|is)\b/g;
  while ((match = keywords.exec(remaining)) !== null) {
    if (match.index > 0) {
      tokens.push(createToken(remaining.slice(0, match.index)));
    }
    tokens.push(createToken(match[0], 'cyan', true));
    remaining = remaining.slice(match.index + match[0].length);
    keywords.lastIndex = 0;
  }

  // Strings
  if (remaining) {
    const stringRegex = /(["'`])(.*?)\1/g;
    while ((match = stringRegex.exec(remaining)) !== null) {
      if (match.index > 0) {
        tokens.push(createToken(remaining.slice(0, match.index)));
      }
      tokens.push(createToken(match[0], 'green'));
      remaining = remaining.slice(match.index + match[0].length);
      stringRegex.lastIndex = 0;
    }
  }

  // Comments
  if (remaining) {
    const commentRegex = /(#.*$)/g;
    while ((match = commentRegex.exec(remaining)) !== null) {
      if (match.index > 0) {
        tokens.push(createToken(remaining.slice(0, match.index)));
      }
      tokens.push(createToken(match[0], 'gray', false, true));
      remaining = remaining.slice(match.index + match[0].length);
      commentRegex.lastIndex = 0;
    }
  }

  if (remaining) {
    tokens.push(createToken(remaining));
  }

  return tokens;
};

const highlightShell = (line: string): Token[] => {
  const tokens: Token[] = [];
  let remaining = line;
  let match;

  // Commands (common shell commands)
  const commands = /\b(echo|ls|cd|pwd|mkdir|rm|cp|mv|cat|grep|find|sudo|apt|systemctl|docker|git|npm|yarn)\b/g;
  while ((match = commands.exec(remaining)) !== null) {
    if (match.index > 0) {
      tokens.push(createToken(remaining.slice(0, match.index)));
    }
    tokens.push(createToken(match[0], 'cyan', true));
    remaining = remaining.slice(match.index + match[0].length);
    commands.lastIndex = 0;
  }

  // Flags and options
  if (remaining) {
    const flagsRegex = /(\s+)(-\w+|--[\w-]+)/g;
    while ((match = flagsRegex.exec(remaining)) !== null) {
      if (match.index > 0) {
        tokens.push(createToken(remaining.slice(0, match.index)));
      }
      tokens.push(createToken(match[0], 'yellow'));
      remaining = remaining.slice(match.index + match[0].length);
      flagsRegex.lastIndex = 0;
    }
  }

  // Strings
  if (remaining) {
    const stringRegex = /(["'`])(.*?)\1/g;
    while ((match = stringRegex.exec(remaining)) !== null) {
      if (match.index > 0) {
        tokens.push(createToken(remaining.slice(0, match.index)));
      }
      tokens.push(createToken(match[0], 'green'));
      remaining = remaining.slice(match.index + match[0].length);
      stringRegex.lastIndex = 0;
    }
  }

  // Comments
  if (remaining) {
    const commentRegex = /(#.*$)/g;
    while ((match = commentRegex.exec(remaining)) !== null) {
      if (match.index > 0) {
        tokens.push(createToken(remaining.slice(0, match.index)));
      }
      tokens.push(createToken(match[0], 'gray', false, true));
      remaining = remaining.slice(match.index + match[0].length);
      commentRegex.lastIndex = 0;
    }
  }

  if (remaining) {
    tokens.push(createToken(remaining));
  }

  return tokens;
};

const highlightJSON = (line: string): Token[] => {
  const tokens: Token[] = [];
  let remaining = line;
  let match;

  // Keys (before colons)
  const keyRegex = /"([^"]+)":/g;
  while ((match = keyRegex.exec(remaining)) !== null) {
    if (match.index > 0) {
      tokens.push(createToken(remaining.slice(0, match.index)));
    }
    tokens.push(createToken(`"${match[1]}":`, 'cyan', true));
    remaining = remaining.slice(match.index + match[0].length);
    keyRegex.lastIndex = 0;
  }

  // Strings
  if (remaining) {
    const stringRegex = /"([^"]*)"/g;
    while ((match = stringRegex.exec(remaining)) !== null) {
      if (match.index > 0) {
        tokens.push(createToken(remaining.slice(0, match.index)));
      }
      tokens.push(createToken(match[0], 'green'));
      remaining = remaining.slice(match.index + match[0].length);
      stringRegex.lastIndex = 0;
    }
  }

  // Numbers and booleans
  if (remaining) {
    const valueRegex = /\b(\d+(\.\d+)?|true|false|null)\b/g;
    while ((match = valueRegex.exec(remaining)) !== null) {
      if (match.index > 0) {
        tokens.push(createToken(remaining.slice(0, match.index)));
      }
      tokens.push(createToken(match[0], 'yellow'));
      remaining = remaining.slice(match.index + match[0].length);
      valueRegex.lastIndex = 0;
    }
  }

  if (remaining) {
    tokens.push(createToken(remaining));
  }

  return tokens;
};

const highlightGeneric = (line: string): Token[] => {
  const tokens: Token[] = [];
  let remaining = line;
  let match;

  // Basic keyword highlighting for common patterns
  const keywords = /\b(function|class|if|else|for|while|return|import|export|const|let|var|def|print)\b/g;
  while ((match = keywords.exec(remaining)) !== null) {
    if (match.index > 0) {
      tokens.push(createToken(remaining.slice(0, match.index)));
    }
    tokens.push(createToken(match[0], 'cyan', true));
    remaining = remaining.slice(match.index + match[0].length);
    keywords.lastIndex = 0;
  }

  if (remaining) {
    tokens.push(createToken(remaining));
  }

  return tokens;
};

const renderToken = (token: Token): React.ReactNode => {
  let styled = token.content;

  if (token.color) {
    switch (token.color) {
      case 'cyan':
        styled = chalk.cyan(styled);
        break;
      case 'green':
        styled = chalk.green(styled);
        break;
      case 'yellow':
        styled = chalk.yellow(styled);
        break;
      case 'gray':
        styled = chalk.gray(styled);
        break;
      case 'blue':
        styled = chalk.blue(styled);
        break;
      case 'red':
        styled = chalk.red(styled);
        break;
    }
  }

  if (token.bold) {
    styled = chalk.bold(styled);
  }

  if (token.italic) {
    styled = chalk.italic(styled);
  }

  return styled;
};

export const colorizeCode = (
  content: string,
  language: string | null,
  availableTerminalHeight?: number,
  terminalWidth?: number
): React.ReactNode => {
  const highlightedLines = highlightCode(content, language);

  return (
    <Box flexDirection="column">
      {highlightedLines.map((tokens, lineIndex) => (
        <Text key={lineIndex} wrap="wrap">
          {tokens.map((token, tokenIndex) => (
            <React.Fragment key={tokenIndex}>
              {renderToken(token)}
            </React.Fragment>
          ))}
        </Text>
      ))}
    </Box>
  );
};