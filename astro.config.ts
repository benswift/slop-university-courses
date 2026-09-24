import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import universityTheme from "astro-theme-university";

export default defineConfig({
  // Astro 7's default ("jsx") drops the line break between wrapped prose and
  // an inline element, running words into links. `true` collapses it to a space.
  compressHTML: true,
  site: "https://courses.slop.university",
  output: "static",
  trailingSlash: "always",
  integrations: [
    universityTheme({
      name: "Slop University Courses",
      brandCss: "astro-theme-slop/slop.css",
      imageFormat: "avif",
      llmsTxt: true,
      search: false,
    }),
    sitemap(),
  ],
});
