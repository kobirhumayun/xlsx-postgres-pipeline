# Database Schema

## Overview
The application now operates with a minimal Prisma schema needed only for connection management and potentially future auth/metadata.

The core functionality (Flexible Import) interacts directly with **existing PostgreSQL tables** in any schema.

## Core Models

### Prism setup
Standard `generator client` and `datasource db` configuration.

## Application Data
The application does not enforce a strict schema for its own metadata anymore.
- **Import**: Inserts into user-selected tables.
- **Query**: Reads from user-selected tables.

## Indexes
- Users should ensure their target tables have appropriate indexes for the queries they intend to run.
