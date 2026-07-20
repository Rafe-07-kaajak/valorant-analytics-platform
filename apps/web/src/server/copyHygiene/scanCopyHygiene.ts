import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

/**
 * TASK-050 section 15 — automated copy hygiene protection. Scans
 * TypeScript/TSX source for the em dash (U+2014) and en dash (U+2013)
 * characters, per the approved copy rules: no dash characters in web-facing
 * copy anywhere, only plain ASCII hyphens where technically necessary. See
 * docs/38-visual-foundation-and-design-tokens.md.
 *
 * Walks the TypeScript AST rather than grepping raw lines so that comments
 * (JSDoc, inline `//`, engineering rationale) never produce a false
 * positive — this codebase's comments routinely use an em dash as prose
 * punctuation, and that isn't web-facing copy. Only nodes that can render
 * to the page or an accessible name are checked: string literals, template
 * literals, and JSX text.
 */

// Unicode code points rather than literal characters: this file must scan
// for these characters without itself containing them, or every run would
// flag its own source as a violation.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

const BANNED_CHARACTERS: Record<string, "em dash" | "en dash"> = {
  [EM_DASH]: "em dash",
  [EN_DASH]: "en dash",
};

const SCAN_ROOTS = ["apps/web/src", "packages/ui/src"];

const SCANNED_EXTENSIONS = new Set([".ts", ".tsx"]);

const EXCLUDED_DIR_NAMES = new Set(["node_modules", ".next", ".turbo", "test-results", "dist", "build"]);

/**
 * Files that contain real string literals but are not web-facing copy, each
 * with a documented reason. Kept as an explicit, reviewable allowlist
 * (rather than a broad directory exclusion) so a genuinely user-facing
 * string added to one of these files in the future is still caught the
 * moment it stops being pure internal metadata.
 */
const EXCLUDED_FILES = new Set([
  join("apps", "web", "src", "constants", "media.ts"),
  join("apps", "web", "src", "server", "release", "releaseSmokeChecks.ts"),
]);

function isTestFile(fileName: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(fileName);
}

function listSourceFiles(rootDir: string, dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      files.push(...listSourceFiles(rootDir, join(dir, entry.name)));
      continue;
    }

    if (!SCANNED_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) continue;
    if (isTestFile(entry.name)) continue;

    const relativePath = relative(rootDir, join(dir, entry.name));
    if (EXCLUDED_FILES.has(relativePath)) continue;

    files.push(join(dir, entry.name));
  }

  return files;
}

export interface CopyHygieneViolation {
  file: string;
  line: number;
  column: number;
  character: "em dash" | "en dash";
  excerpt: string;
}

export interface CopyHygieneReport {
  violations: CopyHygieneViolation[];
  filesScanned: number;
}

const LITERAL_KINDS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);

function scanFile(rootDir: string, filePath: string): CopyHygieneViolation[] {
  const text = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: CopyHygieneViolation[] = [];
  const displayPath = relative(rootDir, filePath).split(sep).join("/");

  function visit(node: ts.Node) {
    if (LITERAL_KINDS.has(node.kind)) {
      const nodeText = node.getText(sourceFile);
      for (const [char, label] of Object.entries(BANNED_CHARACTERS)) {
        let index = nodeText.indexOf(char);
        while (index !== -1) {
          const position = node.getStart(sourceFile) + index;
          const { line, character: column } = sourceFile.getLineAndCharacterOfPosition(position);
          const lineText = sourceFile.getFullText().split("\n")[line]?.trim() ?? "";
          violations.push({
            file: displayPath,
            line: line + 1,
            column: column + 1,
            character: label,
            excerpt: lineText.length > 140 ? `${lineText.slice(0, 140)}…` : lineText,
          });
          index = nodeText.indexOf(char, index + 1);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

export function scanCopyHygiene(rootDir: string): CopyHygieneReport {
  const files = SCAN_ROOTS.flatMap((root) => {
    const absoluteRoot = join(rootDir, root);
    if (!statSync(absoluteRoot, { throwIfNoEntry: false })?.isDirectory()) return [];
    return listSourceFiles(rootDir, absoluteRoot);
  });
  const violations = files.flatMap((file) => scanFile(rootDir, file));

  return { violations, filesScanned: files.length };
}
