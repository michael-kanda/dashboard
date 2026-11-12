import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Bewusst ungenutzte Parameter und Variablen mit _ kennzeichnen, z. B. das
      // request-Argument eines Route-Handlers, das in Next 14 die statische
      // Optimierung verhindert und deshalb stehen bleiben soll.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // Altbestand: ca. 180 Vorkommen. Als Warnung gefuehrt, damit `npm run lint`
      // gruen ist; --max-warnings in package.json verhindert neue Vorkommen.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Anwendungscode: Ablauf- und Info-Ausgaben laufen ueber src/lib/logger.ts
    // (mit Log-Level). console.warn/console.error bleiben erlaubt. CLI-Skripte
    // unter scripts/ schreiben weiter direkt auf die Konsole.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
