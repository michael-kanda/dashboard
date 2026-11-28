import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Bewusst ungenutzte Parameter und Variablen mit _ kennzeichnen, z. B. das
      // request-Argument eines Route-Handlers, das früher (Next 14) die statische
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
      // Neu mit eslint-config-next 16 (React-Compiler-Regeln von eslint-plugin-react-hooks 7).
      // Alle aktiv bis auf set-state-in-effect: Die 26 Stellen im Bestand sind bewusste Muster
      // (Daten beim Öffnen laden, Browserwerte wie Theme oder Schriftgröße erst nach dem
      // Hydrieren lesen, Entwürfe bei geänderter Vorgabe zurücksetzen). Ein Umbau brächte
      // wenig und ließe sich in den Bereichen hinter dem Login nur schwer prüfen.
      "react-hooks/set-state-in-effect": "off",
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
