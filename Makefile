ENV = NODE_ENV=test DEBUG=loopback:connector:*
BIN = ./node_modules/.bin
MOCHA = ./node_modules/.bin/_mocha
MOCHA_OPTS = -b --timeout 5000 --reporter spec --exit
TESTS = test/*.test.js
ISTANBUL = ./node_modules/.bin/istanbul
COVERALLS = ./node_modules/.bin/coveralls

lint: lint-js
lint-js:
	@echo "Linting JavaScript..."
	@$(BIN)/eslint . --fix
test: lint
	@echo "Testing..."
	@for file in `ls $(TESTS)` ; do $(ENV) $(MOCHA) $(MOCHA_OPTS) $$file ; done
test-cov: lint
	@echo "Testing..."
	@for file in `ls $(TESTS)` ; do \
		$(ENV) $(ISTANBUL) cover --report none --print none --dir ./coverage.`basename $$file` $(MOCHA) -- $(MOCHA_OPTS) $$file ; \
	done
	@istanbul report
test-coveralls: test-cov
	@cat ./coverage/lcov.info | $(COVERALLS) --verbose
.PHONY: lint test test-cov test-coveralls

start-dev:
	@NODE_ENV=development $(DEBUG) ./dockers/start.sh
.PHONY: start-dev
