const path = require('path');
const webpack = require('webpack');

module.exports = {
    target: 'web',
    entry: {
        app: [path.resolve('src', 'index.js')],
    },
    // where to dump the output of a production build
    output: {
        path: path.resolve('lib'),
        filename: 'bufferplus.min.js',
        library: 'BufferPlus',
        libraryTarget: 'umd',
        umdNamedDefine: true,
    },
    module: {
        noParse: /prettier-eslint/,
        rules: [
            {
                test: /\.js$/i,
                use: {
                    loader: 'babel-loader',
                },
                exclude: path.resolve(__dirname, 'node_modules', 'prettier-eslint'),
            },
        ],
    },
    resolve: {
        fallback: {
            'buffer': require.resolve('buffer/'),
            'util': false,
            'path': false,
            'prettier-eslint': false,
        },
    },
    node: {
        global: false,
        __filename: false,
        __dirname: false,
    },
    plugins: [
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
        new webpack.EnvironmentPlugin({
            NODE_ENV: 'production', // use 'development' unless process.env.NODE_ENV is defined
            NODE_DEBUG: false,
        }),
    ],
};
