import solidPlugin from "@opentui/solid/bun-plugin"

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  target: "bun",
  outdir: "./dist",
  plugins: [solidPlugin],
  external: [
    "@modelcontextprotocol/sdk",
    "tiktoken",
    "ripgrep-node",
  ],
})

if (!result.success) {
  console.error("Build failed:")
  for (const message of result.logs) {
    console.error(message)
  }
  process.exit(1)
}

console.log("Build successful!")
console.log("Output files:", result.outputs.map(o => o.path))
