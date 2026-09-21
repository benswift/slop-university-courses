import { slopBranding } from "astro-theme-slop";
import { defineSiteConfig } from "astro-theme-university/types";

export const siteConfig = defineSiteConfig({
  ...slopBranding,
  name: "Slop University",
  // the theme renders the logo as this site's home link, so the nav carries
  // the cross-link up to the university rather than repeating it
  links: [
    { text: "Program builder", href: "/program/" },
    { text: "University home", href: "https://slop.university/" },
  ],
  // overrides the brand layer's pair, whose "Programs and courses" entry
  // would be a self-link here
  legalLinks: [{ text: "Slop University", href: "https://slop.university/" }],
  licence: "CC-BY-4.0",
});
