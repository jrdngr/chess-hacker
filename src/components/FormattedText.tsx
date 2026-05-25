import { Fragment } from "react";

export function FormattedText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}
