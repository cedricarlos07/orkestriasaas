/** Meta brief schema — passed to upstream adkit (https://github.com/jatinjain25/adkit). */

export type MetaBriefAd = {
  name: string;
  message?: string;
  headline?: string;
  link?: string;
  cta?: string;
  image?: string;
  imageUrl?: string;
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
  };
  adsets: MetaBriefAdSet[];
};
