import { defineConfig } from 'cypress'
import webpackPreprocessor from '@cypress/webpack-preprocessor'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 120000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    setupNodeEvents(on, config) {
      const options = {
        webpackOptions: {
          resolve: {
            extensions: ['.ts', '.js'],
          },
          module: {
            rules: [
              {
                test: /\.ts$/,
                exclude: [/node_modules/],
                use: [
                  {
                    loader: 'esbuild-loader',
                    options: {
                      target: 'es2020',
                    },
                  },
                ],
              },
            ],
          },
        },
        watchOptions: {},
      }

      on('file:preprocessor', webpackPreprocessor(options))

      return config
    },
  },
})
