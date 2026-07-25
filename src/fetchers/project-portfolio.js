// @ts-check

import { createRequire } from "module";
import { MissingParamError } from "../common/error.js";

const require = createRequire(import.meta.url);
const profile = require("../../profiles/Jackymn25.json");

const aggregate = (projects, key, value) => {
  const summary = new Map();
  for (const project of projects) {
    for (const item of project[key]) {
      const entry = summary.get(item) || { name: item, lines: 0, projects: 0 };
      entry.lines += value(project, item);
      entry.projects += 1;
      summary.set(item, entry);
    }
  }
  return [...summary.values()].sort((a, b) => b.lines - a.lines || b.projects - a.projects);
};

const mergeEntries = (entries, aggregateEntries) => {
  const merged = new Map(entries.map((entry) => [entry.name, { ...entry }]));
  for (const entry of aggregateEntries) {
    const current = merged.get(entry.name) || { name: entry.name, lines: 0, projects: 0 };
    current.lines += entry.lines || 0;
    current.projects += entry.projects || 0;
    merged.set(entry.name, current);
  }
  return [...merged.values()].sort((a, b) => b.lines - a.lines || b.projects - a.projects);
};

/**
 * Read the checked-in public-project profile and calculate card aggregates.
 *
 * @param {string} username GitHub username.
 * @returns {object} Portfolio data.
 */
const fetchProjectPortfolio = (username) => {
  if (!username) {
    throw new MissingParamError(["username"]);
  }
  if (username.toLowerCase() !== profile.username.toLowerCase()) {
    throw new Error("No public project profile is configured for this username.");
  }
  const projects = profile.projects
    .filter((project) => project.include)
    .sort((a, b) => b.countedLines - a.countedLines);
  const privateAggregate = profile.privateAggregate || { projectCount: 0, languages: {}, tags: [], tools: [] };
  const publicLanguages = Object.entries(
    projects.reduce((total, project) => {
      for (const [language, lines] of Object.entries(project.languages)) {
        if (!profile.analysis.ignoredLanguages.includes(language)) {
          total[language] = (total[language] || 0) + lines;
        }
      }
      return total;
    }, {}),
  ).map(([name, lines]) => ({ name, lines, projects: 0 }));
  const privateLanguages = Object.entries(privateAggregate.languages)
    .map(([name, lines]) => ({ name, lines, projects: 0 }));
  const totalCodeLines = (profile.domains || []).reduce(
    (sum, domain) => sum + domain.lines,
    0,
  );
  return {
    username: profile.username,
    displayName: profile.displayName,
    ignoredLanguages: profile.analysis.ignoredLanguages,
    projects,
    privateProjectCount: privateAggregate.projectCount,
    totalCodeLines,
    domains: profile.domains || [],
    tags: mergeEntries(
      aggregate(projects, "tags", (project) => project.countedLines),
      privateAggregate.tags,
    ),
    tools: mergeEntries(
      aggregate(projects, "tools", () => 0),
      privateAggregate.tools,
    ).sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name)),
    languages: mergeEntries(publicLanguages, privateLanguages),
  };
};

export { fetchProjectPortfolio };
