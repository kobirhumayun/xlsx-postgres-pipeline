import { loadEnvConfig } from '@next/env'

const projectDir = process.cwd()
loadEnvConfig(projectDir)

export default {
    datasource: {
        url: process.env.DATABASE_URL,
    },
};
