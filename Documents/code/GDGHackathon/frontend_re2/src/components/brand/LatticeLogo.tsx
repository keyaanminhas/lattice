import Link from "next/link";

type LatticeLogoProps = {
  className?: string;
  variant?: "full" | "mark";
  height?: number;
  href?: string | null;
  /** White wordmark for dark backgrounds */
  inverted?: boolean;
};

export function LatticeLogo({
  className = "",
  variant = "full",
  height = 36,
  href = "/",
  inverted = false,
}: LatticeLogoProps) {
  const src =
    variant === "mark"
      ? inverted
        ? "/lattice-mark-light.svg"
        : "/lattice-mark.svg"
      : inverted
        ? "/lattice-logo-light.svg"
        : "/lattice-logo.svg";

  const width = variant === "mark" ? height : Math.round(height * 5);

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Lattice"
      width={width}
      height={height}
      className={`block h-auto max-w-full object-contain object-left ${className}`}
      style={{ height, width: "auto", maxWidth: width }}
    />
  );

  if (href) {
    return (
      <Link href={href} className="inline-block shrink-0">
        {img}
      </Link>
    );
  }
  return img;
}
