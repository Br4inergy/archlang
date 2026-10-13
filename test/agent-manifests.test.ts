/**
 * The agent-directory manifests (`npm run gen:agent-manifests`) are one skill source published in
 * each host's shape. `check:drift` proves they are reproducible; this proves they are well formed:
 * the portable manifest validates against the vendored Agent Plugins schema (never fetched at test
 * time), the Cursor manifest meets its one documented requirement, every skill a host will look
 * for exists and is byte-identical to its source, and no generated file carries a version number,
 * a secret or a retired positioning claim.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CURSOR_RULE,
  PLUGIN_ROOT,
  allOutputs,
  CURSOR_MANIFEST,
  PORTABLE_MANIFEST,
  PORTABLE_SCHEMA_ID,
  textOutputs,
} from "../scripts/gen-agent-manifests.js";

const read = (p: string) => readFileSync(resolve(p), "utf8");
const readJson = (p: string) => JSON.parse(read(p));

type Schema = {
  type?: string;
  const?: unknown;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  items?: Schema;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
};

/** The subset of JSON Schema the vendored Agent Plugins schema uses; throws on any other keyword. */
const KNOWN = new Set([
  "$schema",
  "$id",
  "title",
  "description",
  "type",
  "const",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "pattern",
  "minLength",
  "maxLength",
]);

function validate(value: unknown, schema: Schema, at: string, errors: string[]): void {
  for (const k of Object.keys(schema))
    if (!KNOWN.has(k)) throw new Error(`validator does not support \`${k}\` (${at})`);
  if ("const" in schema && value !== schema.const) errors.push(`${at}: must equal ${JSON.stringify(schema.const)}`);
  if (schema.type === "string") {
    if (typeof value !== "string") return void errors.push(`${at}: must be a string`);
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${at}: too long`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: does not match pattern`);
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return void errors.push(`${at}: must be an array`);
    const item = schema.items;
    if (item) for (const [i, v] of value.entries()) validate(v, item, `${at}[${i}]`, errors);
  } else if (schema.type === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value))
      return void errors.push(`${at}: must be an object`);
    const obj = value as Record<string, unknown>;
    for (const r of schema.required ?? []) if (!(r in obj)) errors.push(`${at}: missing required \`${r}\``);
    for (const [k, v] of Object.entries(obj)) {
      const sub = schema.properties?.[k];
      if (sub) validate(v, sub, `${at}.${k}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${at}: unexpected property \`${k}\``);
      else if (typeof schema.additionalProperties === "object")
        validate(v, schema.additionalProperties, `${at}.${k}`, errors);
    }
  }
}

/** The retired claims and hype words (same list as test/docs-page-meta.test.ts). */
const KILLED: readonly RegExp[] = [
  /\bLaTeX\b/i,
  /\bTypst\b/i,
  /(?<![-\w])first\b/i,
  /(?<![-\w])only\b/i,
  /Design Compiler/i,
  /Code as CAD/i,
  /checked design/i,
  /every clearance measured/i,
  /game.?chang/i,
  /revolutionar/i,
  /seamless/i,
  /effortless/i,
  /cutting.edge/i,
  /world.class/i,
  /blazing/i,
  /state.of.the.art/i,
  /\b10x\b/i,
  /\bmagic/i,
  /remotion/i,
];
/** Anything shaped like a credential. */
const SECRETS: readonly RegExp[] = [
  /\bnpm_[A-Za-z0-9]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bsk-[A-Za-z0-9]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY/,
  /\b(api[_-]?key|token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9]{12,}/i,
];
/** A semver, or a `name@x.y.z` pin. */
const VERSION = /\d+\.\d+\.\d+/;

describe("agent-directory manifests", () => {
  it("the portable manifest validates against the vendored Agent Plugins schema", () => {
    const schema = readJson("test/fixtures/schemas/agent-plugin.schema.json") as Schema & { $id: string };
    expect(schema.$id).toBe(PORTABLE_SCHEMA_ID);
    const errors: string[] = [];
    validate(readJson(PORTABLE_MANIFEST), schema, "plugin.json", errors);
    expect(errors).toEqual([]);
    expect(readJson(PORTABLE_MANIFEST).name).toBe("archlang");
  });

  it("the validator rejects what the schema forbids (so a pass means something)", () => {
    const schema = readJson("test/fixtures/schemas/agent-plugin.schema.json") as Schema;
    const errors: string[] = [];
    validate({ $schema: PORTABLE_SCHEMA_ID, name: "Bad Name", extra: 1 }, schema, "x", errors);
    expect(errors.join("\n")).toMatch(/pattern/);
    expect(errors.join("\n")).toMatch(/unexpected property `extra`/);
    const missing: string[] = [];
    validate({}, schema, "x", missing);
    expect(missing.join("\n")).toMatch(/missing required `name`/);
  });

  it("the Cursor manifest has the one field Cursor requires, and the name agrees across hosts", () => {
    const cursor = readJson(CURSOR_MANIFEST);
    // Cursor requires `name`, lowercase alphanumerics, hyphens and periods (kebab-case)
    expect(cursor.name).toMatch(/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/);
    expect(typeof cursor.description).toBe("string");
    // rules/*.mdc are discovered from the plugin root: the generated rule is where Cursor looks
    expect(CURSOR_RULE).toMatch(/\/rules\/[^/]+\.mdc$/);
    expect(cursor.name).toBe(readJson(PORTABLE_MANIFEST).name);
    // skills are found in the default root `skills/` directory; a `skills` key would only add to it
    expect(cursor).not.toHaveProperty("skills");
    expect(readJson(PORTABLE_MANIFEST)).not.toHaveProperty("skills");
  });

  it("the plugin root the manifests sit in holds every skill, byte-identical to skills/<name>/SKILL.md", () => {
    const sources = readdirSync(resolve("skills"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(resolve("skills", e.name, "SKILL.md")))
      .map((e) => e.name)
      .sort();
    expect(sources).toContain("archlang");
    expect(readdirSync(resolve(PLUGIN_ROOT, "skills")).sort()).toEqual(sources);
    for (const d of sources) {
      expect(read(`${PLUGIN_ROOT}/skills/${d}/SKILL.md`), d).toBe(read(`skills/${d}/SKILL.md`));
      // the manifests rely on the plugin root's skills/ directory: each skill names itself
      expect(read(`skills/${d}/SKILL.md`)).toMatch(new RegExp(`^name:\\s*${d}\\s*$`, "m"));
    }
  });

  it("every generated file exists and is the generator's output", () => {
    for (const f of allOutputs()) expect(existsSync(resolve(f)), f).toBe(true);
    for (const { dest, text } of textOutputs()) expect(read(dest), dest).toBe(text);
  });

  it("the Cursor rule and Copilot instructions carry their host's frontmatter and a generated header", () => {
    const rule = read(CURSOR_RULE);
    expect(rule).toMatch(/^---\ndescription: .+\nglobs: "\*\*\/\*\.arch"\nalwaysApply: false\n---\n<!-- GENERATED /);
    const path = read("integrations/copilot/archlang.instructions.md");
    expect(path).toMatch(/^---\napplyTo: "\*\*\/\*\.arch"\n---\n<!-- GENERATED /);
    expect(read("integrations/copilot/copilot-instructions.md")).toMatch(/^<!-- GENERATED /);
  });

  it("no generated file names a version, a secret or a retired claim", () => {
    for (const f of allOutputs()) {
      const text = read(f);
      // the Agent Plugins schema URL carries the schema revision, which is not a release version
      expect(text.replaceAll(PORTABLE_SCHEMA_ID, ""), `${f} has a version`).not.toMatch(VERSION);
      for (const re of SECRETS) expect(text, `${f} ~ ${re}`).not.toMatch(re);
      for (const re of KILLED) expect(text, `${f} ~ ${re}`).not.toMatch(re);
    }
  });
});
