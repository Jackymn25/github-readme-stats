// @ts-check

import { createRequire } from "module";

const require = createRequire(import.meta.url);
const languageColors = require("./languageColors.json");

const topLanguagesColorOverrides = {
  Java: "#FFA726",
  TypeScript: "#FFFFFF",
  C: "#FF00FF",
};

/**
 * Resolve language color for top-languages card.
 *
 * @param {string} languageName Language name.
 * @param {string | null | undefined} fallbackColor Existing color (e.g. from GitHub API).
 * @returns {string} Resolved language color.
 */
const resolveTopLanguageColor = (languageName, fallbackColor) => {
  if (topLanguagesColorOverrides[languageName]) {
    return topLanguagesColorOverrides[languageName];
  }
  if (fallbackColor) {
    return fallbackColor;
  }
  return languageColors[languageName] || "#858585";
};

export { resolveTopLanguageColor, topLanguagesColorOverrides };
