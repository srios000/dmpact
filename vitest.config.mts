import { configDefaults, defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // Agent worktrees (other branches) live under .claude/ — never collect them.
    exclude: [...configDefaults.exclude, ".claude/**"],
    passWithNoTests: true,
    fileParallelism: false,
  },
});
