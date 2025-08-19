const nextJest = require('next/jest');

const createJestConfig = nextJest({
	dir: './',
});

const customJestConfig = {
	testEnvironment: 'jsdom',
	setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
	},
	testMatch: ['<rootDir>/tests/**/*.(test|spec).(ts|tsx|js)'],
};

module.exports = createJestConfig(customJestConfig);


