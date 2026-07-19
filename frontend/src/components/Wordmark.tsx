import { motion, useScroll, useTransform } from "framer-motion";

/** Wordmark: "Ground" in drafting ink, "Work" in blueprint blue.
 *  With merge=true, scrolling collapses "round"/"ork" so GroundWork → GW. */
export default function Wordmark({ merge = false }: { merge?: boolean }) {
  const { scrollY } = useScroll();
  const roundW = useTransform(scrollY, [0, 140], ["5.4ch", "0ch"]);
  const orkW = useTransform(scrollY, [0, 140], ["3.2ch", "0ch"]);
  const fade = useTransform(scrollY, [0, 110], [1, 0]);

  const inner = "inline-block overflow-hidden whitespace-nowrap align-bottom";
  return (
    <span className="font-display text-2xl font-bold tracking-tight select-none">
      <span className="text-ink">G</span>
      {merge ? (
        <motion.span style={{ maxWidth: roundW, opacity: fade }} className={`${inner} text-ink`}>
          round
        </motion.span>
      ) : (
        <span className="text-ink">round</span>
      )}
      <span className="text-blue">W</span>
      {merge ? (
        <motion.span style={{ maxWidth: orkW, opacity: fade }} className={`${inner} text-blue`}>
          ork
        </motion.span>
      ) : (
        <span className="text-blue">ork</span>
      )}
    </span>
  );
}
