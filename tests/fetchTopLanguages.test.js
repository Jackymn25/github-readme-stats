// @ts-check

import { afterEach, describe, expect, it } from "@jest/globals";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { fetchTopLanguages } from "../src/fetchers/top-languages.js";

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

describe("fetchTopLanguages", () => {
  it("should override top language colors", async () => {
    mock.onPost("https://api.github.com/graphql").reply(200, {
      data: {
        user: {
          repositories: {
            nodes: [
              {
                name: "repo-a",
                nameWithOwner: "demo/repo-a",
                languages: {
                  edges: [
                    { size: 10, node: { color: "#b07219", name: "Java" } },
                    {
                      size: 10,
                      node: { color: "#3178c6", name: "TypeScript" },
                    },
                    { size: 10, node: { color: "#555555", name: "C" } },
                  ],
                },
              },
            ],
          },
        },
      },
    });

    const langs = await fetchTopLanguages("demo");
    expect(langs.Java.color).toBe("#FFA726");
    expect(langs.TypeScript.color).toBe("#FFFFFF");
    expect(langs.C.color).toBe("#FF00FF");
  });

  it("should compute line-count based sizes when enabled", async () => {
    mock.onPost("https://api.github.com/graphql").reply((config) => {
      const payload = JSON.parse(config.data);
      if (payload.query.includes("topLangBlobBatch")) {
        return [
          200,
          {
            data: {
              repository: {
                blob0: {
                  text: "line1\nline2\nline3",
                  isBinary: false,
                  isTruncated: false,
                  linguistLanguage: { name: "Python" },
                },
                blob1: {
                  text: "const a = 1;\nconst b = 2;",
                  isBinary: false,
                  isTruncated: false,
                  linguistLanguage: { name: "TypeScript" },
                },
              },
            },
          },
        ];
      }

      return [
        200,
        {
          data: {
            user: {
              repositories: {
                nodes: [
                  {
                    name: "repo-a",
                    nameWithOwner: "demo/repo-a",
                    defaultBranchRef: {
                      target: {
                        oid: "abc123",
                      },
                    },
                    languages: {
                      edges: [
                        {
                          size: 2000,
                          node: { color: "#3572A5", name: "Python" },
                        },
                        {
                          size: 1000,
                          node: { color: "#3178c6", name: "TypeScript" },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      ];
    });

    mock
      .onGet(
        "https://api.github.com/repos/demo/repo-a/git/trees/abc123?recursive=1",
      )
      .reply(200, {
        tree: [
          { type: "blob", path: "main.py" },
          { type: "blob", path: "index.ts" },
        ],
      });

    const langs = await fetchTopLanguages("demo", [], 1, 0, true);

    expect(langs.Python.size).toBe(3);
    expect(langs.TypeScript.size).toBe(2);
    expect(langs.TypeScript.color).toBe("#FFFFFF");
  });
});
