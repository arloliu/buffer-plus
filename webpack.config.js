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
    },
    module: {
        rules: [
            {
                test: /\.js$/i,
                // exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
        ],
    },
    optimization: {

    },
    node: {
        Buffer: true,
    },
};
