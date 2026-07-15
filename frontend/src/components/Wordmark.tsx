import { motion, useScroll, useTransform } from "framer-motion";

/** Two-tone wordmark: "Ground" in white, "Work" in violet.
 *  With merge=true, scrolling collapses "round"/"ork" so GroundWork → GW. */
export default function Wordmark({ merge = false }: { merge?: boolean }) {
  const { scrollY } = useScroll();
  const roundW = useTransform(scrollY, [0, 140], ["5.4ch", "0ch"]);
  const orkW = useTransform(scrollY, [0, 140], ["3.2ch", "0ch"]);
  const fade = useTransform(scrollY, [0, 110], [1, 0]);

  const inner = "inline-block overflow-hidden whitespace-nowrap align-bottom";
  return (
    <span className="font-display text-2xl font-bold tracking-tight select-none">
      <span className="text-zinc-100">G</span>
      {merge ? (
        <motion.span style={{ maxWidth: roundW, opacity: fade }} className={`${inner} text-zinc-100`}>
          round
        </motion.span>
      ) : (
        <span className="text-zinc-100">round</span>
      )}
      <span className="text-violet-400">W</span>
      {merge ? (
        <motion.span style={{ maxWidth: orkW, opacity: fade }} className={`${inner} text-violet-400`}>
          ork
        </motion.span>
      ) : (
        <span className="text-violet-400">ork</span>
      )}
    </span>
  );
}
