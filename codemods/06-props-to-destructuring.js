/**
 * Transforms:
 * class C extends React.Component() {
 *  render() {
 *   return <div foo={this.props.foo} bar={this.props.bar} />
 *  }
 * }
 *** To:
 *
 * class C extends React.Component() {
 *  render() {
 *   const {
 *    foo,
 *    bar
 *   } = this.props;
 *
 *   return <div foo={foo} bar={bar} />
 *  }
 * }
 *
 */

let keywords =
    'this function if return var else for new in typeof while case break try catch delete throw switch continue default instanceof do void finally with debugger implements interface package private protected public static class enum export extends import super true false null abstract boolean byte char const double final float goto int long native short synchronized throws transient volatile';
keywords = keywords.split(' ').reduce((f, k) => {
    f[k] = true;
    return f;
}, {});
const isKeyword = k => keywords.hasOwnProperty(k);

module.exports = {
    // paths: [ 'optional/', 'listOfFiles.js' ], // More specific path to apply
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

        const { statement } = j.template;

        const didTransform = j(file.source)
            .find(j.FunctionExpression)
            .replaceWith(p => {
                console.log(p);
                const root = j(p.value);
                const variablesToReplace = {};

                // Figure out if the variable was defined from props, so that we can re-use that definition.
                const isFromProps = (name, resolvedScope) => {
                    return resolvedScope.getBindings()[name].every(p => {
                        const decl = j(p).closest(j.VariableDeclarator);
                        // What happens when our VariableDeclarator is too high up the parent AST?

                        if (!decl.size()) return false;
                        const node = decl.nodes()[0];

                        if (
                            !(node.init.type == 'MemberExpression' &&
                                node.init.object.type == 'ThisExpression' &&
                                node.init.property.name == 'props')
                        )
                            return false;

                        // Check for the case where it could be aliased (i.e.) { baz: foo } = this.props;
                        // In this case, we won't do a substitution.
                        if (
                            p.parentPath.value.type == 'Property' &&
                            p.parentPath.value.key.name !== name
                        )
                            return false;

                        return true;
                    });
                };

                // Transform "this.props.xyz" to "xyz", and record what we've transformed.
                // Transform as long as we don't have "xyz" already defined in the scope.
                root
                    .find(j.MemberExpression, {
                        object: {
                            type: 'MemberExpression',
                            object: { type: 'ThisExpression' },
                            property: { name: 'props' }
                        }
                    })
                    .filter(e => {
                        const resolvedScope = e.scope.lookup(e.value.property.name);
                        // If the scope is null, that means that this property isn't defined in the scope yet,
                        // and we can use it. Otherwise, if it is defined, we should see if it was defined from `this.props`
                        // if none of these cases are true, we can't do substitution.
                        return (
                            resolvedScope == null ||
                            isFromProps(e.value.property.name, resolvedScope)
                        );
                    })
                    // Ensure that our substitution won't cause us to define a keyword, i.e. `this.props.while` won't
                    // get converted into `while`.
                    .filter(p => !isKeyword(p.value.property.name))
                    // Now, do the replacement, `this.props.xyz` => `xyz`.
                    .replaceWith(p => p.value.property)
                    // Finally, mark the variable as something we will need to define earlier in the function,
                    // if it's not already defined.
                    .forEach(p => {
                        // Is this prop already defined somewhere else.
                        if (!p.scope.lookup(p.value.name)) variablesToReplace[p.value.name] = true;
                    });

                // Create property definitions for variables that we've replaced.
                const properties = Object.keys(variablesToReplace).sort().map(k => {
                    const prop = j.property('init', j.identifier(k), j.identifier(k));
                    prop.shorthand = true;
                    return prop;
                });

                // We have no properties to inject, so we can bail here.
                if (!properties.length) return p.value;

                // See if we already have a VariableDeclarator like { a, b, c } = this.props;
                const propDefinitions = root.find(j.VariableDeclarator, {
                    id: { type: 'ObjectPattern' },
                    init: {
                        type: 'MemberExpression',
                        object: { type: 'ThisExpression' },
                        property: { name: 'props' }
                    }
                });

                if (propDefinitions.size()) {
                    const nodePath = propDefinitions.paths()[0];
                    const node = nodePath.value;
                    const newPattern = j.objectPattern(node.id.properties.concat(properties));
                    nodePath.replace(j.variableDeclarator(newPattern, node.init));
                    return p.value;
                }

                // Otherwise, we'll have to create our own, as none were suitable for use.
                // Create the variable definition `const { xyz } = this.props;`
                const decl = statement`const { ${properties} } = this.props;`;

                // Add the variable definition to the top of the function expression body.
                return j.functionExpression(
                    p.value.id,
                    p.value.params,
                    j.blockStatement([decl].concat(p.value.body.body))
                );
            })
            .toSource();

        return {
            didTransform,
            root,
            printOptions
        };
    }
};
