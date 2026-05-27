import { motion } from "framer-motion";

// A glassmorphism HUD panel with a title bar and an animated mount.
export default function Panel({ title, status, children, className = "" }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`panel flex min-h-0 flex-col overflow-hidden p-2.5 ${className}`}
    >
      <header className="mb-1.5 flex items-center justify-between">
        <span className="panel-title">{title}</span>
        {status && (
          <span className="flex shrink-0 items-center gap-1 text-[10px] text-nexus-cyan/70">
            <span className="h-1.5 w-1.5 rounded-full bg-nexus-success shadow-glow" />
            {status}
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </motion.section>
  );
}
