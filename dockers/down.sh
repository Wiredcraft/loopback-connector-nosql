#!/bin/bash
set -ev

NODE_ENV=${NODE_ENV:-development}
pushd `dirname $0`
DIR=`pwd`
popd

pushd ${DIR}/${NODE_ENV}
docker-compose down
popd
