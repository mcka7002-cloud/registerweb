import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache: every page is dynamic or static at build time (no ISR), so nothing to store in R2.
export default defineCloudflareConfig({});
