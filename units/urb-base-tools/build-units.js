// @flow

import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

import prettierESLint from 'prettier-eslint'

// $FlowIssue Not sure why it gives an error. The file does exist
import packageJSON from '../../package.json'
// $FlowIssue Not sure why it gives an error. The file does exist
import eslintRC from '../../.eslintrc.json'

import ensureFileContent from './ensureFileContent'

const existsAsync = promisify( fs.exists )
const readFileAsync = promisify( fs.readFile )
const readdirAsync = promisify( fs.readdir )

const prettierESLintOptions = { eslintConfig: eslintRC, prettierOptions: packageJSON.prettier }

function sortObject( object: Object ) {
  var t = {}
  Object.keys( object )
    .sort()
    .forEach( function( k ) {
      t[k] = object[k]
    })
  return t
}

function orderPackages( packageAsObject ) {
  packageAsObject.scripts = sortObject( packageAsObject.scripts )
  packageAsObject.dependencies = sortObject( packageAsObject.dependencies )
  packageAsObject.devDependencies = sortObject( packageAsObject.devDependencies )
}

function mergeScripts( scripts1, scripts2 ) {
  const scripts = Object.assign({}, scripts1 )

  for ( let scriptName in scripts2 ) {
    const script = scripts[scriptName]
    const script2 = scripts2[scriptName]

    if ( script && script2 ) {
      scripts[scriptName] = script + ' && ' + script2
    } else if ( script2 ) {
      scripts[scriptName] = script2
    }
  }

  return scripts
}

async function createPackageJson( units: Array<string> ) {
  const packageJsonFileName = path.resolve( './package.json' )
  const currentPackageAsJSONString = ( await readFileAsync( packageJsonFileName ) ).toString()
  const currentPackageAsObject = JSON.parse( currentPackageAsJSONString )
  const packageAsObject = {
    dependencies: {},
    devDependencies: {},
    engines: {},
    'lint-staged': {},
    name: null,
    prettier: {},
    scripts: {},
    version: null,
  }

  // Make sure not to overwrite version information
  packageAsObject.version = currentPackageAsObject.version
  packageAsObject.name = currentPackageAsObject.name

  // Add packages to object
  for ( let unitName of units ) {
    const packageAsObjectName = path.resolve( './units', unitName, 'package.part.json' )
    if ( await existsAsync( packageAsObjectName ) ) {
      const packageToAddAsObject = JSON.parse( ( await readFileAsync( packageAsObjectName ) ).toString() )

      if ( packageToAddAsObject.dependencies )
        Object.assign( packageAsObject.dependencies, packageToAddAsObject.dependencies )
      if ( packageToAddAsObject.devDependencies )
        Object.assign( packageAsObject.devDependencies, packageToAddAsObject.devDependencies )
      if ( packageToAddAsObject.engines )
        Object.assign( packageAsObject.engines, packageToAddAsObject.engines )
      if ( packageToAddAsObject['lint-staged'])
        Object.assign( packageAsObject['lint-staged'], packageToAddAsObject['lint-staged'])
      if ( packageToAddAsObject.prettier )
        Object.assign( packageAsObject.prettier, packageToAddAsObject.prettier )
      if ( packageToAddAsObject.scripts )
        packageAsObject.scripts = mergeScripts(
          packageAsObject.scripts,
          packageToAddAsObject.scripts,
        )
    }
  }

  // Make them pretty
  orderPackages( packageAsObject )

  await ensureFileContent(
    packageJsonFileName,
    currentPackageAsJSONString,
    JSON.stringify( packageAsObject, null, 2 ),
    true,
  )
}

async function createMutations( units: Array<string> ) {
  const mutationsImports = []
  const mutationsExports = []

  for ( let unitName of units )
    if ( unitName.endsWith( '-server' ) ) {
      const mutationsDir = path.resolve( './units', unitName, 'graphql/mutation' )
      if ( await existsAsync( mutationsDir ) ) {
        const mutationFileNames = await readdirAsync( mutationsDir )

        for ( let mutationFileName of mutationFileNames ) {
          if ( mutationFileName.endsWith( '.js' ) ) {
            const mutation = mutationFileName.substring( 0, mutationFileName.length - 3 )
            mutationsImports.push(
              'import ' +
                mutation.replace( '.', '_' ) +
                ' from \'../../../' +
                unitName +
                '/graphql/mutation/' +
                mutation +
                '\'',
            )
            mutationsExports.push( '  ' + mutation + ',' )
          }
        }
      }
    }

  let mutations = [ '// @flow', '' ]
  mutations = mutations.concat( mutationsImports )
  mutations = mutations.concat([ '', 'export default {' ])
  mutations = mutations.concat( mutationsExports )
  mutations = mutations.concat([ '}' ])

  await ensureFileContent(
    path.resolve( './units/_configuration/urb-base-server/graphql/_mutations.js' ),
    null,
    prettierESLint({ text: mutations.join( '\r\n' ), ...prettierESLintOptions }),
    true,
  )
}

async function createSchemas( units: Array<string> ) {
  const schemasImports = []

  for ( let unitName of units )
    if ( unitName.endsWith( '-server' ) ) {
      const schemasDir = path.resolve( './units', unitName, 'graphql/model' )
      if ( await existsAsync( schemasDir ) ) {
        const objectTypeFileNames = await readdirAsync( schemasDir )

        for ( let objectTypeFileName of objectTypeFileNames ) {
          if ( objectTypeFileName.endsWith( '.js' ) ) {
            const objectType = objectTypeFileName.substring( 0, objectTypeFileName.length - 3 )
            schemasImports.push(
              'import \'../../../' + unitName + '/graphql/model/' + objectType + '\'',
            )
          }
        }
      }
    }

  let schemas = [ '// @flow', '' ]
  schemas = schemas.concat( schemasImports )
  schemas = schemas.concat([ '', 'export default true' ])

  await ensureFileContent(
    path.resolve( './units/_configuration/urb-base-server/graphql/_schemas.js' ),
    null,
    prettierESLint({ text: schemas.join( '\r\n' ), ...prettierESLintOptions }),
    true,
  )
}

async function createViewerFields( units: Array<string> ) {
  const viewerFieldsImports = []
  const viewerFieldsExports = []

  for ( let unitName of units )
    if ( unitName.endsWith( '-server' ) ) {
      const viewerFieldsFileName = path.resolve(
        './units',
        unitName,
        'graphql/type/_ViewerFields.js',
      )
      if ( await existsAsync( viewerFieldsFileName ) ) {
        const viewerFieldsImportName = unitName.replace( /-/g, '_' )
        viewerFieldsImports.push(
          'import ' +
            viewerFieldsImportName +
            ' from \'../../../' +
            unitName +
            '/graphql/type/_ViewerFields\'',
        )
        viewerFieldsExports.push( '  ...' + viewerFieldsImportName + ',' )
      }
    }

  let viewerFields = [ '// @flow', '' ]
  viewerFields = viewerFields.concat( viewerFieldsImports )
  viewerFields = viewerFields.concat([ '', 'export default {' ])
  viewerFields = viewerFields.concat( viewerFieldsExports )
  viewerFields = viewerFields.concat([ '}' ])

  await ensureFileContent(
    path.resolve( './units/_configuration/urb-base-server/graphql/_ViewerFields.js' ),
    null,
    prettierESLint({ text: viewerFields.join( '\r\n' ), ...prettierESLintOptions }),
    true,
  )
}

async function createRoutes( units: Array<string> ) {
  const routesAppFrameImports = []
  const routesRootImports = []
  const routesAppFrameExports = []
  const routesRootExports = []

  for ( let unitName of units )
    if ( unitName.endsWith( '-webapp' ) ) {
      const routesDir = path.resolve( './units', unitName )
      if ( await existsAsync( routesDir ) ) {
        const routeFileNames = await readdirAsync( routesDir )

        for ( let routeFileName of routeFileNames ) {
          if ( routeFileName.endsWith( '.jsx' ) )
            if ( routeFileName.startsWith( 'routeAppFrame' ) ) {
              const route = routeFileName.substring( 0, routeFileName.length - 4 )
              routesAppFrameImports.push(
                'import ' + route + ' from \'../../' + unitName + '/' + route + '\'',
              )
              routesAppFrameExports.push( '  ' + route + ',' )
            } else if ( routeFileName.startsWith( 'routeRoot' ) ) {
              const route = routeFileName.substring( 0, routeFileName.length - 4 )
              routesRootImports.push(
                'import ' + route + ' from \'../../' + unitName + '/' + route + '\'',
              )
              routesRootExports.push( '  ' + route + ',' )
            }
        }
      }
    }

  await Promise.all([
    createRouteFile(
      path.resolve( './units/_configuration/urb-base-webapp/routesAppFrame.js' ),
      routesAppFrameImports,
      routesAppFrameExports,
    ),
    createRouteFile(
      path.resolve( './units/_configuration/urb-base-webapp/routesRoot.js' ),
      routesRootImports,
      routesRootExports,
    ),
  ])
}

async function createRouteFile( fileName: string, imports: Array<string>, exports: Array<string> ) {
  let routesAppFrame = [ '// @flow', '' ]
  routesAppFrame = routesAppFrame.concat( imports )
  routesAppFrame = routesAppFrame.concat([ '', 'export default [' ])
  routesAppFrame = routesAppFrame.concat( exports )
  routesAppFrame = routesAppFrame.concat([ ']' ])

  await ensureFileContent(
    fileName,
    null,
    prettierESLint({ text: routesAppFrame.join( '\r\n' ), ...prettierESLintOptions }),
    true,
  )
}

async function getUnits() {
  const units = ( await readdirAsync( './units/' ) ).filter(
    fileName => fileName !== '.DS_Store' && fileName !== '_configuration',
  )
  return units
}

async function main() {
  const units = await getUnits()

  const taskPromises = [
    createPackageJson( units ),
    createViewerFields( units ),
    createSchemas( units ),
    createMutations( units ),
    createRoutes( units ),
  ]

  await Promise.all( taskPromises )
}

main().then( () => console.log( 'Fin.' ) )
