import { motion, useScroll, useTransform } from "framer-motion";

/** Wordmark: "Ground" in chalk, "Work" on a highlighter stroke.
 *  With merge=true, scrolling collapses "round"/"ork" so GroundWork → GW. */
export default function Wordmark({ merge = false }: { merge?: boolean }) {
  const { scrollY } = useScroll();
  const roundW = useTransform(scrollY, [0, 140], ["5.4ch", "0ch"]);
  const orkW = useTransform(scrollY, [0, 140], ["3.2ch", "0ch"]);
  const fade = useTransform(scrollY, [0, 110], [1, 0]);

  const inner = "inline-block overflow-hidden whitespace-nowrap align-bottom";
  return (
    <span className="font-display text-2xl font-bold tracking-tight select-none">
      <span className="text-card">G</span>
      {merge ? (
        <motion.span style={{ maxWidth: roundW, opacity: fade }} className={`${inner} text-card`}>
          round
        </motion.span>
      ) : (
        <span className="text-card">round</span>
      )}
      <span className="mark rounded-sm">
        <span>W</span>
        {merge ? (
          <motion.span style={{ maxWidth: orkW, opacity: fade }} className={inner}>
            ork
          </motion.span>
        ) : (
          <span>ork</span>
        )}
      </span>
    </span>
  );
}
