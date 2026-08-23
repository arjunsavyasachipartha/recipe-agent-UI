import Image from "next/image";
import icon from "@/assets/icon.png";

// The BornBhukkad brand mark — the official "b" logo (src/assets/icon.png) plus
// an optional serif wordmark. Reused across the auth page, the agents picker,
// and the workspace sidebar so the whole product reads as one brand.
//
// Props:
//   size       — logo edge length in px (default 30)
//   showWord   — render the "BornBhukkad" wordmark beside the logo (default true)
//   word       — override the wordmark text
export default function BrandMark({ size = 30, showWord = true, word = "BornBhukkad" }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: showWord ? "0.55rem" : 0,
      }}
    >
      <Image
        src={icon}
        alt={showWord ? "" : "BornBhukkad"}
        width={size}
        height={size}
        priority
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          display: "block",
          flex: "0 0 auto",
        }}
      />
      {showWord && (
        <span
          style={{
            fontFamily: "var(--font-title)",
            fontSize: `${Math.max(size * 0.6, 16)}px`,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
            whiteSpace: "nowrap",
          }}
        >
          {word}
        </span>
      )}
    </span>
  );
}
