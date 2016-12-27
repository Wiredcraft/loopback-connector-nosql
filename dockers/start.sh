#!/bin/bash
set -ev

# Require some environment variables. Examples:
# export NODE_ENV="development"

pushd `dirname $0`
DIR=`pwd`
popd

pushd ${DIR}/${NODE_ENV}

# Start the services.
docker-compose up -d --build

popd
