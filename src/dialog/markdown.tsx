import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * SDV-styled streaming markdown renderer. Strips out the React/HTML noise to keep
 * the paper panel readable in pixel font: paragraphs, lists, inline code, simple bold.
 * Code blocks render with a faint sepia background so they don't look out of place.
 */
export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
        ul: ({ children }) => <ul style={{ paddingLeft: 18, margin: '0 0 8px 0' }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ paddingLeft: 18, margin: '0 0 8px 0' }}>{children}</ol>,
        li: ({ children }) => <li style={{ marginBottom: 2 }}>{children}</li>,
        code: ({ children, ...props }) => (
          ('inline' in props && props.inline)
            ? <code style={{ background: '#e8c896', padding: '0 4px', borderRadius: 2 }}>{children}</code>
            : <pre style={{ background: '#e8c896', padding: 8, borderRadius: 2, overflow: 'auto', margin: '0 0 8px 0' }}><code>{children}</code></pre>
        ),
        a: ({ children, href }) => <a href={href} style={{ color: '#5478aa', textDecoration: 'underline' }}>{children}</a>,
        strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
        em: ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}
