// postcss-import ships no types of its own.
declare module "postcss-import" {
  import type { PluginCreator } from "postcss";

  const atImport: PluginCreator<Record<string, unknown>>;
  export default atImport;
}
