// @ts-check

import { describe, expect, it, jest } from "@jest/globals";
import api from "../api/project-portfolio.js";
import { renderProjectPortfolio } from "../src/cards/project-portfolio.js";
import { fetchProjectPortfolio } from "../src/fetchers/project-portfolio.js";

describe("project portfolio", () => {
  it("excludes forks and ignored language categories while merging anonymous private aggregates", () => {
    const data = fetchProjectPortfolio("Jackymn25");
    expect(data.projects.some((project) => project.fork)).toBe(false);
    expect(data.languages.some((language) => language.name === "Markdown")).toBe(false);
    expect(data.languages[0]).toMatchObject({ name: "Java", lines: 23204 });
    expect(data.tags[0]).toMatchObject({ name: "software", lines: 33854 });
    expect(data.privateProjectCount).toBe(9);
    expect(data.totalCodeLines).toBe(50733);
  });

  it("renders each configuration-driven view", () => {
    const data = fetchProjectPortfolio("Jackymn25");
    expect(renderProjectPortfolio(data, { view: "projects" })).toContain("LexiGOv1.0");
    expect(renderProjectPortfolio(data, { view: "tags" })).toContain("software");
    expect(renderProjectPortfolio(data, { view: "languages" })).toContain("Java");
    expect(renderProjectPortfolio(data, { view: "tools" })).toContain("Python");
    const domains = renderProjectPortfolio(data, { view: "domains" });
    expect(domains).toContain("Java 85%");
    expect(domains).toContain("21.8k lines - 43%");
  });

  it("rejects an unknown card view", async () => {
    const req = { query: { username: "Jackymn25", view: "private" } };
    const res = { setHeader: jest.fn(), send: jest.fn() };
    await api(req, res);
    expect(res.send.mock.calls[0][0]).toContain("Incorrect view input");
  });
});
