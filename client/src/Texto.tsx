// Markdown das respostas. Links do WhatsApp aparecem como botão; os outros abrem fora da app.
import Markdown from "react-markdown";

export default function Texto({ children }: { children: string }) {
  return (
    <Markdown
      components={{
        a: ({ href, children: c }) =>
          href?.startsWith("https://wa.me/") ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#25d366] px-5 py-2.5 text-sm font-medium text-black no-underline"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5 0a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3Z" />
              </svg>
              {c}
            </a>
          ) : (
            <a href={href} target="_blank" rel="noreferrer" className="text-destaque underline">
              {c}
            </a>
          ),
      }}
    >
      {children}
    </Markdown>
  );
}
