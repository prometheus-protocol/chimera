const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const network =
  process.env.DFX_NETWORK ||
  (process.env.NODE_ENV === 'production' ? 'ic' : 'local');
function initCanisterEnv() {
  let localCanisters, prodCanisters;
  try {
    localCanisters = require(
      path.resolve('.dfx', 'local', 'canister_ids.json'),
    );
  } catch (error) {
    console.log('No local canister_ids.json found. Continuing production');
  }
  try {
    prodCanisters = require(path.resolve('canister_ids.json'));
  } catch (error) {
    console.log('No production canister_ids.json found. Continuing with local');
  }

  const canisterConfig = network === 'local' ? localCanisters : prodCanisters;

  return Object.entries(canisterConfig).reduce((prev, current) => {
    const [canisterName, canisterDetails] = current;
    prev['CANISTER_ID_' + canisterName.toUpperCase()] =
      canisterDetails[network];
    return prev;
  }, {});
}
const canisterEnvVariables = initCanisterEnv();

const isDevelopment = process.env.NODE_ENV !== 'production';

const internetIdentityUrl =
  network === 'local'
    ? `http://${canisterEnvVariables['CANISTER_ID_INTERNET_IDENTITY']}.localhost:4943/`
    : `https://identity.ic0.app`;

const frontendDirectory = 'oauth_frontend';

module.exports = {
  target: 'web',
  mode: isDevelopment ? 'development' : 'production',
  entry: {
    // The frontend.entrypoint points to the HTML file for this build, so we need
    // to replace the extension to `.js`.
    index: path.join(__dirname, 'src', frontendDirectory, 'src', 'main.tsx'),
  },
  devtool: isDevelopment ? 'source-map' : false,
  optimization: {
    minimize: !isDevelopment,
    minimizer: [new TerserPlugin()],
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx'],
    fallback: {
      assert: require.resolve('assert/'),
      buffer: require.resolve('buffer/'),
      events: require.resolve('events/'),
      stream: require.resolve('stream-browserify/'),
      util: require.resolve('util/'),
    },
    alias: {
      '@': path.resolve(__dirname, 'src', frontendDirectory, 'src'),
    },
  },
  output: {
    filename: 'index.js',
    path: path.join(__dirname, 'dist', frontendDirectory),
    publicPath: '/',
  },

  // Depending in the language or framework you are using for
  // front-end development, add module loaders to the default
  // webpack configuration. For example, if you are using React
  // modules and CSS as described in the "Adding a stylesheet"
  // tutorial, uncomment the following lines:
  module: {
    rules: [
      {
        test: /\.(ts|tsx|jsx)$/,
        loader: 'ts-loader',
        exclude: /node_modules/, // Good practice to add this
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          'postcss-loader', // This MUST be the last in the array (first to run)
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(
        __dirname,
        'src',
        frontendDirectory,
        'src',
        'index.html',
      ),
      cache: false,
    }),
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'development',
      II_URL: internetIdentityUrl,
      ...canisterEnvVariables,
    }),
    new webpack.ProvidePlugin({
      Buffer: [require.resolve('buffer/'), 'Buffer'],
      process: require.resolve('process/browser'),
    }),
    new CopyPlugin({
      patterns: [
        {
          from: `src/${frontendDirectory}/src/.ic-assets.json*`,
          to: '.ic-assets.json5',
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
  // proxy /api to port 4943 during development.
  // if you edit dfx.json to define a project-specific local network, change the port to match.
  devServer: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4943',
        changeOrigin: true,
        pathRewrite: {
          '^/api': '/api',
        },
      },
    },
    static: path.resolve(__dirname, 'src', frontendDirectory, 'assets'),
    hot: true,
    watchFiles: [path.resolve(__dirname, 'src', frontendDirectory)],
    liveReload: true,
    historyApiFallback: true, // For React Router support
  },
};
