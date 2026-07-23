import brandLogo from "@/assets/brand/orkestria-logo.png";
import brandLogoOnDark from "@/assets/brand/orkestria-logo-on-dark.png";
import brandMark from "@/assets/brand/orkestria-mark.png";

type Props = {
  className?: string;
  /** full = orange mark + dark wordmark (light bg). onDark = white lockup. mark = orange icon only. */
  variant?: "full" | "mark" | "onDark";
  alt?: string;
};

export function BrandLogo({ className, variant = "full", alt = "Orkestria" }: Props) {
  const src = variant === "mark" ? brandMark : variant === "onDark" ? brandLogoOnDark : brandLogo;
  return <img src={src} alt={alt} className={className} draggable={false} />;
}

export default BrandLogo;
