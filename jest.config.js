export default {
  testEnvironment: 'node', // Use Node.js environment
  transform: {}, // Disable transformations
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1', // Map .js extensions for imports
  },
}
