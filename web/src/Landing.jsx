// Landing page: what a visitor sees before signing in with a NEAR wallet. Every figure and drawing is read live from the contract.
// The page itself is framework-free (src/landing) and loaded on demand, so the explorer pages never pay for it.
import React, { useEffect, useRef } from "react";
import { signIn } from "./wallet.js";

export default function Landing({ onGuest }) {
  const root = useRef(null);
  useEffect(() => {
    document.title = "Laurel · small models, judged in a TEE, paid on-chain";
    let off = () => {}, left = false;
    import("./landing/mount.js").then(({ mountLanding }) => { if (!left) off = mountLanding(root.current, { onGuest, signIn }); });
    return () => { left = true; off(); };
  }, [onGuest]);
  return <div ref={root} style={{ minHeight: "100vh", background: "#0B0C0F" }} />;
}
