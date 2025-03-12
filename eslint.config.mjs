import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  ...compat.extends("next/typescript"),
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-implicit-any": "off",
      "@typescript-eslint/ban-types": ["error", {
        "types": {
          "{}": false,
          "object": false,
          "any": false
        },
        "extendDefaults": true
      }],
      "@typescript-eslint/no-string-literal": "off",
      "@typescript-eslint/no-unsafe-member-access": "off"
    },
  },
  {
    // Rules for all file types
    rules: {
      "no-unused-vars": "off",
    },
  }
];

export default eslintConfig;
