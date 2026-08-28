// Learn more: https://docs.expo.dev/guides/customizing-metro
//
// Just having this file present (using expo/metro-config's getDefaultConfig)
// is what makes Metro pick up the "@/*" path aliases defined in
// tsconfig.json's compilerOptions.paths — those aliases are used throughout
// src/ (e.g. `import { X } from '@/lib/x'`) and will fail to resolve without
// this file.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
