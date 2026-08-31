import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const patterns = [
  { label: "private key", pattern: /-----BEGIN [A-Z0-9 ]+ PRIVATE KEY-----/ },
  {
    label: "GitHub token",
    pattern: /\b(?:ghp_|gho_|github_pat_)[A-Za-z0-9_-]{12,}\b/,
  },
  {
    label: "provider token",
    pattern: /\b(?:sk-|xox[baprs]-)[A-Za-z0-9_-]{12,}\b/,
  },
  { label: "cloud access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{20,}\b/ },
  {
    label: "quoted credential assignment",
    pattern:
      /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["'][^"'\n]{12,}["']/i,
  },
  {
    label: "environment credential assignment",
    pattern:
      /\b(?:DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|WORKOS_API_KEY)\s*=\s*[^\s#]{12,}/i,
  },
  { label: "long bearer token", pattern: /\bBearer\s+[A-Za-z0-9._-]{24,}\b/ },
];

const trackedFiles = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard"],
  { cwd: repoRoot, encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

const findings = [];
for (const relativePath of trackedFiles) {
  const absolutePath = resolve(repoRoot, relativePath);
  let contents;
  try {
    contents = readFileSync(absolutePath);
  } catch {
    continue;
  }
  if (contents.includes(0)) continue;

  const text = contents.toString("utf8");
  for (const { label, pattern } of patterns) {
    const match = pattern.exec(text);
    if (match)
      findings.push(`${relativePath}: ${label} (${match[0].slice(0, 80)})`);
  }
}

if (findings.length > 0) {
  console.error("Secret scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  `Secret scan passed: ${trackedFiles.length} repository files checked.`,
);
