import { motion } from 'framer-motion'

export function PlaceholderPage({
  title,
  description = 'This route is wired up; build the real UI here.',
  meta,
}: {
  title: string
  description?: string
  meta?: Record<string, string | undefined>
}) {
  return (
    <motion.div
      className="space-y-2"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground max-w-prose">{description}</p>
      {meta && Object.keys(meta).length > 0 ? (
        <ul className="text-muted-foreground mt-4 space-y-2 text-sm">
          {Object.entries(meta).map(([k, v]) =>
            v != null && v !== '' ? (
              <li key={k} className="flex flex-wrap gap-2">
                <span className="font-medium text-foreground">{k}</span>
                <span className="font-mono text-xs">{v}</span>
              </li>
            ) : null,
          )}
        </ul>
      ) : null}
    </motion.div>
  )
}
