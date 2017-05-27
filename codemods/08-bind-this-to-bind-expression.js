module.exports = {
    // paths: [ 'optional/', 'listOfFiles.js' ], // More specific path to apply
    // moduleApiChange: true, // Tell jscodemigrate to pull this into dependencies
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
            // Find stuff that looks like this.xyz.bind(this)
            .find(j.CallExpression, {
                callee: { object: { object: j.ThisExpression }, property: { name: 'bind' } }
            })
            // Ensure that .bind() is being called with only one argument, and that argument is "this".
            .filter(
                p => p.value.arguments.length == 1 && p.value.arguments[0].type == 'ThisExpression'
            )
            // We can now replace it with ::this.xyz
            .replaceWith(p => j.bindExpression(null, p.value.callee.object))
            .toSource();

        return {
            didTransform,
            root,
            printOptions
        };
    }
};
