import { AnimatePresence, motion } from "framer-motion";

// Right-side slide-over panel used for Memory and Agent surfaces.
export default function Drawer({ open, title, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="panel fixed right-0 top-0 z-30 flex h-full w-[380px] max-w-[90vw] flex-col rounded-none rounded-l-xl p-4"
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: "spring", damping: 26, stiffness: 240 }}
          >
            <header className="mb-3 flex items-center justify-between">
              <span className="panel-title">{title}</span>
              <button
                onClick={onClose}
                className="rounded border border-nexus-blue/30 px-2 text-nexus-blue/70 hover:text-nexus-cyan"
              >
                ✕
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
