import type { ReactNode } from "react";
import amazonLogo from "@/assets/platforms/amazon.svg";
import linkedinLogo from "@/assets/platforms/linkedin.svg";
import microsoftLogo from "@/assets/platforms/microsoft.svg";
import googleAdsMark from "@/assets/platforms/google-ads-mark.svg";
import metaMark from "@/assets/platforms/meta-mark.svg";
import whatsappMark from "@/assets/platforms/whatsapp-mark.svg";
import shopifyMark from "@/assets/platforms/shopify-mark.svg";

/** Brand marks — Meta / Google Ads / WhatsApp / Shopify from Wikimedia Commons. */

type IconProps = { className?: string; title?: string };

function ImgIcon({ src, className, title }: IconProps & { src: string }) {
  return (
    <img
      src={src}
      alt={title ?? ""}
      className={className ?? "h-5 w-5 object-contain"}
      width={20}
      height={20}
      loading="lazy"
      decoding="async"
    />
  );
}

function Svg({
  className,
  title,
  children,
  viewBox = "0 0 24 24",
}: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      className={className ?? "h-5 w-5"}
      viewBox={viewBox}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function GoogleAdsIcon({ className, title = "Google Ads" }: IconProps) {
  return <ImgIcon src={googleAdsMark} className={className} title={title} />;
}

export function MetaIcon({ className, title = "Meta" }: IconProps) {
  return <ImgIcon src={metaMark} className={className} title={title} />;
}

export function LinkedInIcon({ className, title = "LinkedIn" }: IconProps) {
  return <ImgIcon src={linkedinLogo} className={className} title={title} />;
}

export function TikTokIcon({ className, title = "TikTok" }: IconProps) {
  return (
    <Svg className={className} title={title}>
      <path
        fill="#000"
        d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.49V9.45a8.2 8.2 0 005.58 2.14V8.14a4.85 4.85 0 01-1.99-1.45z"
      />
    </Svg>
  );
}

export function SnapchatIcon({ className, title = "Snapchat" }: IconProps) {
  return (
    <Svg className={className} title={title}>
      <circle cx="12" cy="12" r="11" fill="#FFFC00" />
      <path
        fill="#111"
        d="M12.1 5.2c1.55 0 2.55.7 2.9 1.85.15.5.15 1.05.1 1.55v.85c.55.15 1.35.4 1.8 1.05.35.5.25 1.1-.2 1.45-.25.2-.55.3-.9.3-.15 0-.3 0-.45-.05.05.4.05.85-.1 1.25-.25.75-.85 1.35-1.65 1.65.3.4.7.75 1.25 1.05.4.2.5.65.3 1-.15.25-.4.4-.7.4-.1 0-.2 0-.3-.05-.75-.3-1.4-.4-2.05-.4-.25 0-.5 0-.75.05-.05.4-.2 1.05-.65 1.4-.25.2-.6.2-.85 0-.45-.35-.6-1-.65-1.4-.25-.05-.5-.05-.75-.05-.65 0-1.3.1-2.05.4-.1.05-.2.05-.3.05-.3 0-.55-.15-.7-.4-.2-.35-.1-.8.3-1 .55-.3.95-.65 1.25-1.05-.8-.3-1.4-.9-1.65-1.65-.15-.4-.15-.85-.1-1.25-.15.05-.3.05-.45.05-.35 0-.65-.1-.9-.3-.45-.35-.55-.95-.2-1.45.45-.65 1.25-.9 1.8-1.05v-.85c-.05-.5-.05-1.05.1-1.55.35-1.15 1.35-1.85 2.9-1.85h.2z"
      />
    </Svg>
  );
}

export function RedditIcon({ className, title = "Reddit" }: IconProps) {
  return (
    <Svg className={className} title={title}>
      <circle cx="12" cy="12" r="12" fill="#FF4500" />
      <circle cx="12" cy="13.2" r="5.2" fill="#fff" />
      <circle cx="9.8" cy="12.6" r="1.1" fill="#FF4500" />
      <circle cx="14.2" cy="12.6" r="1.1" fill="#FF4500" />
      <path fill="none" stroke="#FF4500" strokeWidth="1.2" strokeLinecap="round" d="M9.6 15.2c.7.7 1.7 1 2.4 1s1.7-.3 2.4-1" />
      <circle cx="16.8" cy="9.2" r="1.3" fill="#fff" />
      <path stroke="#fff" strokeWidth="1.4" d="M14.8 8.2 13.2 5.6" />
      <circle cx="12.8" cy="5.2" r="1.1" fill="#fff" />
    </Svg>
  );
}

export function MicrosoftIcon({ className, title = "Microsoft" }: IconProps) {
  return <ImgIcon src={microsoftLogo} className={className} title={title} />;
}

export function XIcon({ className, title = "X" }: IconProps) {
  return (
    <Svg className={className} title={title}>
      <path
        fill="#000"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </Svg>
  );
}

export function AmazonIcon({ className, title = "Amazon" }: IconProps) {
  return <ImgIcon src={amazonLogo} className={className} title={title} />;
}

export function PinterestIcon({ className, title = "Pinterest" }: IconProps) {
  return (
    <Svg className={className} title={title}>
      <path
        fill="#E60023"
        d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.219-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.334 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.001 24c6.624 0 11.999-5.373 11.999-12C24 5.372 18.627.001 12.001.001z"
      />
    </Svg>
  );
}

export function Ga4Icon({ className, title = "Google Analytics" }: IconProps) {
  return (
    <Svg className={className} title={title}>
      <path
        fill="#E37400"
        d="M22.84 2.98v17.99a3.02 3.02 0 01-3.02 3.02c-1.67 0-3.02-1.35-3.02-3.02V2.98A3.02 3.02 0 0119.82 0c1.66 0 3.02 1.35 3.02 2.98z"
      />
      <path
        fill="#F9AB00"
        d="M15.1 9.5v11.47a3.02 3.02 0 01-3.02 3.02c-1.67 0-3.02-1.35-3.02-3.02V9.5A3.02 3.02 0 0112.08 6.48c1.66 0 3.02 1.35 3.02 3.02z"
      />
      <circle fill="#E37400" cx="4.86" cy="19.14" r="3.02" />
    </Svg>
  );
}

export function WhatsAppIcon({ className, title = "WhatsApp" }: IconProps) {
  return <ImgIcon src={whatsappMark} className={className} title={title} />;
}

export function ShopifyIcon({ className, title = "Shopify" }: IconProps) {
  return <ImgIcon src={shopifyMark} className={className} title={title} />;
}

export function ResearchIcon({ className, title = "Recherche" }: IconProps) {
  return (
    <Svg className={className} title={title}>
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="#64748b" strokeWidth="2" />
      <path stroke="#64748b" strokeWidth="2" strokeLinecap="round" d="M15.5 15.5 21 21" />
    </Svg>
  );
}

const BY_ID: Record<string, (p: IconProps) => ReactNode> = {
  google_ads: (p) => <GoogleAdsIcon {...p} />,
  meta_ads: (p) => <MetaIcon {...p} />,
  linkedin_ads: (p) => <LinkedInIcon {...p} />,
  tiktok_ads: (p) => <TikTokIcon {...p} />,
  snapchat_ads: (p) => <SnapchatIcon {...p} />,
  reddit_ads: (p) => <RedditIcon {...p} />,
  microsoft_ads: (p) => <MicrosoftIcon {...p} />,
  x_ads: (p) => <XIcon {...p} />,
  amazon_ads: (p) => <AmazonIcon {...p} />,
  pinterest_ads: (p) => <PinterestIcon {...p} />,
  google_analytics: (p) => <Ga4Icon {...p} />,
  ga4: (p) => <Ga4Icon {...p} />,
  whatsapp: (p) => <WhatsAppIcon {...p} />,
  shopify: (p) => <ShopifyIcon {...p} />,
  research: (p) => <ResearchIcon {...p} />,
};

export function BrandIcon({ id, className, title }: IconProps & { id: string }) {
  const render = BY_ID[id];
  if (!render) {
    return (
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded bg-surface-2 text-[10px] text-ink-soft ${className ?? ""}`}
      >
        ?
      </span>
    );
  }
  return <>{render({ className: className ?? "h-5 w-5 shrink-0", title })}</>;
}
