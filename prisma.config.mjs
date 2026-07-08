import { loadEnvConfig } from '@next/env'

const projectDir = process.cwd()
loadEnvConfig(projectDir)

const prismaConfig = {
    datasource: {
        url: process.env.DATABASE_URL,
    },
};

export default prismaConfig;
