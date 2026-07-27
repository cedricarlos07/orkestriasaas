/** Meta brief schema — used for Pipeboard Meta campaign launches. */

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
