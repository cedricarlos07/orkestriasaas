/** Meta brief schema — used for Meta campaign launches (paused-first). */

export type MetaBriefAd = {
  name: string;
  message?: string;
  headline?: string;
  link?: string;
  cta?: string;
  callToAction?: string;
  image?: string;
  imageUrl?: string;
  imageHash?: string;
};

export type MetaBriefAdSet = {
  name: string;
  dailyBudget: number;
  countries?: string[];
  interestIds?: string[];
  ads: MetaBriefAd[];
};

export type MetaBrief = {
  campaign: {
    name: string;
    objective?: string;
    dailyBudget?: number;
    /** website | whatsapp | messenger — Messages Ads destinations */
    channel?: "website" | "whatsapp" | "messenger";
  };
  adsets: MetaBriefAdSet[];
};
