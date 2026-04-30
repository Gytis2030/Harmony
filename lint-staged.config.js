/** @type {import('lint-staged').Config} */
const config = {
  '*.{ts,tsx}': ['prettier --write', 'eslint --fix'],
  '*.{js,json,css,md}': ['prettier --write'],
}

export default config
