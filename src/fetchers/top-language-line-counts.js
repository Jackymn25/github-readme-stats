// @ts-check

import axios from "axios";
import { retryer } from "../common/retryer.js";
import { request } from "../common/http.js";

const LINE_COUNT_CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const BLOB_BATCH_SIZE = 20;

/**
 * @typedef {{ expiresAt: number, languageLines: Record<string, number> }} RepoLineCountCacheEntry
 */

/** @type {Map<string, RepoLineCountCacheEntry>} */
const repoLineCountsCache = new Map();

/**
 * Fetch repository tree for provided ref.
 *
 * @param {{ owner: string, repo: string, ref: string }} variables Variables.
 * @param {string} token GitHub token.
 * @returns {Promise<import("axios").AxiosResponse>} Repository tree response.
 */
const fetchRepoTree = (variables, token) => {
  return axios({
    url: `https://api.github.com/repos/${variables.owner}/${variables.repo}/git/trees/${variables.ref}?recursive=1`,
    method: "get",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
};

/**
 * Fetch batch of blobs with linguist language information.
 *
 * @param {{ owner: string, repo: string, expressions: string[] }} variables Variables.
 * @param {string} token GitHub token.
 * @returns {Promise<import("axios").AxiosResponse>} Blob batch response.
 */
const fetchBlobBatch = (variables, token) => {
  const expressionVars = variables.expressions
    .map((_, index) => `$expr${index}: String!`)
    .join(", ");
  const blobSelections = variables.expressions
    .map(
      (_, index) => `
      blob${index}: object(expression: $expr${index}) {
        ... on Blob {
          text
          isBinary
          isTruncated
          linguistLanguage {
            name
          }
        }
      }
    `,
    )
    .join("\n");

  /** @type {Record<string, string>} */
  const queryVariables = {
    owner: variables.owner,
    repo: variables.repo,
  };
  variables.expressions.forEach((expression, index) => {
    queryVariables[`expr${index}`] = expression;
  });

  return request(
    {
      query: `
      query topLangBlobBatch($owner: String!, $repo: String!, ${expressionVars}) {
        repository(owner: $owner, name: $repo) {
          ${blobSelections}
        }
      }
      `,
      variables: queryVariables,
    },
    {
      Authorization: `token ${token}`,
    },
  );
};

/**
 * Count lines in a text blob.
 *
 * @param {string} text Blob text.
 * @returns {number} Number of lines.
 */
const countLines = (text) => {
  if (!text) {
    return 0;
  }
  return text.split(/\r\n|\r|\n/).length;
};

/**
 * Count language lines for a repository HEAD ref.
 *
 * @param {{ nameWithOwner: string, defaultBranchOid?: string | null, defaultBranchTreeOid?: string | null }} repoNode Repository node.
 * @returns {Promise<Record<string, number>>} Language line counts.
 */
const countRepositoryLanguageLines = async (repoNode) => {
  if (!repoNode.defaultBranchOid) {
    return {};
  }

  const cacheKey = `${repoNode.nameWithOwner}@${repoNode.defaultBranchOid}`;
  const cached = repoLineCountsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.languageLines;
  }

  const [owner, repo] = repoNode.nameWithOwner.split("/");

  const treeRes = await retryer(fetchRepoTree, {
    owner,
    repo,
    ref: repoNode.defaultBranchTreeOid || repoNode.defaultBranchOid,
  });

  const tree = treeRes?.data?.tree || [];

  const blobExpressions = tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => `${repoNode.defaultBranchOid}:${entry.path}`);

  /** @type {Record<string, number>} */
  const languageLines = {};

  for (let i = 0; i < blobExpressions.length; i += BLOB_BATCH_SIZE) {
    const batch = blobExpressions.slice(i, i + BLOB_BATCH_SIZE);
    const batchRes = await retryer(fetchBlobBatch, {
      owner,
      repo,
      expressions: batch,
    });

    const repository = batchRes?.data?.data?.repository || {};
    Object.keys(repository).forEach((key) => {
      const blob = repository[key];
      if (
        !blob ||
        blob.isBinary ||
        blob.isTruncated ||
        !blob.linguistLanguage
      ) {
        return;
      }

      const languageName = blob.linguistLanguage.name;
      const lines = countLines(blob.text || "");

      languageLines[languageName] = (languageLines[languageName] || 0) + lines;
    });
  }

  repoLineCountsCache.set(cacheKey, {
    languageLines,
    expiresAt: Date.now() + LINE_COUNT_CACHE_TTL_MS,
  });

  return languageLines;
};

export { countRepositoryLanguageLines };
