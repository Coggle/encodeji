"use strict";

var gulp    = require('gulp');
var eslint  = require('gulp-eslint');
var replace = require('gulp-replace');
var fs      = require('fs');
var _       = require('underscore');

var emojiData = function(){
    var data = JSON.parse(fs.readFileSync('./bower_components/emoji-data-minimal/emoji.json'));
    // strip out the data which isn't needed:

    data = _.map(data, function(d){
        d =  _.pick(
            d,
            'name', 'unified', 'short_name', 'short_names', 'category',
            'sort_order', 'skin_variations', 'text', 'texts'
        );
        // skin variations work in a standardised way, we don't need the
        // detailed data from upstream on which variations are included in
        // which emoji sets:
        if(d.hasOwnProperty('skin_variations')){
            d.skin_variations = true;
        }
        return d;
    });

    return JSON.stringify(data);
};

gulp.task('build-js', function(){
    return gulp.src([
        './lib/**/*.js'
    ]).pipe(replace(
        'EMOJI_DATA_JSON', emojiData
    )).pipe(gulp.dest('./dist'));
});

gulp.task('lint', function(){
    return gulp.src([
        './lib/**/*.js',
        './*.js'
    ]).pipe(eslint('eslint.json')).pipe(eslint.format()).on('error', function(error){
        console.error(error);
    });
});

gulp.task('default', ['lint', 'build-js'], function () {
    gulp.watch(["lib/**/*.js", 'emoji-data/'], ['build-js']);
    gulp.watch(["lib/**/*.js"], ['lint']);
});

