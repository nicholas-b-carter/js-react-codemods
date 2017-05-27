# JS React Codemods

[![Greenkeeper badge](https://badges.greenkeeper.io/nicholas-b-carter/js-react-codemods.svg)](https://greenkeeper.io/)

Personal collection of transforms for everything from jest tests to es5-6-transforms....

## Resources

Some things that hope helpfully:


  ### Codeshift/transforms
    * https://github.com/sejoker/awesome-jscodeshift
    * https://github.com/chadbrewbaker/awesome-ast
    * https://github.com/cowchimp/awesome-ast


   ### AST Explorer
    * https://astexplorer.net

## Setup

To get started just run

```
yarn global add jscodeshift
yarn global add jscodemigrate
yarn install
```

## Usage

Run code migrations on the example folder (warning: this will update the contents of example/src):

```
jscodemigrate
```
