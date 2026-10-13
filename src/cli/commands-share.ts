/**
 * `link` — print a URL that opens the plan in the hosted playground, so an agent can hand a
 * person a rendered plan with nothing to install. The plan travels in the URL fragment; the
 * minting is `planLinks` (`link.ts`), shared with the MCP `link` tool.
 */

import { compile, diagnosticToJson } from "../index.js";
import { type Args, EXIT, emitJson, hasErrors, withSource } from "./io.js";
import { planLinks } from "./link.js";

/**
 * A plan that does not compile still gets its link (the playground shows the diagnostics, which
 * is useful to whoever opens it), but the caller hears about it once on stderr and the exit code
 * stays 0: the link was minted. Compiled with no `World`, as the playground does, so a plan that
 * leans on `import` warns here exactly when it would fail there.
 */
export function cmdLink(args: Args): number {
  return withSource(args, (source, input) => {
    const links = planLinks(source);
    const { diagnostics } = compile(source, { noCache: true });
    if (hasErrors(diagnostics) && !args.quiet) {
      const errors = diagnostics.filter((d) => d.severity === "error");
      const first = diagnosticToJson(source, errors[0]!);
      const name = input === "-" ? "stdin" : input;
      const where = first.line === undefined ? "" : ` at ${first.line}:${first.col}`;
      const count = `${errors.length} error${errors.length === 1 ? "" : "s"}`;
      process.stderr.write(
        `warning: ${name} does not compile (${count}, first ${first.code ?? "uncoded"}${where}); the link opens it with the diagnostics\n`,
      );
    }
    if (args.json) emitJson(links);
    else process.stdout.write(`${links.playground}\n`);
    return EXIT.OK;
  });
}
