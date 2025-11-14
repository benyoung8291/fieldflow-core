import React from "react";

interface SearchHighlightProps {
  text: string;
  matches?: readonly [number, number][];
  className?: string;
}

export function SearchHighlight({ text, matches, className = "" }: SearchHighlightProps) {
  if (!matches || matches.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  // Sort indices by start position
  const sortedIndices = [...matches].sort((a, b) => a[0] - b[0]);

  sortedIndices.forEach(([start, end], idx) => {
    // Add non-highlighted text before this match
    if (start > lastIndex) {
      parts.push(
        <span key={`text-${idx}`} className={className}>
          {text.slice(lastIndex, start)}
        </span>
      );
    }

    // Add highlighted match
    parts.push(
      <mark
        key={`match-${idx}`}
        className="bg-primary/20 text-primary font-medium rounded px-0.5"
      >
        {text.slice(start, end + 1)}
      </mark>
    );

    lastIndex = end + 1;
  });

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(
      <span key="text-end" className={className}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return <>{parts}</>;
}
