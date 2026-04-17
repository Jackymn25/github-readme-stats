// @ts-check

import { afterEach, describe, expect, it, jest } from "@jest/globals";
import "@testing-library/jest-dom";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import topLangs from "../api/top-langs.js";
import { renderTopLanguages } from "../src/cards/top-languages.js";
import { renderError } from "../src/common/render.js";
import { CACHE_TTL, DURATIONS } from "../src/common/cache.js";

const data_langs = {
  data: {
    user: {
      repositories: {
        nodes: [
          {
            languages: {
              edges: [{ size: 150, node: { color: "#0f0", name: "HTML" } }],
            },
          },
          {
            languages: {
              edges: [{ size: 100, node: { color: "#0f0", name: "HTML" } }],
            },
          },
          {
            languages: {
              edges: [
                { size: 100, node: { color: "#0ff", name: "javascript" } },
              ],
            },
          },
          {
            languages: {
              edges: [
                { size: 100, node: { color: "#0ff", name: "javascript" } },
              ],
            },
          },
        ],
      },
    },
  },
};

const error = {
  errors: [
    {
      type: "NOT_FOUND",
      path: ["user"],
      locations: [],
      message: "Could not fetch user",
    },
  ],
};

const langs = {
  HTML: {
    color: "#0f0",
    name: "HTML",
    size: 250,
  },
  javascript: {
    color: "#0ff",
    name: "javascript",
    size: 200,
  },
};

const mock = new MockAdapter(axios);

afterEach(() => {
  mock.reset();
});

describe("Test /api/top-langs", () => {
  it("should test the request", async () => {
    const req = {
      query: {
        username: "anuraghazra",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(renderTopLanguages(langs));
  });

  it("should work with the query options", async () => {
    const req = {
      query: {
        username: "anuraghazra",
        hide_title: true,
        card_width: 100,
        title_color: "fff",
        icon_color: "fff",
        text_color: "fff",
        bg_color: "fff",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(
      renderTopLanguages(langs, {
        hide_title: true,
        card_width: 100,
        title_color: "fff",
        icon_color: "fff",
        text_color: "fff",
        bg_color: "fff",
      }),
    );
  });

  it("should render error card on user data fetch error", async () => {
    const req = {
      query: {
        username: "anuraghazra",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, error);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(
      renderError({
        message: error.errors[0].message,
        secondaryMessage:
          "Make sure the provided username is not an organization",
      }),
    );
  });

  it("should render error card on incorrect layout input", async () => {
    const req = {
      query: {
        username: "anuraghazra",
        layout: ["pie"],
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(
      renderError({
        message: "Something went wrong",
        secondaryMessage: "Incorrect layout input",
      }),
    );
  });

  it("should render error card if username in blacklist", async () => {
    const req = {
      query: {
        username: "renovate-bot",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(
      renderError({
        message: "This username is blacklisted",
        secondaryMessage: "Please deploy your own instance",
        renderOptions: { show_repo_link: false },
      }),
    );
  });

  it("should render error card if wrong locale provided", async () => {
    const req = {
      query: {
        username: "anuraghazra",
        locale: "asdf",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.send).toHaveBeenCalledWith(
      renderError({
        message: "Something went wrong",
        secondaryMessage: "Locale not found",
      }),
    );
  });

  it("should have proper cache", async () => {
    const req = {
      query: {
        username: "anuraghazra",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };
    mock.onPost("https://api.github.com/graphql").reply(200, data_langs);

    await topLangs(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/svg+xml");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      `max-age=${CACHE_TTL.TOP_LANGS_CARD.DEFAULT}, ` +
        `s-maxage=${CACHE_TTL.TOP_LANGS_CARD.DEFAULT}, ` +
        `stale-while-revalidate=${DURATIONS.ONE_DAY}`,
    );
  });

  it("should parse percentage=false and keep non-hidden languages", async () => {
    const req = {
      query: {
        username: "Jackymn25",
        layout: "compact",
        langs_count: "12",
        percentage: "false",
        hide: "jupyter notebook,cmake,makefile",
      },
    };
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    };

    mock.onPost("https://api.github.com/graphql").reply((config) => {
      const payload = JSON.parse(config.data);
      if (payload.query.includes("topLangBlobBatch")) {
        return [
          200,
          {
            data: {
              repository: {
                blob0: {
                  text: "print('hello')\nprint('world')",
                  isBinary: false,
                  isTruncated: false,
                  linguistLanguage: { name: "Python" },
                },
                blob1: {
                  text: '{\n "cells": []\n}',
                  isBinary: false,
                  isTruncated: false,
                  linguistLanguage: { name: "Jupyter Notebook" },
                },
                blob2: {
                  text: "cmake_minimum_required(VERSION 3.10)",
                  isBinary: false,
                  isTruncated: false,
                  linguistLanguage: { name: "CMake" },
                },
                blob3: {
                  text: "all:\n\techo ok",
                  isBinary: false,
                  isTruncated: false,
                  linguistLanguage: { name: "Makefile" },
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
                        oid: "commit123",
                        tree: { oid: "tree123" },
                      },
                    },
                    languages: {
                      edges: [
                        {
                          size: 10,
                          node: { color: "#3572A5", name: "Python" },
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
        "https://api.github.com/repos/demo/repo-a/git/trees/tree123?recursive=1",
      )
      .reply(200, {
        tree: [
          { type: "blob", path: "main.py" },
          { type: "blob", path: "notebook.ipynb" },
          { type: "blob", path: "CMakeLists.txt" },
          { type: "blob", path: "Makefile" },
        ],
      });

    await topLangs(req, res);

    expect(res.send).toHaveBeenCalledTimes(1);
    const svg = res.send.mock.calls[0][0];
    expect(svg).toContain("Python 0.00 k");
    expect(svg).not.toContain("No languages data.");
    expect(svg).not.toContain("Jupyter Notebook");
  });
});
