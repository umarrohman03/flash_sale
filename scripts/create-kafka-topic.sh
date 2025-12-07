#!/bin/bash

# Script to create Kafka topic for flash sale attempts
# This should be run after Kafka is up and running

KAFKA_BROKER=${KAFKA_BROKER:-localhost:9092}
TOPIC_NAME=${KAFKA_TOPIC_FLASH_SALE_ATTEMPTS:-flashsale.attempts}

echo "Creating Kafka topic: $TOPIC_NAME"

docker exec flash-sale-kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic $TOPIC_NAME \
  --partitions 3 \
  --replication-factor 1 \
  --if-not-exists

echo "Topic $TOPIC_NAME created successfully"

