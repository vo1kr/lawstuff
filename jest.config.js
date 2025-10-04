module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@commands/(.*)$': '<rootDir>/src/commands/$1',
    '^@events/(.*)$': '<rootDir>/src/events/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@db/(.*)$': '<rootDir>/src/db/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config$': '<rootDir>/src/config'
  }
};
