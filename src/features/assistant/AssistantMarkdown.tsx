import { memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface AssistantMarkdownProps {
	content: string
}

// Light Tailwind styling per element instead of the typography plugin. Raw HTML
// in model output is never rendered (`skipHtml`), and react-markdown's default
// URL transform drops `javascript:` and similar links.
const components: Components = {
	h1: ({ node: _node, ...props }) => (
		<h3 className="mt-3 mb-1 text-base font-semibold first:mt-0" {...props} />
	),
	h2: ({ node: _node, ...props }) => (
		<h3 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...props} />
	),
	h3: ({ node: _node, ...props }) => (
		<h4 className="mt-3 mb-1 text-sm font-semibold first:mt-0" {...props} />
	),
	h4: ({ node: _node, ...props }) => (
		<h4 className="mt-2 mb-1 text-sm font-medium first:mt-0" {...props} />
	),
	p: ({ node: _node, ...props }) => (
		<p className="my-2 leading-relaxed first:mt-0 last:mb-0" {...props} />
	),
	ul: ({ node: _node, ...props }) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
	ol: ({ node: _node, ...props }) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
	li: ({ node: _node, ...props }) => <li className="leading-relaxed" {...props} />,
	strong: ({ node: _node, ...props }) => <strong className="font-semibold" {...props} />,
	a: ({ node: _node, ...props }) => (
		<a
			className="text-primary underline underline-offset-2"
			target="_blank"
			rel="noopener noreferrer"
			{...props}
		/>
	),
	blockquote: ({ node: _node, ...props }) => (
		<blockquote className="my-2 border-l-2 pl-3 text-muted-foreground" {...props} />
	),
	code: ({ node: _node, ...props }) => (
		<code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props} />
	),
	pre: ({ node: _node, ...props }) => (
		<pre className="my-2 overflow-x-auto rounded-md bg-muted p-2 text-xs" {...props} />
	),
	hr: ({ node: _node, ...props }) => <hr className="my-3 border-border" {...props} />,
	table: ({ node: _node, ...props }) => (
		<div className="my-2 overflow-x-auto">
			<table className="w-full border-collapse text-xs" {...props} />
		</div>
	),
	th: ({ node: _node, ...props }) => (
		<th className="border-b px-2 py-1 text-left font-semibold" {...props} />
	),
	td: ({ node: _node, ...props }) => <td className="border-b px-2 py-1 align-top" {...props} />,
}

const remarkPlugins = [remarkGfm]

/** Renders an assistant answer (markdown) safely and compactly. */
function AssistantMarkdown({ content }: AssistantMarkdownProps) {
	return (
		<Markdown remarkPlugins={remarkPlugins} components={components} skipHtml>
			{content}
		</Markdown>
	)
}

export default memo(AssistantMarkdown)
