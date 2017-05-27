/** For when you've gone too pure and want to go back. **/
/** Converts
 * let HistoryItem = (props) => {
 *   const {
 *     item
 *   } = props;
 *   return <li>{item}</li>;
 * };
 *
 * let X = (props) => <div>foo</div>;
 *
 * to
 *
 * class HistoryItem extends Component {
 *   render() {
 *     const {
 *       item
 *     } = this.props;
 *     return <li>{item}</li>;
 *   }
 * }
 *
 * class X extends Component {
 *   render() {
 *     return <div>foo</div>;
 *   }
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

        function hasJSXElement(ast) {
            return j(ast).find(j.JSXElement).size() > 0;
        }

        const didTransform = j(file.source)
            .find(j.VariableDeclaration)
            .filter(p => p.value.declarations.length == 1)
            .replaceWith(p => {
                const decl = p.value.declarations[0];
                if (
                    decl.init.type !== 'ArrowFunctionExpression' ||
                    (!hasJSXElement(decl.init.body) && decl.init.body.type !== 'JSXElement')
                )
                    return p.value;

                let body = decl.init.body;
                body = body.type == 'JSXElement' ? j.returnStatement(body) : (body = body.body);

                j(body)
                    .find(j.Identifier, { name: 'props' })
                    .replaceWith(p =>
                        j.memberExpression(j.thisExpression(), j.identifier('props'))
                    );

                return statement`class ${decl.id} extends Component {
  			  render() { ${body} }
  		  }`;
            })
            .toSource();

        return {
            didTransform,
            root,
            printOptions
        };
    }
};
