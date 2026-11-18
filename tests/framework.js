/**
 * Lightweight Zero-Dependency Test Framework for AgriSpectra QA
 * Provides BDD-style describe/it, assertions, and formatted terminal reports.
 */

class TestRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.startTime = 0;
  }

  describe(name, fn) {
    const suite = {
      name,
      tests: [],
      passed: 0,
      failed: 0,
      duration: 0
    };
    this.suites.push(suite);
    this.currentSuite = suite;
    fn();
    this.currentSuite = null;
  }

  it(name, testFn) {
    if (!this.currentSuite) {
      throw new Error(`Test '${name}' must be inside a describe block`);
    }
    this.currentSuite.tests.push({ name, testFn, error: null, duration: 0 });
  }

  async run() {
    this.startTime = performance.now();
    console.log('\n\x1b[1m\x1b[36m======================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[36m   AGRISPECTRA FLOW & FIELD - AUTOMATED QA & CHAOS TEST SUITE       \x1b[0m');
    console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

    for (const suite of this.suites) {
      const suiteStart = performance.now();
      console.log(`\x1b[1m\x1b[34m[SUITE] ${suite.name}\x1b[0m`);

      for (const test of suite.tests) {
        this.totalTests++;
        const testStart = performance.now();
        try {
          await test.testFn();
          test.duration = Number((performance.now() - testStart).toFixed(2));
          suite.passed++;
          this.passedTests++;
          console.log(`  \x1b[32m✔\x1b[0m ${test.name} \x1b[90m(${test.duration}ms)\x1b[0m`);
        } catch (err) {
          test.duration = Number((performance.now() - testStart).toFixed(2));
          test.error = err;
          suite.failed++;
          this.failedTests++;
          console.log(`  \x1b[31m✖\x1b[0m ${test.name} \x1b[90m(${test.duration}ms)\x1b[0m`);
          console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
          if (err.stack) {
            const firstFewLines = err.stack.split('\n').slice(1, 4).join('\n');
            console.log(`    \x1b[90m${firstFewLines}\x1b[0m`);
          }
        }
      }
      suite.duration = Number((performance.now() - suiteStart).toFixed(2));
      console.log('');
    }

    const totalDuration = Number((performance.now() - this.startTime).toFixed(2));
    this.printSummary(totalDuration);

    return this.failedTests === 0;
  }

  printSummary(totalDuration) {
    const passRate = this.totalTests > 0 
      ? ((this.passedTests / this.totalTests) * 100).toFixed(1) 
      : '0.0';

    console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
    console.log('\x1b[1m                      QA EXECUTION SUMMARY                            \x1b[0m');
    console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
    console.log(`  Total Suites:    ${this.suites.length}`);
    console.log(`  Total Tests:     ${this.totalTests}`);
    console.log(`  \x1b[32mPassed Tests:    ${this.passedTests}\x1b[0m`);
    if (this.failedTests > 0) {
      console.log(`  \x1b[31mFailed Tests:    ${this.failedTests}\x1b[0m`);
    } else {
      console.log(`  Failed Tests:    0`);
    }
    console.log(`  Pass Rate:       \x1b[1m${this.failedTests === 0 ? '\x1b[32m' : '\x1b[31m'}${passRate}%\x1b[0m`);
    console.log(`  Execution Time:  ${totalDuration}ms`);
    console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');
  }
}

export const runner = new TestRunner();
export const describe = runner.describe.bind(runner);
export const it = runner.it.bind(runner);

export function expect(actual) {
  return {
    toBeDefined() {
      if (actual === undefined) {
        throw new Error(`Expected defined value, got undefined`);
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new Error(`Expected undefined, got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
      }
    },
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
      }
    },
    toEqual(expected) {
      const act = JSON.stringify(actual);
      const exp = JSON.stringify(expected);
      if (act !== exp) {
        throw new Error(`Expected deep equality:\nActual:   ${act}\nExpected: ${exp}`);
      }
    },
    toBeCloseTo(expected, delta = 0.01) {
      if (Math.abs(actual - expected) > delta) {
        throw new Error(`Expected ${actual} to be within ${delta} of ${expected}`);
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(actual >= expected)) {
        throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toBeLessThanOrEqual(expected) {
      if (!(actual <= expected)) {
        throw new Error(`Expected ${actual} to be less than or equal to ${expected}`);
      }
    },
    toBeBetween(min, max) {
      if (actual < min || actual > max) {
        throw new Error(`Expected ${actual} to be between ${min} and ${max}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${actual}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${actual}`);
      }
    },
    toContain(item) {
      if (Array.isArray(actual) || typeof actual === 'string') {
        if (!actual.includes(item)) {
          throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`);
        }
      } else {
        throw new Error(`toContain requires array or string, got ${typeof actual}`);
      }
    },
    toThrow(expectedErrorSubstring) {
      if (typeof actual !== 'function') {
        throw new Error('toThrow requires a function');
      }
      let threw = false;
      let caughtError = null;
      try {
        actual();
      } catch (e) {
        threw = true;
        caughtError = e;
      }
      if (!threw) {
        throw new Error('Expected function to throw, but it did not throw');
      }
      if (expectedErrorSubstring && !caughtError.message.includes(expectedErrorSubstring)) {
        throw new Error(`Expected error to contain "${expectedErrorSubstring}", got "${caughtError.message}"`);
      }
    }
  };
}
