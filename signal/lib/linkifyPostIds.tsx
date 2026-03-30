import Link from "next/link";
import React from "react";

export function linkifyPostIds(text: string): React.ReactNode[] {
  const regex = /\[([a-z0-9]{5,8})\]/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const id = match[1];
    parts.push(
      <Link
        key={`${id}-${match.index}`}
        href={`/posts?highlight=${id}`}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.9em",
          color: "var(--teal)",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          textUnderlineOffset: "3px",
        }}
      >
        [{id}]
      </Link>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
