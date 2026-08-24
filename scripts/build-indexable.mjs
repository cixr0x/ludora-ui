process.env.LUDORA_INDEXING_ENABLED = "true";
process.env.LUDORA_SITE_URL = "https://www.ludoradar.mx";

await import("./build.mjs");
