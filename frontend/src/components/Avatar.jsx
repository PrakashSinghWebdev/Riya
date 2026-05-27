import { motion } from "framer-motion";

// Semi-human holographic AI core: concentric glowing rings + pulsing eye.
// `speaking` intensifies the pulse. A real avatar render plugs in here later.
export default function Avatar({ speaking = false }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative h-40 w-40">
        {[0, 1, 2].map((ring) => (
          <motion.span
            key={ring}
            className="absolute inset-0 rounded-full border border-nexus-cyan/30"
            animate={{
              scale: speaking ? [1, 1.12, 1] : [1, 1.04, 1],
              opacity: [0.25, 0.6, 0.25],
            }}
            transition={{
              duration: 2 + ring * 0.6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{ margin: ring * 10 }}
          />
        ))}
        <motion.div
          className="absolute inset-10 rounded-full bg-gradient-to-br from-nexus-blue/40 to-nexus-purple/30 shadow-glow backdrop-blur"
          animate={{ opacity: speaking ? [0.6, 1, 0.6] : [0.5, 0.7, 0.5] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="h-5 w-5 rounded-full bg-nexus-cyan shadow-glow"
            animate={{ scale: speaking ? [1, 1.6, 1] : [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </div>
      </div>
    </div>
  );
}
