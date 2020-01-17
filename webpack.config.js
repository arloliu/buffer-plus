const path = require('path');
// const webpack = require('webpack');

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
                // exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
                exclude: path.resolve(__dirname, 'node_modules', 'prettier-eslint'),
            },
        ],
    },
    optimization: {

    },
    node: {
        Buffer: true,
    },
};
