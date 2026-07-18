import nextVitals from "eslint-config-next/core-web-vitals";
import { baseConfig } from "@codemri/config/eslint/base";

const config = [...baseConfig, ...nextVitals];

export default config;
