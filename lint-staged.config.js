/** @type {import('lint-staged').Config} */
module.exports = {
  '*.{ts,tsx}': ['prettier --write', 'eslint --fix'],
  '*.{js,json,css,md}': ['prettier --write'],
}
