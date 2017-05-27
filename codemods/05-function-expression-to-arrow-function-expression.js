/**
 * Converts a FunctionExpression to an ArrowFunctionExpression when safe to do so.
 *
 * var a = function(a, b) {
 * 	return a + b;
 * }
 *
 * var b = function(a, b) {
 *  	var c = 0;
 *   	return a + b + c;
 * }
 *
 * var a = function(a, b) {
 *  	return a + b + this.c;
 * }
 **
 * var a = (a, b) => a + b
 *
 * var b = (a, b) => {
 *  	var c = 0;
 *   	return a + b + c;
 * }
 *
 * var a = function(a, b) {
 *  	return a + b + this.c;
 * }
 */
module.exports = {
    // paths: ['optional/', 'listOfFiles.js' ],
    moduleApiChange: true, // Tell jscodemigrate to pull this into dependencies
    transform: ({ file, root, api, options }) => {
        const j = api.jscodeshift;

        const printOptions = options.printOptions || {
            quote: 'single',
            trailingComma: true,
            flowObjectCommas: true,
            arrowParensAlways: true,
            arrayBracketSpacing: false,
            objectCurlySpacing: false
        };

        // retain top comments
        const { comments: topComments } = root.find(j.Program).get('body', 0).node;

        const didTransform = j(file.source)
            .find(j.FunctionExpression)
            // We check for this expression, as if it's in a function expression, we don't want to re-bind "this" by
            // using the arrowFunctionExpression. As that could potentially have some unintended consequences.
            .filter(p => j(p).find(j.ThisExpression).size() == 0)
            .replaceWith(p => {
                var body = p.value.body;
                // We can get a bit clever here. If we have a function that consists of a single return statement in it's body,
                // we can transform it to the more compact arrowFunctionExpression (a, b) => a + b, vs (a + b) => { return a + b }
                var useExpression =
                    body.type == 'BlockStatement' &&
                    body.body.length == 1 &&
                    body.body[0].type == 'ReturnStatement';
                body = useExpression ? body.body[0].argument : body;
                return j.arrowFunctionExpression(p.value.params, body, useExpression);
            })
            .toSource();

        return {
            didTransform,
            root,
            printOptions
        };
    }
};
