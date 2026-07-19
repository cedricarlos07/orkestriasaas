import brandLogo from "@/assets/brand/orkestria-logo.png.asset.json";
import brandMark from "@/assets/brand/orkestria-mark.png.asset.json";

type Props = {
  className?: string;
  variant?: "full" | "mark";
  alt?: string;
};

export function BrandLogo({ className, variant = "full", alt = "Orkestria" }: Props) {
  const src = variant === "mark" ? brandMark.url : brandLogo.url;
  return <img src={src} alt={alt} className={className} draggable={false} />;
}

export default BrandLogo;