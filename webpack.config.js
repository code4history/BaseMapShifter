const webpack = require('webpack');
const pjson = require('./package.json');

module.exports = {
    mode: 'production',
    devtool: 'source-map',
    entry: {
        'basemapshifter': './index.js'
    },
    output: {
        path: `${__dirname}/dist`,
        filename: '[name].js'
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules(?!\/(@maplat|swiper|dom7)\/)/,
                use: {
                    loader: 'babel-loader',
                    query: {
                        "presets": [
                            [
                                "@babel/preset-env",
                                {
                                    "useBuiltIns": "usage",
                                    "corejs": 3
                                }
                            ]
                        ]
                    }
                }
            }
        ]
    },
    plugins: [
        new webpack.BannerPlugin({
            banner: `${pjson.name} v${pjson.version} | ${pjson.author} | license: ${pjson.license}`
        })
    ]
};