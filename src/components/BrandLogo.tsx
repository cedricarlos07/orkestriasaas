import brandLogo from "@/assets/brand/orkestria-logo.png";
import brandMark from "@/assets/brand/orkestria-mark.png";

type Props = {
  className?: string;
  variant?: "full" | "mark";
  alt?: string;
};

export function BrandLogo({ className, variant = "full", alt = "Orkestria" }: Props) {
  const src = variant === "mark" ? brandMark : brandLogo;
  return <img src={src} alt={alt} className={className} draggable={false} />;
}

export default BrandLogo;